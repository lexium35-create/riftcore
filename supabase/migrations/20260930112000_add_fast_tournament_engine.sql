create table if not exists public.tournament_engine_configs (
  tournament_id uuid primary key references public.tournaments(id) on delete cascade,
  priority text not null default 'fast' check (priority in ('fast','balanced','competitive')),
  mode text not null check (mode in ('fast_swiss','single_elimination')),
  swiss_rounds smallint not null default 0 check (swiss_rounds between 0 and 8),
  playoff_cut smallint not null default 0 check (playoff_cut in (0,4,8,16)),
  swiss_best_of smallint not null default 1 check (swiss_best_of in (1,3,5,7)),
  playoff_best_of smallint not null default 3 check (playoff_best_of in (1,3,5,7)),
  grand_final_best_of smallint not null default 3 check (grand_final_best_of in (1,3,5,7)),
  max_concurrent_matches smallint not null default 8 check (max_concurrent_matches > 0),
  swiss_slot_minutes smallint not null default 35 check (swiss_slot_minutes between 10 and 180),
  playoff_slot_minutes smallint not null default 70 check (playoff_slot_minutes between 20 and 240),
  buffer_minutes smallint not null default 25 check (buffer_minutes between 0 and 180),
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  locked_team_count smallint not null check (locked_team_count >= 2),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  registration_id uuid not null references public.team_registrations(id) on delete cascade,
  seed smallint not null check (seed > 0),
  bye_count smallint not null default 0 check (bye_count >= 0),
  created_at timestamptz not null default now(),
  unique (tournament_id, registration_id),
  unique (tournament_id, seed)
);

create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  stage text not null check (stage in ('swiss','single_elimination','semifinal','final')),
  round_number smallint not null check (round_number > 0),
  match_number smallint not null check (match_number > 0),
  batch_number smallint not null default 1 check (batch_number > 0),
  best_of smallint not null check (best_of in (1,3,5,7)),
  team_a_entry_id uuid not null references public.tournament_entries(id) on delete restrict,
  team_b_entry_id uuid references public.tournament_entries(id) on delete restrict,
  team_a_score smallint not null default 0 check (team_a_score >= 0),
  team_b_score smallint not null default 0 check (team_b_score >= 0),
  winner_entry_id uuid references public.tournament_entries(id) on delete restrict,
  status text not null default 'scheduled' check (status in ('scheduled','final')),
  is_bye boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, stage, round_number, match_number),
  check (
    (is_bye = true and team_b_entry_id is null)
    or (is_bye = false and team_b_entry_id is not null)
  )
);

create index if not exists tournament_entries_tournament_idx
  on public.tournament_entries(tournament_id, seed);
create index if not exists tournament_matches_tournament_stage_round_idx
  on public.tournament_matches(tournament_id, stage, round_number, match_number);

alter table public.tournament_engine_configs enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.tournament_matches enable row level security;

drop trigger if exists tournament_matches_set_updated_at on public.tournament_matches;
create trigger tournament_matches_set_updated_at
before update on public.tournament_matches
for each row execute function public.riftcore_set_updated_at();

