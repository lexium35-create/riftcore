alter table public.team_registrations
  add column if not exists captain_email text,
  add column if not exists submitted_by_user_id uuid references auth.users(id) on delete set null;

alter table public.registration_players
  add column if not exists email text;

alter table public.user_profiles
  add column if not exists welcome_email_sent_at timestamptz;

create index if not exists team_registrations_submitted_by_idx
  on public.team_registrations(submitted_by_user_id, created_at desc);

drop function if exists public.submit_team_registration(text, text, text, text, jsonb);
drop function if exists public.submit_team_registration(text, text, text, text, text, jsonb);

create function public.submit_team_registration(
  p_tournament_slug text,
  p_team_name text,
  p_team_tag text,
  p_captain_contact text,
  p_captain_email text,
  p_players jsonb
)
returns table (
  registration_id uuid,
  registration_status text,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_registration public.team_registrations%rowtype;
  v_starters integer;
  v_substitutes integer;
  v_captains integer;
  v_duplicates integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_tournament_slug is null or btrim(p_tournament_slug) = '' then
    raise exception 'Tournament slug is required.' using errcode = '22023';
  end if;

  select * into v_tournament from public.tournaments where slug = p_tournament_slug;
  if not found then raise exception 'Tournament not found.' using errcode = 'P0002'; end if;

  if v_tournament.status not in ('draft', 'registration') then
    raise exception 'Registration is not currently available.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('riftcore-registration:' || p_tournament_slug));

  if p_team_name is null or char_length(btrim(p_team_name)) < 2 or char_length(btrim(p_team_name)) > 40 then
    raise exception 'Team name must be between 2 and 40 characters.' using errcode = '22023';
  end if;

  if p_team_tag is not null and char_length(btrim(p_team_tag)) > 8 then
    raise exception 'Team tag must be 8 characters or fewer.' using errcode = '22023';
  end if;

  if p_captain_contact is null or char_length(btrim(p_captain_contact)) < 3 then
    raise exception 'A captain contact method is required.' using errcode = '22023';
  end if;

  if p_captain_email is null or btrim(p_captain_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid captain email address is required.' using errcode = '22023';
  end if;

  if p_players is null or jsonb_typeof(p_players) <> 'array' then
    raise exception 'Players must be provided as an array.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_players) player
    where nullif(btrim(player->>'ign'), '') is null
       or coalesce(player->>'mlbbId', '') !~ '^[0-9]+$'
       or coalesce(player->>'serverId', '') !~ '^[0-9]+$'
       or coalesce(player->>'rosterRole', '') not in ('starter', 'substitute')
       or (
         nullif(btrim(coalesce(player->>'email','')), '') is not null
         and btrim(player->>'email') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       )
  ) then
    raise exception 'Every player must have valid roster data; optional emails must be valid.' using errcode = '22023';
  end if;

  select
    count(*) filter (where player->>'rosterRole' = 'starter'),
    count(*) filter (where player->>'rosterRole' = 'substitute'),
    count(*) filter (where coalesce((player->>'isCaptain')::boolean, false))
  into v_starters, v_substitutes, v_captains
  from jsonb_array_elements(p_players) player;

  if v_starters <> v_tournament.team_size then
    raise exception 'Exactly % starting players are required.', v_tournament.team_size using errcode = '22023';
  end if;

  if v_substitutes > v_tournament.substitute_slots then
    raise exception 'Too many substitutes for this tournament.' using errcode = '22023';
  end if;

  if v_captains <> 1 then
    raise exception 'Exactly one captain is required.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_players) player
    where coalesce((player->>'isCaptain')::boolean, false)
      and player->>'rosterRole' <> 'starter'
  ) then
    raise exception 'The captain must be a starting player.' using errcode = '22023';
  end if;

  select count(*) into v_duplicates
  from (
    select player->>'mlbbId', player->>'serverId'
    from jsonb_array_elements(p_players) player
    group by player->>'mlbbId', player->>'serverId'
    having count(*) > 1
  ) duplicates;

  if v_duplicates > 0 then
    raise exception 'The same MLBB account cannot appear twice on a roster.' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.team_registrations registration
    where registration.tournament_id = v_tournament.id
      and registration.status not in ('rejected', 'withdrawn')
      and lower(btrim(registration.team_name)) = lower(btrim(p_team_name))
  ) then
    raise exception 'That team name is already registered for this tournament.' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.registration_players existing_player
    join public.team_registrations existing_registration on existing_registration.id = existing_player.registration_id
    where existing_registration.tournament_id = v_tournament.id
      and existing_registration.status not in ('rejected', 'withdrawn')
      and exists (
        select 1 from jsonb_array_elements(p_players) incoming_player
        where incoming_player->>'mlbbId' = existing_player.mlbb_id
          and incoming_player->>'serverId' = existing_player.server_id
      )
  ) then
    raise exception 'One or more MLBB accounts are already registered for this tournament.' using errcode = '23505';
  end if;

  if v_tournament.max_teams is not null and (
    select count(*) from public.team_registrations registration
    where registration.tournament_id = v_tournament.id
      and registration.status not in ('rejected', 'withdrawn')
  ) >= v_tournament.max_teams then
    raise exception 'Tournament registration is full.' using errcode = 'P0001';
  end if;

  insert into public.team_registrations (
    tournament_id, team_name, team_tag, captain_contact, captain_email, submitted_by_user_id
  ) values (
    v_tournament.id,
    btrim(p_team_name),
    nullif(btrim(p_team_tag), ''),
    btrim(p_captain_contact),
    lower(btrim(p_captain_email)),
    auth.uid()
  ) returning * into v_registration;

  insert into public.registration_players (
    registration_id, ign, mlbb_id, server_id, email, roster_role, is_captain
  )
  select
    v_registration.id,
    btrim(player->>'ign'),
    btrim(player->>'mlbbId'),
    btrim(player->>'serverId'),
    lower(nullif(btrim(coalesce(player->>'email','')), '')),
    player->>'rosterRole',
    coalesce((player->>'isCaptain')::boolean, false)
  from jsonb_array_elements(p_players) player;

  return query select v_registration.id, v_registration.status, v_registration.created_at;
