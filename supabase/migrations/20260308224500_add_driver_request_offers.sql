create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.driver_request_offers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  request_pool text not null default 'all'
    check (request_pool in ('all', 'asap', 'scheduled')),
  status text not null default 'offered'
    check (status in ('offered', 'declined', 'expired', 'accepted')),
  offered_at timestamptz not null default now(),
  expires_at timestamptz,
  responded_at timestamptz,
  response_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, driver_id)
);

create index if not exists driver_request_offers_driver_status_idx
  on public.driver_request_offers(driver_id, status, expires_at);

create index if not exists driver_request_offers_trip_status_idx
  on public.driver_request_offers(trip_id, status);

create index if not exists driver_request_offers_trip_driver_idx
  on public.driver_request_offers(trip_id, driver_id);

drop trigger if exists set_driver_request_offers_updated_at on public.driver_request_offers;
create trigger set_driver_request_offers_updated_at
before update on public.driver_request_offers
for each row execute function public.set_updated_at();

alter table public.driver_request_offers enable row level security;

drop policy if exists driver_request_offers_select_own on public.driver_request_offers;
create policy driver_request_offers_select_own
on public.driver_request_offers
for select
to authenticated
using (auth.uid() = driver_id);

drop policy if exists driver_request_offers_insert_own on public.driver_request_offers;
create policy driver_request_offers_insert_own
on public.driver_request_offers
for insert
to authenticated
with check (auth.uid() = driver_id);

drop policy if exists driver_request_offers_update_own on public.driver_request_offers;
create policy driver_request_offers_update_own
on public.driver_request_offers
for update
to authenticated
using (auth.uid() = driver_id)
with check (auth.uid() = driver_id);

grant select, insert, update on public.driver_request_offers to authenticated;

create or replace function public.sync_driver_request_offers_on_trip_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_status text := lower(coalesce(old.status, ''));
  v_new_status text := lower(coalesce(new.status, ''));
  v_now timestamptz := now();
begin
  if v_old_status = 'pending' and v_new_status <> 'pending' then
    update public.driver_request_offers
    set
      status = case
        when v_new_status = 'accepted' and driver_id = new.driver_id then 'accepted'
        else 'expired'
      end,
      responded_at = coalesce(responded_at, v_now),
      response_source = case
        when v_new_status = 'accepted' and driver_id = new.driver_id then 'trip_accepted'
        else coalesce(response_source, 'trip_status_changed')
      end,
      expires_at = case
        when v_new_status = 'accepted' and driver_id = new.driver_id then null
        else coalesce(expires_at, v_now)
      end,
      updated_at = v_now
    where trip_id = new.id and status = 'offered';

    if v_new_status = 'accepted' and new.driver_id is not null then
      insert into public.driver_request_offers (
        trip_id,
        driver_id,
        request_pool,
        status,
        offered_at,
        expires_at,
        responded_at,
        response_source,
        created_at,
        updated_at
      )
      values (
        new.id,
        new.driver_id,
        'all',
        'accepted',
        v_now,
        null,
        v_now,
        'trip_accepted',
        v_now,
        v_now
      )
      on conflict (trip_id, driver_id)
      do update set
        status = 'accepted',
        responded_at = coalesce(public.driver_request_offers.responded_at, v_now),
        expires_at = null,
        response_source = 'trip_accepted',
        updated_at = v_now;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_driver_request_offers_on_trip_status_change on public.trips;
create trigger sync_driver_request_offers_on_trip_status_change
after update of status, driver_id on public.trips
for each row
execute function public.sync_driver_request_offers_on_trip_status_change();
