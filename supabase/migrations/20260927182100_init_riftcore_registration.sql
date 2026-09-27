create extension if not exists pgcrypto;

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  game text not null default 'MLBB' check (game = 'MLBB'),
  event_date date not null,
  timezone text not null default 'Asia/Kolkata',
  status text not null default 'draft'
    check (status in ('draft','registration','check_in','live','completed','cancelled')),
  team_size smallint not null default 5 check (team_size between 1 and 10),
  substitute_slots smallint not null default 1 check (substitute_slots between 0 and 5),
  format text,
  max_teams integer check (max_teams is null or max_teams > 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_name text not null check (char_length(btrim(team_name)) between 2 and 40),
  team_tag text check (team_tag is null or char_length(btrim(team_tag)) <= 8),
  captain_contact text not null check (char_length(btrim(captain_contact)) >= 3),
  status text not null default 'pending'
    check (status in ('pending','verified','rejected','withdrawn')),
  checked_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registration_players (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.team_registrations(id) on delete cascade,
  ign text not null check (char_length(btrim(ign)) > 0),
  mlbb_id text not null check (mlbb_id ~ '^[0-9]+$'),
  server_id text not null check (server_id ~ '^[0-9]+$'),
  roster_role text not null check (roster_role in ('starter','substitute')),
  is_captain boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists team_registrations_tournament_idx
  on public.team_registrations(tournament_id);

create index if not exists registration_players_registration_idx
  on public.registration_players(registration_id);

create index if not exists registration_players_identity_idx
  on public.registration_players(mlbb_id, server_id);

create unique index if not exists team_registrations_active_name_unique
  on public.team_registrations(tournament_id, lower(btrim(team_name)))
  where status not in ('rejected','withdrawn');

create or replace function public.riftcore_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tournaments_set_updated_at on public.tournaments;
create trigger tournaments_set_updated_at
before update on public.tournaments
for each row execute function public.riftcore_set_updated_at();

drop trigger if exists team_registrations_set_updated_at on public.team_registrations;
create trigger team_registrations_set_updated_at
before update on public.team_registrations
for each row execute function public.riftcore_set_updated_at();

alter table public.tournaments enable row level security;
alter table public.team_registrations enable row level security;
alter table public.registration_players enable row level security;

revoke all on public.tournaments from anon, authenticated;
revoke all on public.team_registrations from anon, authenticated;
revoke all on public.registration_players from anon, authenticated;

create or replace function public.submit_team_registration(
  p_tournament_slug text,
  p_team_name text,
  p_team_tag text,
  p_captain_contact text,
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
  if p_tournament_slug is null or btrim(p_tournament_slug) = '' then
    raise exception 'Tournament slug is required.' using errcode = '22023';
  end if;

  select *
    into v_tournament
    from public.tournaments
   where slug = p_tournament_slug;

  if not found then
    raise exception 'Tournament not found.' using errcode = 'P0002';
  end if;

  if v_tournament.status not in ('draft', 'registration') then
    raise exception 'Registration is not currently available.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('riftcore-registration:' || p_tournament_slug));

  if p_team_name is null
     or char_length(btrim(p_team_name)) < 2
     or char_length(btrim(p_team_name)) > 40 then
    raise exception 'Team name must be between 2 and 40 characters.' using errcode = '22023';
  end if;

  if p_team_tag is not null and char_length(btrim(p_team_tag)) > 8 then
    raise exception 'Team tag must be 8 characters or fewer.' using errcode = '22023';
  end if;

  if p_captain_contact is null or char_length(btrim(p_captain_contact)) < 3 then
    raise exception 'A captain contact method is required.' using errcode = '22023';
  end if;

  if p_players is null or jsonb_typeof(p_players) <> 'array' then
    raise exception 'Players must be provided as an array.' using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_players) player
     where nullif(btrim(player->>'ign'), '') is null
        or coalesce(player->>'mlbbId', '') !~ '^[0-9]+$'
        or coalesce(player->>'serverId', '') !~ '^[0-9]+$'
        or coalesce(player->>'rosterRole', '') not in ('starter', 'substitute')
  ) then
    raise exception 'Every player must have an IGN, numeric MLBB ID, numeric server ID and valid roster role.'
      using errcode = '22023';
  end if;

  select
    count(*) filter (where player->>'rosterRole' = 'starter'),
    count(*) filter (where player->>'rosterRole' = 'substitute'),
    count(*) filter (where coalesce((player->>'isCaptain')::boolean, false))
  into v_starters, v_substitutes, v_captains
  from jsonb_array_elements(p_players) player;

  if v_starters <> v_tournament.team_size then
    raise exception 'Exactly % starting players are required.', v_tournament.team_size
      using errcode = '22023';
  end if;

  if v_substitutes > v_tournament.substitute_slots then
    raise exception 'Too many substitutes for this tournament.' using errcode = '22023';
  end if;

  if v_captains <> 1 then
    raise exception 'Exactly one captain is required.' using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_players) player
     where coalesce((player->>'isCaptain')::boolean, false)
       and player->>'rosterRole' <> 'starter'
  ) then
    raise exception 'The captain must be a starting player.' using errcode = '22023';
  end if;

  select count(*)
    into v_duplicates
    from (
      select player->>'mlbbId', player->>'serverId'
        from jsonb_array_elements(p_players) player
       group by player->>'mlbbId', player->>'serverId'
      having count(*) > 1
    ) duplicates;

  if v_duplicates > 0 then
    raise exception 'The same MLBB account cannot appear twice on a roster.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
      from public.team_registrations registration
     where registration.tournament_id = v_tournament.id
       and registration.status not in ('rejected', 'withdrawn')
       and lower(btrim(registration.team_name)) = lower(btrim(p_team_name))
  ) then
    raise exception 'That team name is already registered for this tournament.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
      from public.registration_players existing_player
      join public.team_registrations existing_registration
        on existing_registration.id = existing_player.registration_id
     where existing_registration.tournament_id = v_tournament.id
       and existing_registration.status not in ('rejected', 'withdrawn')
       and exists (
         select 1
           from jsonb_array_elements(p_players) incoming_player
          where incoming_player->>'mlbbId' = existing_player.mlbb_id
            and incoming_player->>'serverId' = existing_player.server_id
       )
  ) then
    raise exception 'One or more MLBB accounts are already registered for this tournament.'
      using errcode = '23505';
  end if;

  if v_tournament.max_teams is not null and (
    select count(*)
      from public.team_registrations registration
     where registration.tournament_id = v_tournament.id
       and registration.status not in ('rejected', 'withdrawn')
  ) >= v_tournament.max_teams then
    raise exception 'Tournament registration is full.' using errcode = 'P0001';
  end if;

  insert into public.team_registrations (
    tournament_id,
    team_name,
    team_tag,
    captain_contact
  )
  values (
    v_tournament.id,
    btrim(p_team_name),
    nullif(btrim(p_team_tag), ''),
    btrim(p_captain_contact)
  )
  returning * into v_registration;

  insert into public.registration_players (
    registration_id,
    ign,
    mlbb_id,
    server_id,
    roster_role,
    is_captain
  )
  select
    v_registration.id,
    btrim(player->>'ign'),
    btrim(player->>'mlbbId'),
    btrim(player->>'serverId'),
    player->>'rosterRole',
    coalesce((player->>'isCaptain')::boolean, false)
  from jsonb_array_elements(p_players) player;

  return query
  select v_registration.id, v_registration.status, v_registration.created_at;
