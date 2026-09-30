alter table public.tournament_matches
  add column if not exists scheduled_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists room_code text,
  add column if not exists room_password text,
  add column if not exists referee_name text,
  add column if not exists streamed boolean not null default false,
  add column if not exists team_a_ready boolean not null default false,
  add column if not exists team_b_ready boolean not null default false,
  add column if not exists ops_note text;

alter table public.tournament_matches
  drop constraint if exists tournament_matches_status_check;

alter table public.tournament_matches
  add constraint tournament_matches_status_check
  check (status in ('scheduled','ready','live','final'));

create table if not exists public.tournament_announcements (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  kind text not null default 'info'
    check (kind in ('info','schedule','important','critical','result')),
  title text not null,
  body text not null,
  pinned boolean not null default false,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists tournament_announcements_public_idx
  on public.tournament_announcements(tournament_id, archived_at, pinned desc, created_at desc);

create table if not exists public.tournament_incidents (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id uuid references public.tournament_matches(id) on delete set null,
  severity text not null default 'normal'
    check (severity in ('normal','important','critical')),
  category text not null default 'match'
    check (category in ('match','lobby','no_show','connectivity','conduct','score','other')),
  title text not null,
  description text not null,
  status text not null default 'open'
    check (status in ('open','resolved')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists tournament_incidents_ops_idx
  on public.tournament_incidents(tournament_id, status, severity, created_at desc);

alter table public.tournament_announcements enable row level security;
alter table public.tournament_incidents enable row level security;

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
          'isBye', match.is_bye,
          'scheduledAt', match.scheduled_at,
          'startedAt', match.started_at,
          'completedAt', match.completed_at,
          'refereeName', match.referee_name,
          'streamed', match.streamed,
          'teamAReady', match.team_a_ready,
          'teamBReady', match.team_b_ready
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

create or replace function public.get_operator_match_ops(p_tournament_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tournament_id uuid;
begin
  if public.riftcore_operator_role() is null then
    raise exception 'Operator access required.' using errcode = '42501';
  end if;

  select id into v_tournament_id
  from public.tournaments
  where slug = p_tournament_slug;

  if v_tournament_id is null then
    raise exception 'Tournament not found.' using errcode = 'P0002';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', match.id,
        'status', match.status,
        'roomCode', match.room_code,
        'roomPassword', match.room_password,
        'refereeName', match.referee_name,
        'scheduledAt', match.scheduled_at,
        'startedAt', match.started_at,
        'completedAt', match.completed_at,
        'streamed', match.streamed,
        'teamAReady', match.team_a_ready,
        'teamBReady', match.team_b_ready,
        'opsNote', match.ops_note
      )
      order by match.created_at
    )
    from public.tournament_matches match
    where match.tournament_id = v_tournament_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_operator_match_ops(text) from public;
grant execute on function public.get_operator_match_ops(text) to authenticated;

create or replace function public.update_tournament_match_ops(
  p_match_id uuid,
  p_status text default null,
  p_room_code text default null,
  p_room_password text default null,
  p_referee_name text default null,
  p_scheduled_at timestamptz default null,
  p_streamed boolean default null,
  p_team_a_ready boolean default null,
  p_team_b_ready boolean default null,
  p_ops_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_match public.tournament_matches%rowtype;
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

  if v_match.status = 'final' then
    raise exception 'Finalized matches cannot be edited from match operations.' using errcode = '22023';
  end if;

  if p_status is not null and p_status not in ('scheduled','ready','live') then
    raise exception 'Match status must be scheduled, ready, or live.' using errcode = '22023';
  end if;

  update public.tournament_matches
  set status = coalesce(p_status, status),
      room_code = case when p_room_code is null then room_code else nullif(btrim(p_room_code), '') end,
      room_password = case when p_room_password is null then room_password else nullif(btrim(p_room_password), '') end,
      referee_name = case when p_referee_name is null then referee_name else nullif(btrim(p_referee_name), '') end,
      scheduled_at = coalesce(p_scheduled_at, scheduled_at),
      streamed = coalesce(p_streamed, streamed),
      team_a_ready = coalesce(p_team_a_ready, team_a_ready),
      team_b_ready = coalesce(p_team_b_ready, team_b_ready),
      ops_note = case when p_ops_note is null then ops_note else nullif(btrim(p_ops_note), '') end,
      started_at = case
        when coalesce(p_status, status) = 'live' then coalesce(started_at, now())
        else started_at
      end
  where id = p_match_id;

  insert into public.operator_audit_log (
    actor_user_id,
    tournament_id,
    action,
    before_state,
    after_state
  ) values (
    auth.uid(),
    v_match.tournament_id,
    'tournament.match_ops_updated',
    jsonb_build_object(
      'matchId', v_match.id,
      'status', v_match.status,
      'refereeName', v_match.referee_name,
      'streamed', v_match.streamed,
      'teamAReady', v_match.team_a_ready,
      'teamBReady', v_match.team_b_ready
    ),
    jsonb_build_object(
      'matchId', v_match.id,
      'status', coalesce(p_status, v_match.status),
      'refereeName', coalesce(p_referee_name, v_match.referee_name),
      'streamed', coalesce(p_streamed, v_match.streamed),
      'teamAReady', coalesce(p_team_a_ready, v_match.team_a_ready),
      'teamBReady', coalesce(p_team_b_ready, v_match.team_b_ready)
    )
  );

  select slug into v_slug
  from public.tournaments
  where id = v_match.tournament_id;

  return jsonb_build_object(
    'state', public.get_public_tournament_engine_state(v_slug),
    'ops', public.get_operator_match_ops(v_slug)
  );
end;
$$;

revoke all on function public.update_tournament_match_ops(uuid,text,text,text,text,timestamptz,boolean,boolean,boolean,text) from public;
grant execute on function public.update_tournament_match_ops(uuid,text,text,text,text,timestamptz,boolean,boolean,boolean,text) to authenticated;

create or replace function public.get_public_tournament_announcements(p_tournament_slug text)
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
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', announcement.id,
        'kind', announcement.kind,
        'title', announcement.title,
        'body', announcement.body,
        'pinned', announcement.pinned,
        'createdAt', announcement.created_at
      )
      order by announcement.pinned desc, announcement.created_at desc
    )
    from public.tournament_announcements announcement
    where announcement.tournament_id = v_tournament_id
      and announcement.archived_at is null
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_public_tournament_announcements(text) from public;
grant execute on function public.get_public_tournament_announcements(text) to anon, authenticated;

create or replace function public.create_tournament_announcement(
  p_tournament_slug text,
  p_kind text,
  p_title text,
  p_body text,
  p_pinned boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_tournament_id uuid;
begin
  v_role := public.riftcore_operator_role();
  if v_role not in ('owner','admin','referee') then
    raise exception 'Operator access required.' using errcode = '42501';
  end if;

  if p_kind not in ('info','schedule','important','critical','result') then
    raise exception 'Invalid announcement kind.' using errcode = '22023';
  end if;

  if length(btrim(coalesce(p_title,''))) < 2 or length(btrim(coalesce(p_body,''))) < 2 then
    raise exception 'Announcement title and body are required.' using errcode = '22023';
  end if;

  select id into v_tournament_id
  from public.tournaments
  where slug = p_tournament_slug;

  if v_tournament_id is null then
    raise exception 'Tournament not found.' using errcode = 'P0002';
  end if;

  insert into public.tournament_announcements (
    tournament_id,
    kind,
    title,
    body,
    pinned,
    created_by_user_id
  ) values (
    v_tournament_id,
    p_kind,
    btrim(p_title),
    btrim(p_body),
    p_pinned,
    auth.uid()
  );

  insert into public.operator_audit_log (
    actor_user_id,
    tournament_id,
    action,
    after_state
  ) values (
    auth.uid(),
    v_tournament_id,
    'tournament.announcement_created',
    jsonb_build_object('kind', p_kind, 'title', btrim(p_title), 'pinned', p_pinned)
  );

  return public.get_public_tournament_announcements(p_tournament_slug);
end;
$$;

revoke all on function public.create_tournament_announcement(text,text,text,text,boolean) from public;
grant execute on function public.create_tournament_announcement(text,text,text,text,boolean) to authenticated;

create or replace function public.archive_tournament_announcement(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_tournament_id uuid;
begin
  v_role := public.riftcore_operator_role();
  if v_role not in ('owner','admin','referee') then
    raise exception 'Operator access required.' using errcode = '42501';
  end if;

  update public.tournament_announcements
  set archived_at = now()
  where id = p_announcement_id
  returning tournament_id into v_tournament_id;

  if v_tournament_id is null then
    raise exception 'Announcement not found.' using errcode = 'P0002';
  end if;

  insert into public.operator_audit_log (
    actor_user_id, tournament_id, action, after_state
  ) values (
    auth.uid(), v_tournament_id, 'tournament.announcement_archived',
    jsonb_build_object('announcementId', p_announcement_id)
  );
end;
$$;

revoke all on function public.archive_tournament_announcement(uuid) from public;
grant execute on function public.archive_tournament_announcement(uuid) to authenticated;

create or replace function public.get_operator_tournament_incidents(p_tournament_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tournament_id uuid;
begin
  if public.riftcore_operator_role() is null then
    raise exception 'Operator access required.' using errcode = '42501';
  end if;

  select id into v_tournament_id
  from public.tournaments
  where slug = p_tournament_slug;

  if v_tournament_id is null then
    raise exception 'Tournament not found.' using errcode = 'P0002';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', incident.id,
        'matchId', incident.match_id,
        'severity', incident.severity,
        'category', incident.category,
        'title', incident.title,
        'description', incident.description,
        'status', incident.status,
        'createdAt', incident.created_at,
        'resolvedAt', incident.resolved_at
      )
      order by
        case incident.status when 'open' then 0 else 1 end,
        case incident.severity when 'critical' then 0 when 'important' then 1 else 2 end,
        incident.created_at desc
    )
    from public.tournament_incidents incident
    where incident.tournament_id = v_tournament_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_operator_tournament_incidents(text) from public;
grant execute on function public.get_operator_tournament_incidents(text) to authenticated;

create or replace function public.record_tournament_incident(
  p_tournament_slug text,
  p_match_id uuid,
  p_severity text,
  p_category text,
  p_title text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_tournament_id uuid;
begin
  v_role := public.riftcore_operator_role();
  if v_role not in ('owner','admin','referee') then
    raise exception 'Operator access required.' using errcode = '42501';
  end if;

  if p_severity not in ('normal','important','critical') then
    raise exception 'Invalid incident severity.' using errcode = '22023';
  end if;

  if p_category not in ('match','lobby','no_show','connectivity','conduct','score','other') then
    raise exception 'Invalid incident category.' using errcode = '22023';
  end if;

  select id into v_tournament_id
  from public.tournaments
  where slug = p_tournament_slug;

  if v_tournament_id is null then
    raise exception 'Tournament not found.' using errcode = 'P0002';
  end if;

  if p_match_id is not null and not exists (
    select 1 from public.tournament_matches
    where id = p_match_id and tournament_id = v_tournament_id
  ) then
    raise exception 'Incident match does not belong to this tournament.' using errcode = '22023';
  end if;

  insert into public.tournament_incidents (
    tournament_id,
    match_id,
    severity,
    category,
    title,
    description,
    created_by_user_id
  ) values (
    v_tournament_id,
    p_match_id,
    p_severity,
    p_category,
    btrim(p_title),
    btrim(p_description),
    auth.uid()
  );

  insert into public.operator_audit_log (
    actor_user_id, tournament_id, action, after_state
  ) values (
    auth.uid(), v_tournament_id, 'tournament.incident_created',
    jsonb_build_object(
      'severity', p_severity,
      'category', p_category,
      'title', btrim(p_title),
      'matchId', p_match_id
    )
  );

  return public.get_operator_tournament_incidents(p_tournament_slug);
end;
$$;

revoke all on function public.record_tournament_incident(text,uuid,text,text,text,text) from public;
grant execute on function public.record_tournament_incident(text,uuid,text,text,text,text) to authenticated;

create or replace function public.resolve_tournament_incident(p_incident_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_tournament_id uuid;
begin
  v_role := public.riftcore_operator_role();
  if v_role not in ('owner','admin','referee') then
    raise exception 'Operator access required.' using errcode = '42501';
  end if;

  update public.tournament_incidents
  set status = 'resolved',
      resolved_by_user_id = auth.uid(),
      resolved_at = now()
  where id = p_incident_id
    and status = 'open'
  returning tournament_id into v_tournament_id;

  if v_tournament_id is null then
    raise exception 'Open incident not found.' using errcode = 'P0002';
  end if;

  insert into public.operator_audit_log (
    actor_user_id, tournament_id, action, after_state
  ) values (
    auth.uid(), v_tournament_id, 'tournament.incident_resolved',
    jsonb_build_object('incidentId', p_incident_id)
  );
end;
$$;

revoke all on function public.resolve_tournament_incident(uuid) from public;
grant execute on function public.resolve_tournament_incident(uuid) to authenticated;

create or replace function public.get_operator_activity_feed(p_tournament_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tournament_id uuid;
begin
  if public.riftcore_operator_role() is null then
    raise exception 'Operator access required.' using errcode = '42501';
  end if;

  select id into v_tournament_id
  from public.tournaments
  where slug = p_tournament_slug;

  if v_tournament_id is null then
    raise exception 'Tournament not found.' using errcode = 'P0002';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', activity.id,
        'action', activity.action,
        'afterState', activity.after_state,
        'createdAt', activity.created_at
      )
      order by activity.created_at desc
    )
    from (
      select *
      from public.operator_audit_log
      where tournament_id = v_tournament_id
      order by created_at desc
      limit 30
    ) activity
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_operator_activity_feed(text) from public;
grant execute on function public.get_operator_activity_feed(text) to authenticated;

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
      status = 'final',
      completed_at = now()
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