create or replace function public.get_public_tournament_engine_state(p_tournament_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tournament_id uuid;
begin
  select id into v_tournament_id
  from public.tournaments
  where slug = p_tournament_slug;

  if v_tournament_id is null then
    return null;
  end if;

  return jsonb_build_object(
    'format', (
      select jsonb_build_object(
        'priority', config.priority,
        'mode', config.mode,
        'swissRounds', config.swiss_rounds,
        'playoffCut', config.playoff_cut,
        'swissBestOf', config.swiss_best_of,
        'playoffBestOf', config.playoff_best_of,
        'grandFinalBestOf', config.grand_final_best_of,
        'maxConcurrentMatches', config.max_concurrent_matches,
        'swissSlotMinutes', config.swiss_slot_minutes,
        'playoffSlotMinutes', config.playoff_slot_minutes,
        'bufferMinutes', config.buffer_minutes,
        'estimatedMinutes', config.estimated_minutes,
        'lockedTeamCount', config.locked_team_count,
        'startedAt', config.started_at,
        'completedAt', config.completed_at
      )
      from public.tournament_engine_configs config
      where config.tournament_id = v_tournament_id
    ),
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', entry.id,
          'seed', entry.seed,
          'byeCount', entry.bye_count,
          'teamName', registration.team_name,
          'teamTag', registration.team_tag
        )
        order by entry.seed
      )
      from public.tournament_entries entry
      join public.team_registrations registration
        on registration.id = entry.registration_id
      where entry.tournament_id = v_tournament_id
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', match.id,
          'stage', match.stage,
          'roundNumber', match.round_number,
          'matchNumber', match.match_number,
          'batchNumber', match.batch_number,
          'bestOf', match.best_of,
          'teamAEntryId', match.team_a_entry_id,
          'teamBEntryId', match.team_b_entry_id,
          'teamAName', registration_a.team_name,
          'teamBName', registration_b.team_name,
          'teamAScore', match.team_a_score,
          'teamBScore', match.team_b_score,
          'winnerEntryId', match.winner_entry_id,
          'status', match.status,
          'isBye', match.is_bye
        )
        order by
          case match.stage
            when 'swiss' then 1
            when 'single_elimination' then 2
            when 'semifinal' then 3
            when 'final' then 4
            else 9
          end,
          match.round_number,
          match.match_number
      )
      from public.tournament_matches match
      join public.tournament_entries entry_a on entry_a.id = match.team_a_entry_id
      join public.team_registrations registration_a on registration_a.id = entry_a.registration_id
      left join public.tournament_entries entry_b on entry_b.id = match.team_b_entry_id
      left join public.team_registrations registration_b on registration_b.id = entry_b.registration_id
      where match.tournament_id = v_tournament_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_public_tournament_engine_state(text) from public;
grant execute on function public.get_public_tournament_engine_state(text) to anon, authenticated;

