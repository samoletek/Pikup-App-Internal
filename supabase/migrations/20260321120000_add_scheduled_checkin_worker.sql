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

create or replace function public.create_requeued_pending_trip(
  p_source_trip public.trips,
  p_now timestamptz default now()
)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trips%rowtype;
begin
  insert into public.trips (
    customer_id,
    pickup_location,
    dropoff_location,
    vehicle_type,
    price,
    distance_miles,
    items,
    scheduled_time,
    status,
    driver_id,
    driver_location,
    viewing_driver_id,
    viewed_at,
    expires_at,
    pickup_photos,
    dropoff_photos,
    stripe_payment_intent_id,
    insurance_quote_id,
    insurance_booking_id,
    insurance_premium,
    insurance_status,
    accepted_at,
    arrived_at_pickup_at,
    in_progress_at,
    picked_up_at,
    en_route_to_dropoff_at,
    arrived_at_dropoff_at,
    completed_at,
    cancelled_at,
    cancelled_by,
    cancellation_reason,
    driver_checkin_status,
    driver_checkin_required_at,
    driver_checkin_deadline_at,
    driver_checkin_confirmed_at,
    driver_checkin_declined_at,
    created_at,
    updated_at
  )
  values (
    p_source_trip.customer_id,
    p_source_trip.pickup_location,
    p_source_trip.dropoff_location,
    p_source_trip.vehicle_type,
    p_source_trip.price,
    p_source_trip.distance_miles,
    p_source_trip.items,
    p_source_trip.scheduled_time,
    'pending',
    null,
    null,
    null,
    null,
    p_source_trip.expires_at,
    p_source_trip.pickup_photos,
    p_source_trip.dropoff_photos,
    p_source_trip.stripe_payment_intent_id,
    p_source_trip.insurance_quote_id,
    p_source_trip.insurance_booking_id,
    p_source_trip.insurance_premium,
    p_source_trip.insurance_status,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    p_now,
    p_now
  )
  returning * into v_trip;

  return v_trip;
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
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'scheduled_checkin_declined');
  v_trip public.trips%rowtype;
  v_requeued_trip public.trips%rowtype;
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

  select *
  into v_trip
  from public.trips
  where id = p_trip_id
    and status = 'accepted'
    and driver_id = p_driver_id
  for update;

  if not found then
    return;
  end if;

  update public.driver_request_offers
  set
    status = 'declined',
    responded_at = coalesce(responded_at, v_now),
    response_source = coalesce(response_source, v_reason),
    expires_at = coalesce(expires_at, v_now),
    updated_at = v_now
  where trip_id = v_trip.id
    and driver_id = p_driver_id
    and status in ('offered', 'accepted');

  update public.trips
  set
    status = 'cancelled',
    cancelled_at = v_now,
    cancelled_by = 'driver',
    cancellation_reason = v_reason,
    driver_checkin_status = 'declined',
    driver_checkin_declined_at = v_now,
    driver_checkin_confirmed_at = null,
    driver_checkin_required_at = null,
    driver_checkin_deadline_at = null,
    updated_at = v_now
  where id = v_trip.id;

  v_requeued_trip := public.create_requeued_pending_trip(v_trip, v_now);

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
    v_requeued_trip.id,
    p_driver_id,
    'scheduled',
    'declined',
    v_now,
    v_now,
    v_now,
    v_reason,
    v_now,
    v_now
  )
  on conflict (trip_id, driver_id) do update
  set
    status = 'declined',
    responded_at = excluded.responded_at,
    response_source = excluded.response_source,
    expires_at = excluded.expires_at,
    updated_at = excluded.updated_at;

  return query
  select *
  from public.trips
  where id = v_requeued_trip.id;
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
  v_trip public.trips%rowtype;
  v_requeued_trip public.trips%rowtype;
  v_previous_driver_id uuid;
begin
  for v_trip in
    select *
    from public.trips
    where status = 'accepted'
      and scheduled_time is not null
      and coalesce(driver_checkin_status, 'pending') = 'pending'
      and driver_checkin_deadline_at is not null
      and driver_checkin_deadline_at <= v_now
    for update skip locked
  loop
    v_expired_count := v_expired_count + 1;
    v_previous_driver_id := v_trip.driver_id;

    update public.driver_request_offers
    set
      status = 'expired',
      responded_at = coalesce(responded_at, v_now),
      response_source = coalesce(response_source, 'scheduled_checkin_expired'),
      expires_at = coalesce(expires_at, v_now),
      updated_at = v_now
    where trip_id = v_trip.id
      and driver_id = v_previous_driver_id
      and status in ('offered', 'accepted');

    update public.trips
    set
      status = 'cancelled',
      cancelled_at = v_now,
      cancelled_by = 'system',
      cancellation_reason = 'scheduled_checkin_expired',
      driver_checkin_status = 'expired',
      driver_checkin_declined_at = coalesce(driver_checkin_declined_at, v_now),
      driver_checkin_confirmed_at = null,
      driver_checkin_required_at = null,
      driver_checkin_deadline_at = null,
      updated_at = v_now
    where id = v_trip.id;

    v_requeued_trip := public.create_requeued_pending_trip(v_trip, v_now);

    if v_previous_driver_id is not null then
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
        v_requeued_trip.id,
        v_previous_driver_id,
        'scheduled',
        'expired',
        v_now,
        v_now,
        v_now,
        'scheduled_checkin_expired',
        v_now,
        v_now
      )
      on conflict (trip_id, driver_id) do update
      set
        status = 'expired',
        responded_at = excluded.responded_at,
        response_source = excluded.response_source,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at;
    end if;
  end loop;

  return v_expired_count;
end;
$$;

create or replace function public.run_scheduled_trip_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired integer := 0;
begin
  v_expired := coalesce(public.expire_overdue_scheduled_checkins(), 0);

  return jsonb_build_object(
    'success', true,
    'expiredScheduledCheckins', v_expired,
    'ranAt', now()
  );
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  begin
    create extension if not exists pg_cron with schema extensions;
  exception
    when others then
      raise notice 'Unable to ensure pg_cron extension: %', sqlerrm;
  end;

  begin
    for v_job_id in
      select jobid
      from cron.job
      where jobname = 'scheduled_trip_checkin_maintenance'
    loop
      perform cron.unschedule(v_job_id);
    end loop;

    perform cron.schedule(
      'scheduled_trip_checkin_maintenance',
      '* * * * *',
      $cron$select public.run_scheduled_trip_maintenance();$cron$
    );
  exception
    when undefined_table or invalid_schema_name or undefined_function then
      raise notice 'pg_cron objects unavailable; scheduled_trip_checkin_maintenance was not scheduled';
  end;
end
$$;

grant execute on function public.accept_trip_request(uuid, uuid, text) to authenticated;
grant execute on function public.confirm_scheduled_trip_checkin(uuid, uuid, text) to authenticated;
grant execute on function public.decline_scheduled_trip_checkin(uuid, uuid, text) to authenticated;
grant execute on function public.expire_overdue_scheduled_checkins() to service_role;
grant execute on function public.run_scheduled_trip_maintenance() to service_role;

drop function if exists public.accept_trip_request(uuid, uuid);
