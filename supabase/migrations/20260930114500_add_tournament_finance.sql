create table if not exists public.tournament_finance_configs (
  tournament_id uuid primary key references public.tournaments(id) on delete cascade,
  currency text not null default 'INR',
  base_prize_pool_inr integer not null default 0 check (base_prize_pool_inr >= 0),
  join_fee_inr integer not null default 0 check (join_fee_inr >= 0),
  registration_fees_to_prize_pool boolean not null default true,
  donations_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_donations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  amount_inr integer not null check (amount_inr > 0),
  donor_name text,
  note text,
  status text not null default 'verified'
    check (status in ('pending','verified','refunded')),
  payment_reference text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tournament_id, payment_reference)
);

create index if not exists tournament_donations_tournament_idx
  on public.tournament_donations(tournament_id, status, created_at desc);

alter table public.tournament_finance_configs enable row level security;
alter table public.tournament_donations enable row level security;

drop trigger if exists tournament_finance_configs_set_updated_at on public.tournament_finance_configs;
create trigger tournament_finance_configs_set_updated_at
before update on public.tournament_finance_configs
for each row execute function public.riftcore_set_updated_at();

insert into public.tournament_finance_configs (
  tournament_id,
  currency,
  base_prize_pool_inr,
  join_fee_inr,
  registration_fees_to_prize_pool,
  donations_enabled
)
select
  tournament.id,
  'INR',
  2000,
  250,
  true,
  true
from public.tournaments tournament
where tournament.slug = 'riftcore-2026-10-13'
on conflict (tournament_id) do update
set currency = excluded.currency,
    base_prize_pool_inr = excluded.base_prize_pool_inr,
    join_fee_inr = excluded.join_fee_inr,
    registration_fees_to_prize_pool = excluded.registration_fees_to_prize_pool,
    donations_enabled = excluded.donations_enabled,
    updated_at = now();

create or replace function public.get_public_tournament_finance(p_tournament_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_config public.tournament_finance_configs%rowtype;
  v_registration_count integer;
  v_donation_total integer;
  v_donation_count integer;
  v_registration_contribution integer;
  v_current_total integer;
  v_max_total integer;
begin
  select * into v_tournament
  from public.tournaments
  where slug = p_tournament_slug;

  if not found then
    return null;
  end if;

  select * into v_config
  from public.tournament_finance_configs
  where tournament_id = v_tournament.id;

  if not found then
    return null;
  end if;

  select count(*) into v_registration_count
  from public.team_registrations registration
  where registration.tournament_id = v_tournament.id
    and registration.status not in ('rejected','withdrawn');

  select
    coalesce(sum(donation.amount_inr), 0)::integer,
    count(*)::integer
  into v_donation_total, v_donation_count
  from public.tournament_donations donation
  where donation.tournament_id = v_tournament.id
    and donation.status = 'verified';

  v_registration_contribution :=
    case when v_config.registration_fees_to_prize_pool
      then v_registration_count * v_config.join_fee_inr
      else 0
    end;

  v_current_total :=
    v_config.base_prize_pool_inr
    + v_registration_contribution
    + v_donation_total;

  v_max_total :=
    case when v_tournament.max_teams is null then null
      else v_config.base_prize_pool_inr
        + case when v_config.registration_fees_to_prize_pool
            then v_tournament.max_teams * v_config.join_fee_inr
            else 0
          end
        + v_donation_total
    end;

  return jsonb_build_object(
    'currency', v_config.currency,
    'basePrizePool', v_config.base_prize_pool_inr,
    'joinFee', v_config.join_fee_inr,
    'registrationFeesToPrizePool', v_config.registration_fees_to_prize_pool,
    'donationsEnabled', v_config.donations_enabled,
    'activeRegistrations', v_registration_count,
    'registrationContribution', v_registration_contribution,
    'donationTotal', v_donation_total,
    'donationCount', v_donation_count,
    'currentPrizePool', v_current_total,
    'maxTeams', v_tournament.max_teams,
    'projectedMaxPrizePool', v_max_total
  );
end;
$$;

revoke all on function public.get_public_tournament_finance(text) from public;
grant execute on function public.get_public_tournament_finance(text) to anon, authenticated;

create or replace function public.record_tournament_donation(
  p_tournament_slug text,
  p_amount_inr integer,
  p_donor_name text default null,
  p_note text default null,
  p_payment_reference text default null
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
  if v_role not in ('owner','admin') then
    raise exception 'Owner or admin access required.' using errcode = '42501';
  end if;

  if p_amount_inr is null or p_amount_inr <= 0 then
    raise exception 'Donation amount must be greater than zero.' using errcode = '22023';
  end if;

  select id into v_tournament_id
  from public.tournaments
  where slug = p_tournament_slug;

  if v_tournament_id is null then
    raise exception 'Tournament not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.tournament_finance_configs
    where tournament_id = v_tournament_id
      and donations_enabled = true
  ) then
    raise exception 'Donations are not enabled for this tournament.' using errcode = '22023';
  end if;

  insert into public.tournament_donations (
    tournament_id,
    amount_inr,
    donor_name,
    note,
    status,
    payment_reference,
    created_by_user_id
  ) values (
    v_tournament_id,
    p_amount_inr,
    nullif(btrim(p_donor_name), ''),
    nullif(btrim(p_note), ''),
    'verified',
    nullif(btrim(p_payment_reference), ''),
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
    'tournament.donation_recorded',
    jsonb_build_object(
      'amountInr', p_amount_inr,
      'donorName', nullif(btrim(p_donor_name), ''),
      'paymentReference', nullif(btrim(p_payment_reference), '')
    )
  );

  return public.get_public_tournament_finance(p_tournament_slug);
end;
$$;

revoke all on function public.record_tournament_donation(text,integer,text,text,text) from public;
grant execute on function public.record_tournament_donation(text,integer,text,text,text) to authenticated;