create or replace function public.get_operator_tournament_engine_state(p_tournament_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.riftcore_operator_role() is null then
    raise exception 'Operator access required.' using errcode = '42501';
  end if;
  return public.get_public_tournament_engine_state(p_tournament_slug);
end;
$$;

revoke all on function public.get_operator_tournament_engine_state(text) from public;
grant execute on function public.get_operator_tournament_engine_state(text) to authenticated;

create or replace function public.start_tournament_engine(
  p_tournament_slug text,
  p_mode text,
  p_swiss_rounds integer,
  p_playoff_cut integer,
  p_swiss_best_of integer,
  p_playoff_best_of integer,
  p_grand_final_best_of integer,
  p_max_concurrent_matches integer,
  p_swiss_slot_minutes integer,
  p_playoff_slot_minutes integer,
  p_buffer_minutes integer,
  p_estimated_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_tournament public.tournaments%rowtype;
  v_count integer;
begin
  v_role := public.riftcore_operator_role();
  if v_role not in ('owner','admin') then
    raise exception 'Owner or admin access required.' using errcode = '42501';
  end if;

  select * into v_tournament
  from public.tournaments
  where slug = p_tournament_slug
  for update;

  if not found then
    raise exception 'Tournament not found.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.tournament_engine_configs
    where tournament_id = v_tournament.id
  ) then
    raise exception 'Tournament engine is already started.' using errcode = '23505';
  end if;

  select count(*) into v_count
  from public.team_registrations registration
  where registration.tournament_id = v_tournament.id
    and registration.status = 'verified'
    and registration.checked_in = true;

  if v_count < 2 then
    raise exception 'At least two verified, checked-in teams are required.' using errcode = '22023';
  end if;

  if p_mode not in ('fast_swiss','single_elimination') then
    raise exception 'Unsupported tournament mode.' using errcode = '22023';
  end if;

  insert into public.tournament_engine_configs (
    tournament_id,
    priority,
    mode,
    swiss_rounds,
    playoff_cut,
    swiss_best_of,
    playoff_best_of,
    grand_final_best_of,
    max_concurrent_matches,
    swiss_slot_minutes,
    playoff_slot_minutes,
    buffer_minutes,
    estimated_minutes,
    locked_team_count
  ) values (
    v_tournament.id,
    'fast',
    p_mode,
    p_swiss_rounds,
    p_playoff_cut,
    p_swiss_best_of,
    p_playoff_best_of,
    p_grand_final_best_of,
    p_max_concurrent_matches,
    p_swiss_slot_minutes,
    p_playoff_slot_minutes,
    p_buffer_minutes,
    p_estimated_minutes,
    v_count
  );

  insert into public.tournament_entries (
    tournament_id,
    registration_id,
    seed
  )
  select
    v_tournament.id,
    registration.id,
    row_number() over (
      order by registration.created_at asc, registration.id asc
    )::smallint
  from public.team_registrations registration
  where registration.tournament_id = v_tournament.id
    and registration.status = 'verified'
    and registration.checked_in = true;

  update public.tournaments
  set status = 'live',
      format = case
        when p_mode = 'fast_swiss'
          then p_swiss_rounds::text || 'R Fast Swiss -> Top ' || p_playoff_cut::text
        else 'Fast Single Elimination'
      end
  where id = v_tournament.id;

  insert into public.operator_audit_log (
    actor_user_id,
    tournament_id,
    action,
    after_state
  ) values (
    auth.uid(),
    v_tournament.id,
    'tournament.engine_started',
    jsonb_build_object(
      'mode', p_mode,
      'teamCount', v_count,
      'swissRounds', p_swiss_rounds,
      'playoffCut', p_playoff_cut
    )
  );

  return public.get_public_tournament_engine_state(p_tournament_slug);
end;
$$;

revoke all on function public.start_tournament_engine(
  text,text,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer
) from public;
grant execute on function public.start_tournament_engine(
  text,text,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer
) to authenticated;

create or replace function public.create_tournament_round(
  p_tournament_slug text,
  p_stage text,
  p_round_number integer,
  p_best_of integer,
  p_pairings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_tournament_id uuid;
  v_pairing jsonb;
  v_a uuid;
  v_b uuid;
  v_match_number integer;
  v_batch_number integer;
  v_is_bye boolean;
begin
  v_role := public.riftcore_operator_role();
  if v_role not in ('owner','admin') then
    raise exception 'Owner or admin access required.' using errcode = '42501';
  end if;

  select id into v_tournament_id
  from public.tournaments
  where slug = p_tournament_slug;

  if v_tournament_id is null then
    raise exception 'Tournament not found.' using errcode = 'P0002';
  end if;

  if p_stage not in ('swiss','single_elimination','semifinal','final') then
    raise exception 'Invalid tournament stage.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.tournament_matches
    where tournament_id = v_tournament_id
      and stage = p_stage
      and round_number = p_round_number
  ) then
    raise exception 'That round already exists.' using errcode = '23505';
  end if;

  if p_pairings is null or jsonb_typeof(p_pairings) <> 'array'
     or jsonb_array_length(p_pairings) = 0 then
    raise exception 'Pairings are required.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from (
      select nullif(pairing->>'teamAEntryId','')::uuid as entry_id
      from jsonb_array_elements(p_pairings) pairing
      union all
      select nullif(pairing->>'teamBEntryId','')::uuid as entry_id
      from jsonb_array_elements(p_pairings) pairing
    ) used
    where used.entry_id is not null
    group by used.entry_id
    having count(*) > 1
  ) then
    raise exception 'A team cannot appear twice in the same round.' using errcode = '22023';
  end if;

  for v_pairing in select * from jsonb_array_elements(p_pairings)
  loop
    v_a := nullif(v_pairing->>'teamAEntryId','')::uuid;
    v_b := nullif(v_pairing->>'teamBEntryId','')::uuid;
    v_match_number := (v_pairing->>'matchNumber')::integer;
    v_batch_number := coalesce((v_pairing->>'batchNumber')::integer, 1);
    v_is_bye := v_b is null;

    if not exists (
      select 1 from public.tournament_entries
      where id = v_a and tournament_id = v_tournament_id
    ) then
      raise exception 'Pairing references an invalid team A.' using errcode = '22023';
    end if;

    if v_b is not null and not exists (
      select 1 from public.tournament_entries
      where id = v_b and tournament_id = v_tournament_id
    ) then
      raise exception 'Pairing references an invalid team B.' using errcode = '22023';
    end if;

    insert into public.tournament_matches (
      tournament_id,
      stage,
      round_number,
      match_number,
      batch_number,
      best_of,
      team_a_entry_id,
      team_b_entry_id,
      team_a_score,
      team_b_score,
      winner_entry_id,
      status,
      is_bye
    ) values (
      v_tournament_id,
      p_stage,
      p_round_number,
      v_match_number,
      v_batch_number,
      p_best_of,
      v_a,
      v_b,
      case when v_is_bye then 1 else 0 end,
      0,
      case when v_is_bye then v_a else null end,
      case when v_is_bye then 'final' else 'scheduled' end,
      v_is_bye
    );

    if v_is_bye then
      update public.tournament_entries
      set bye_count = bye_count + 1
      where id = v_a;
    end if;
  end loop;

  insert into public.operator_audit_log (
    actor_user_id,
    tournament_id,
    action,
    after_state
  ) values (
    auth.uid(),
    v_tournament_id,
    'tournament.round_created',
    jsonb_build_object(
      'stage', p_stage,
      'round', p_round_number,
      'pairings', p_pairings
    )
  );

  return public.get_public_tournament_engine_state(p_tournament_slug);
