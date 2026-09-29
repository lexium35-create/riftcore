create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (
    display_name is null
    or char_length(btrim(display_name)) between 2 and 40
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.riftcore_set_updated_at();

alter table public.user_profiles enable row level security;

revoke all on public.user_profiles from anon, authenticated;
grant select, insert, update on public.user_profiles to authenticated;

drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_profiles_insert_own on public.user_profiles;
create policy user_profiles_insert_own
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists user_profiles_update_own on public.user_profiles;
create policy user_profiles_update_own
on public.user_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.riftcore_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_profiles (user_id, display_name)
  values (
    new.id,
    nullif(
      btrim(
        coalesce(
          new.raw_user_meta_data->>'display_name',
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'name',
          ''
        )
      ),
      ''
    )
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_riftcore_profile on auth.users;
create trigger on_auth_user_created_riftcore_profile
after insert on auth.users
for each row execute function public.riftcore_handle_new_user();

insert into public.user_profiles (user_id, display_name)
select
  user_record.id,
  nullif(
    btrim(
      coalesce(
        user_record.raw_user_meta_data->>'display_name',
        user_record.raw_user_meta_data->>'full_name',
        user_record.raw_user_meta_data->>'name',
        ''
      )
    ),
    ''
  )
from auth.users user_record
on conflict (user_id) do nothing;