end;
$$;

create or replace function public.get_tournament_registration_summary(
  p_tournament_slug text
)
returns table (
  total bigint,
  pending bigint,
  verified bigint,
  rejected bigint,
  withdrawn bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    count(registration.id) as total,
    count(registration.id) filter (where registration.status = 'pending') as pending,
    count(registration.id) filter (where registration.status = 'verified') as verified,
    count(registration.id) filter (where registration.status = 'rejected') as rejected,
    count(registration.id) filter (where registration.status = 'withdrawn') as withdrawn
  from public.tournaments tournament
  left join public.team_registrations registration
    on registration.tournament_id = tournament.id
  where tournament.slug = p_tournament_slug;
$$;

revoke all on function public.submit_team_registration(text, text, text, text, jsonb) from public;
grant execute on function public.submit_team_registration(text, text, text, text, jsonb) to anon, authenticated;

revoke all on function public.get_tournament_registration_summary(text) from public;
grant execute on function public.get_tournament_registration_summary(text) to anon, authenticated;

insert into public.tournaments (
  slug,
  name,
  game,
  event_date,
  timezone,
  status,
  team_size,
  substitute_slots,
  format,
  max_teams
)
values (
  'riftcore-2026-10-13',
  'Riftcore — 13 October 2026',
  'MLBB',
  '2026-10-13',
  'Asia/Kolkata',
  'draft',
  5,
  1,
  null,
  null
)
on conflict (slug) do update
set
  name = excluded.name,
  game = excluded.game,
  event_date = excluded.event_date,
  timezone = excluded.timezone,
  team_size = excluded.team_size,
  substitute_slots = excluded.substitute_slots,
  updated_at = now();