end;
$$;

revoke all on function public.create_tournament_round(text,text,integer,integer,jsonb) from public;
grant execute on function public.create_tournament_round(text,text,integer,integer,jsonb) to authenticated;

create or replace function public.record_tournament_match_result(
  p_match_id uuid,
  p_team_a_score integer,
  p_team_b_score integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_match public.tournament_matches%rowtype;
  v_required_wins integer;
  v_winner uuid;
  v_slug text;
begin
  v_role := public.riftcore_operator_role();
  if v_role not in ('owner','admin','referee') then
    raise exception 'Operator access required.' using errcode = '42501';
  end if;

  select * into v_match
  from public.tournament_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found.' using errcode = 'P0002';
  end if;

  if v_match.is_bye then
    raise exception 'Bye matches do not need a result.' using errcode = '22023';
  end if;

  v_required_wins := (v_match.best_of / 2) + 1;

  if p_team_a_score = p_team_b_score
     or greatest(p_team_a_score, p_team_b_score) <> v_required_wins
     or least(p_team_a_score, p_team_b_score) < 0
     or least(p_team_a_score, p_team_b_score) >= v_required_wins then
    raise exception 'Invalid score for BO% match.', v_match.best_of using errcode = '22023';
  end if;

  v_winner := case
    when p_team_a_score > p_team_b_score then v_match.team_a_entry_id
    else v_match.team_b_entry_id
  end;

  update public.tournament_matches
  set team_a_score = p_team_a_score,
      team_b_score = p_team_b_score,
      winner_entry_id = v_winner,
      status = 'final'
  where id = p_match_id;

  if v_match.stage = 'final' then
    update public.tournament_engine_configs
    set completed_at = now()
    where tournament_id = v_match.tournament_id;

    update public.tournaments
    set status = 'completed'
    where id = v_match.tournament_id;
  end if;

  insert into public.operator_audit_log (
    actor_user_id,
    tournament_id,
    action,
    before_state,
    after_state
  ) values (
    auth.uid(),
    v_match.tournament_id,
    'tournament.match_finalized',
    jsonb_build_object(
      'matchId', v_match.id,
      'status', v_match.status,
      'teamAScore', v_match.team_a_score,
      'teamBScore', v_match.team_b_score
    ),
    jsonb_build_object(
      'matchId', v_match.id,
      'status', 'final',
      'teamAScore', p_team_a_score,
      'teamBScore', p_team_b_score,
      'winnerEntryId', v_winner
    )
  );

  select slug into v_slug
  from public.tournaments
  where id = v_match.tournament_id;

  return public.get_public_tournament_engine_state(v_slug);
end;
$$;

revoke all on function public.record_tournament_match_result(uuid,integer,integer) from public;
grant execute on function public.record_tournament_match_result(uuid,integer,integer) to authenticated;