end;
$$;

revoke all on function public.submit_team_registration(text,text,text,text,text,jsonb) from public;
grant execute on function public.submit_team_registration(text,text,text,text,text,jsonb) to authenticated;

drop function if exists public.list_tournament_registrations(text);
create function public.list_tournament_registrations(p_tournament_slug text)
returns table (
  registration_id uuid,
  team_name text,
  team_tag text,
  captain_contact text,
  captain_email text,
  registration_status text,
  checked_in boolean,
  submitted_at timestamptz,
  players jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.riftcore_operator_role() is null then
    raise exception 'Operator access required.' using errcode = '42501';
  end if;

  return query
  select
    registration.id,
    registration.team_name,
    registration.team_tag,
    registration.captain_contact,
    registration.captain_email,
    registration.status,
    registration.checked_in,
    registration.created_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', player.id,
          'ign', player.ign,
          'mlbbId', player.mlbb_id,
          'serverId', player.server_id,
          'email', player.email,
          'rosterRole', player.roster_role,
          'isCaptain', player.is_captain
        )
        order by case when player.roster_role = 'starter' then 0 else 1 end, player.created_at
      ) filter (where player.id is not null),
      '[]'::jsonb
    )
  from public.team_registrations registration
  join public.tournaments tournament on tournament.id = registration.tournament_id
  left join public.registration_players player on player.registration_id = registration.id
  where tournament.slug = p_tournament_slug
  group by registration.id
  order by registration.created_at asc;
end;
$$;

revoke all on function public.list_tournament_registrations(text) from public;
grant execute on function public.list_tournament_registrations(text) to authenticated;

create or replace function public.get_my_registrations()
returns table (
  registration_id uuid,
  tournament_slug text,
  tournament_name text,
  tournament_date date,
  team_name text,
  team_tag text,
  registration_status text,
  checked_in boolean,
  captain_email text,
  submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  return query
  select
    registration.id,
    tournament.slug,
    tournament.name,
    tournament.event_date,
    registration.team_name,
    registration.team_tag,
    registration.status,
    registration.checked_in,
    registration.captain_email,
    registration.created_at
  from public.team_registrations registration
  join public.tournaments tournament on tournament.id = registration.tournament_id
  where registration.submitted_by_user_id = auth.uid()
  order by registration.created_at desc;
end;
$$;

revoke all on function public.get_my_registrations() from public;
grant execute on function public.get_my_registrations() to authenticated;

create or replace function public.get_registration_notification_targets(p_registration_id uuid)
returns table (
  team_name text,
  tournament_name text,
  captain_email text,
  player_emails text[],
  registration_status text,
  checked_in boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.riftcore_operator_role() is null then
    raise exception 'Operator access required.' using errcode = '42501';
  end if;

  return query
  select
    registration.team_name,
    tournament.name,
    registration.captain_email,
    coalesce(array_agg(distinct player.email) filter (where player.email is not null), array[]::text[]),
    registration.status,
    registration.checked_in
  from public.team_registrations registration
  join public.tournaments tournament on tournament.id = registration.tournament_id
  left join public.registration_players player on player.registration_id = registration.id
  where registration.id = p_registration_id
  group by registration.id, tournament.name;
end;
$$;

revoke all on function public.get_registration_notification_targets(uuid) from public;
grant execute on function public.get_registration_notification_targets(uuid) to authenticated;
