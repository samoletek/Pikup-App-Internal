create table if not exists public.trip_tips (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  payment_intent_id text not null,
  charge_id text,
  payment_method_id text not null,
  amount numeric(10, 2) not null,
  currency text not null default 'usd',
  status text not null,
  credited_to_driver_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_tips_amount_non_negative check (amount >= 0)
);

create unique index if not exists trip_tips_payment_intent_id_uidx
  on public.trip_tips(payment_intent_id);

create unique index if not exists trip_tips_trip_customer_uidx
  on public.trip_tips(trip_id, customer_id);

create index if not exists trip_tips_trip_id_idx
  on public.trip_tips(trip_id);

create index if not exists trip_tips_driver_created_at_idx
  on public.trip_tips(driver_id, created_at desc);

drop trigger if exists set_trip_tips_updated_at on public.trip_tips;
create trigger set_trip_tips_updated_at
before update on public.trip_tips
for each row execute function public.set_updated_at();

alter table public.trip_tips enable row level security;

drop policy if exists trip_tips_select_customer on public.trip_tips;
create policy trip_tips_select_customer
on public.trip_tips
for select
to authenticated
using (auth.uid() = customer_id);

drop policy if exists trip_tips_select_driver on public.trip_tips;
create policy trip_tips_select_driver
on public.trip_tips
for select
to authenticated
using (auth.uid() = driver_id);

grant select on public.trip_tips to authenticated;
