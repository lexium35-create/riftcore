create table if not exists public.operator_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null check (role in ('owner','admin','referee')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operator_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  tournament_id uuid references public.tournaments(id) on delete set null,
  registration_id uuid references public.team_registrations(id) on delete set null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists operator_audit_actor_idx
  on public.operator_audit_log(actor_user_id, created_at desc);

create index if not exists operator_audit_registration_idx
  on public.operator_audit_log(registration_id, created_at desc);

drop trigger if exists operator_profiles_set_updated_at on public.operator_profiles;
create trigger operator_profiles_set_updated_at
before update on public.operator_profiles
for each row execute function public.riftcore_set_updated_at();

alter table public.operator_profiles enable row level security;
alter table public.operator_audit_log enable row level security;

revoke all on public.operator_profiles from anon, authenticated;
revoke all on public.operator_audit_log from anon, authenticated;

create or replace function public.riftcore_operator_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select profile.role
  from public.operator_profiles profile
  where profile.user_id = auth.uid()
    and profile.active = true
  limit 1;
$$;

revoke all on function public.riftcore_operator_role() from public;
grant execute on function public.riftcore_operator_role() to authenticated;

create or replace function public.get_my_operator_profile()
returns table (
  user_id uuid,
  display_name text,
  role text,
  active boolean
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
  select profile.user_id, profile.display_name, profile.role, profile.active
  from public.operator_profiles profile
  where profile.user_id = auth.uid()
    and profile.active = true;
end;
$$;

revoke all on function public.get_my_operator_profile() from public;
grant execute on function public.get_my_operator_profile() to authenticated;

create or replace function public.list_tournament_registrations(
  p_tournament_slug text
)
returns table (
  registration_id uuid,
  team_name text,
  team_tag text,
  captain_contact text,
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
          'rosterRole', player.roster_role,
          'isCaptain', player.is_captain
        )
        order by
          case when player.roster_role = 'starter' then 0 else 1 end,
          player.created_at
      ) filter (where player.id is not null),
      '[]'::jsonb
    ) as players
  from public.team_registrations registration
  join public.tournaments tournament
    on tournament.id = registration.tournament_id
  left join public.registration_players player
    on player.registration_id = registration.id
  where tournament.slug = p_tournament_slug
  group by registration.id
  order by registration.created_at asc;
end;
$$;

revoke all on function public.list_tournament_registrations(text) from public;
grant execute on function public.list_tournament_registrations(text) to authenticated;

create or replace function public.set_registration_status(
  p_registration_id uuid,
  p_status text
)
returns table (
  registration_id uuid,
  registration_status text,
  checked_in boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_before public.team_registrations%rowtype;
  v_after public.team_registrations%rowtype;
begin
  v_role := public.riftcore_operator_role();

  if v_role is null then
    raise exception 'Operator access required.' using errcode = '42501';
  end if;

  if v_role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can change registration status.'
      using errcode = '42501';
  end if;

  if p_status not in ('pending','verified','rejected','withdrawn') then
    raise exception 'Invalid registration status.' using errcode = '22023';
  end if;

  select *
    into v_before
    from public.team_registrations
   where id = p_registration_id
   for update;

  if not found then
    raise exception 'Registration not found.' using errcode = 'P0002';
  end if;

  if v_before.status = p_status then
    return query
    select v_before.id, v_before.status, v_before.checked_in, v_before.updated_at;
    return;
  end if;

  if not (
    (v_before.status = 'pending' and p_status in ('verified','rejected','withdrawn'))
    or (v_before.status = 'verified' and p_status in ('pending','rejected','withdrawn'))
    or (v_before.status = 'rejected' and p_status = 'pending')
    or (v_before.status = 'withdrawn' and p_status = 'pending')
  ) then
    raise exception 'Invalid registration transition: % -> %', v_before.status, p_status
      using errcode = '22023';
  end if;

  update public.team_registrations
     set status = p_status,
         checked_in = case when p_status = 'verified' then checked_in else false end
   where id = p_registration_id
  returning * into v_after;

  insert into public.operator_audit_log (
    actor_user_id,
    tournament_id,
    registration_id,
    action,
    before_state,
    after_state
  )
  values (
    auth.uid(),
    v_before.tournament_id,
    v_before.id,
    'registration.status_changed',
    jsonb_build_object('status', v_before.status, 'checkedIn', v_before.checked_in),
    jsonb_build_object('status', v_after.status, 'checkedIn', v_after.checked_in)
  );

  return query
  select v_after.id, v_after.status, v_after.checked_in, v_after.updated_at;
end;
$$;

revoke all on function public.set_registration_status(uuid, text) from public;
grant execute on function public.set_registration_status(uuid, text) to authenticated;

create or replace function public.set_registration_check_in(
  p_registration_id uuid,
  p_checked_in boolean
)
returns table (
  registration_id uuid,
  registration_status text,
  checked_in boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_before public.team_registrations%rowtype;
  v_after public.team_registrations%rowtype;
begin
  v_role := public.riftcore_operator_role();

  if v_role is null then
    raise exception 'Operator access required.' using errcode = '42501';
  end if;

  if v_role not in ('owner', 'admin', 'referee') then
    raise exception 'Operator role cannot manage check-in.' using errcode = '42501';
  end if;

  select *
    into v_before
    from public.team_registrations
   where id = p_registration_id
   for update;

  if not found then
    raise exception 'Registration not found.' using errcode = 'P0002';
  end if;

  if p_checked_in and v_before.status <> 'verified' then
    raise exception 'Only verified registrations can check in.'
      using errcode = '22023';
  end if;

  if v_before.checked_in = p_checked_in then
    return query
    select v_before.id, v_before.status, v_before.checked_in, v_before.updated_at;
    return;
  end if;

  update public.team_registrations
     set checked_in = p_checked_in
   where id = p_registration_id
  returning * into v_after;

  insert into public.operator_audit_log (
    actor_user_id,
    tournament_id,
    registration_id,
    action,
    before_state,
    after_state
  )
  values (
    auth.uid(),
    v_before.tournament_id,
    v_before.id,
    case
      when p_checked_in then 'registration.checked_in'
      else 'registration.check_in_reverted'
    end,
    jsonb_build_object('status', v_before.status, 'checkedIn', v_before.checked_in),
    jsonb_build_object('status', v_after.status, 'checkedIn', v_after.checked_in)
  );

  return query
  select v_after.id, v_after.status, v_after.checked_in, v_after.updated_at;
end;
$$;

revoke all on function public.set_registration_check_in(uuid, boolean) from public;
grant execute on function public.set_registration_check_in(uuid, boolean) to authenticated;

drop function if exists public.get_tournament_registration_summary(text);

create function public.get_tournament_registration_summary(
  p_tournament_slug text
)
returns table (
  total bigint,
  pending bigint,
  verified bigint,
  rejected bigint,
  withdrawn bigint,
  checked_in bigint
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
    count(registration.id) as total,
    count(registration.id) filter (where registration.status = 'pending') as pending,
    count(registration.id) filter (where registration.status = 'verified') as verified,
    count(registration.id) filter (where registration.status = 'rejected') as rejected,
    count(registration.id) filter (where registration.status = 'withdrawn') as withdrawn,
    count(registration.id) filter (where registration.checked_in = true) as checked_in
  from public.tournaments tournament
  left join public.team_registrations registration
    on registration.tournament_id = tournament.id
  where tournament.slug = p_tournament_slug;
end;
$$;

revoke all on function public.get_tournament_registration_summary(text) from public;
grant execute on function public.get_tournament_registration_summary(text) to authenticated;
