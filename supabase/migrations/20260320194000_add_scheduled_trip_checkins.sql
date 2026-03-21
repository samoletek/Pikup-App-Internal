alter table if exists public.trips
  add column if not exists accepted_at timestamptz;

alter table if exists public.trips
  add column if not exists driver_checkin_status text;

alter table if exists public.trips
  add column if not exists driver_checkin_required_at timestamptz;

alter table if exists public.trips
  add column if not exists driver_checkin_deadline_at timestamptz;

alter table if exists public.trips
  add column if not exists driver_checkin_confirmed_at timestamptz;

alter table if exists public.trips
  add column if not exists driver_checkin_declined_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trips_driver_checkin_status_check'
  ) then
    alter table public.trips
      add constraint trips_driver_checkin_status_check
      check (
        driver_checkin_status is null
        or driver_checkin_status in ('pending', 'confirmed', 'declined', 'expired', 'not_required')
      );
  end if;
end
$$;

create index if not exists trips_driver_checkin_deadline_idx
  on public.trips(status, driver_checkin_status, driver_checkin_deadline_at);

create or replace function public.compute_scheduled_trip_checkin_required_at(
  p_scheduled_time timestamptz,
  p_accepted_at timestamptz
)
returns timestamptz
language plpgsql
stable
as $$
declare
  v_lead_hours numeric;
  v_target timestamptz;
begin
  if p_scheduled_time is null or p_accepted_at is null then
    return null;
  end if;

  v_lead_hours := extract(epoch from (p_scheduled_time - p_accepted_at)) / 3600.0;

  if v_lead_hours < 24 then
    v_target := p_scheduled_time - interval '12 hours';
    return greatest(v_target, p_accepted_at);
  end if;

  return p_scheduled_time - interval '24 hours';
end;
$$;

create or replace function public.accept_trip_request(
  p_trip_id uuid,
  p_driver_id uuid,
  p_idempotency_key text default null
)
returns setof public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_now timestamptz := now();
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if p_driver_id is null then
    raise exception 'Driver id is required';
  end if;

  if v_actor_id <> p_driver_id then
    raise exception 'Authenticated driver does not match requested driver id'
      using errcode = '42501';
  end if;

  return query
  update public.trips
  set
    status = 'accepted',
    driver_id = p_driver_id,
    accepted_at = v_now,
    driver_checkin_required_at = case
      when scheduled_time is not null and scheduled_time > v_now
        then public.compute_scheduled_trip_checkin_required_at(scheduled_time, v_now)
      else null
    end,
    driver_checkin_deadline_at = case
      when scheduled_time is not null and scheduled_time > v_now
        then public.compute_scheduled_trip_checkin_required_at(scheduled_time, v_now)
      else null
    end,
    driver_checkin_status = case
      when scheduled_time is not null and scheduled_time > v_now then 'pending'
      else 'not_required'
    end,
    driver_checkin_confirmed_at = null,
    driver_checkin_declined_at = null,
    updated_at = v_now
  where id = p_trip_id
    and status = 'pending'
    and (driver_id is null or driver_id = p_driver_id)
  returning *;
end;
$$;

create or replace function public.confirm_scheduled_trip_checkin(
  p_trip_id uuid,
  p_driver_id uuid,
  p_idempotency_key text default null
)
returns setof public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_now timestamptz := now();
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if p_driver_id is null then
    raise exception 'Driver id is required';
  end if;

  if v_actor_id <> p_driver_id then
    raise exception 'Authenticated driver does not match requested driver id'
      using errcode = '42501';
  end if;

  return query
  update public.trips
  set
    driver_checkin_status = 'confirmed',
    driver_checkin_confirmed_at = v_now,
    updated_at = v_now
  where id = p_trip_id
    and status = 'accepted'
    and driver_id = p_driver_id
    and coalesce(driver_checkin_status, 'pending') in ('pending', 'confirmed')
  returning *;
end;
$$;

create or replace function public.decline_scheduled_trip_checkin(
  p_trip_id uuid,
  p_driver_id uuid,
  p_reason text default 'scheduled_checkin_declined'
)
returns setof public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_now timestamptz := now();
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if p_driver_id is null then
    raise exception 'Driver id is required';
  end if;

  if v_actor_id <> p_driver_id then
    raise exception 'Authenticated driver does not match requested driver id'
      using errcode = '42501';
  end if;

  update public.driver_request_offers
  set
    status = 'declined',
    responded_at = coalesce(responded_at, v_now),
    response_source = coalesce(response_source, p_reason),
    expires_at = coalesce(expires_at, v_now),
    updated_at = v_now
  where trip_id = p_trip_id
    and driver_id = p_driver_id
    and status in ('offered', 'accepted');

  return query
  update public.trips
  set
    status = 'pending',
    driver_id = null,
    accepted_at = null,
    viewing_driver_id = null,
    driver_checkin_status = 'declined',
    driver_checkin_declined_at = v_now,
    driver_checkin_confirmed_at = null,
    driver_checkin_required_at = null,
    driver_checkin_deadline_at = null,
    updated_at = v_now
  where id = p_trip_id
    and status = 'accepted'
    and driver_id = p_driver_id
  returning *;
end;
$$;

create or replace function public.expire_overdue_scheduled_checkins()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_expired_count integer := 0;
begin
  select count(*)
  into v_expired_count
  from public.trips
  where status = 'accepted'
    and scheduled_time is not null
    and coalesce(driver_checkin_status, 'pending') = 'pending'
    and driver_checkin_deadline_at is not null
    and driver_checkin_deadline_at <= v_now;

  if v_expired_count = 0 then
    return 0;
  end if;

  with candidate_trips as (
    select id, driver_id
    from public.trips
    where status = 'accepted'
      and scheduled_time is not null
      and coalesce(driver_checkin_status, 'pending') = 'pending'
      and driver_checkin_deadline_at is not null
      and driver_checkin_deadline_at <= v_now
  ),
  expired_trips as (
    update public.trips as trips
    set
      status = 'pending',
      driver_id = null,
      accepted_at = null,
      viewing_driver_id = null,
      driver_checkin_status = 'expired',
      driver_checkin_declined_at = coalesce(trips.driver_checkin_declined_at, v_now),
      driver_checkin_confirmed_at = null,
      driver_checkin_required_at = null,
      driver_checkin_deadline_at = null,
      updated_at = v_now
    from candidate_trips
    where trips.id = candidate_trips.id
    returning candidate_trips.id as trip_id, candidate_trips.driver_id as previous_driver_id
  )
  update public.driver_request_offers as offers
  set
    status = 'expired',
    responded_at = coalesce(offers.responded_at, v_now),
    response_source = coalesce(offers.response_source, 'scheduled_checkin_expired'),
    expires_at = coalesce(offers.expires_at, v_now),
    updated_at = v_now
  from expired_trips
  where offers.trip_id = expired_trips.trip_id
    and offers.driver_id = expired_trips.previous_driver_id
    and offers.status in ('offered', 'accepted');

  return v_expired_count;
end;
$$;
