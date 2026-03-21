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
    v_trip.customer_id,
    v_trip.pickup_location,
    v_trip.dropoff_location,
    v_trip.vehicle_type,
    v_trip.price,
    v_trip.distance_miles,
    v_trip.items,
    v_trip.scheduled_time,
    'pending',
    null,
    null,
    null,
    null,
    v_trip.expires_at,
    v_trip.pickup_photos,
    v_trip.dropoff_photos,
    v_trip.stripe_payment_intent_id,
    v_trip.insurance_quote_id,
    v_trip.insurance_booking_id,
    v_trip.insurance_premium,
    v_trip.insurance_status,
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
    v_now,
    v_now
  )
  returning * into v_requeued_trip;

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
  v_new_trip_id uuid;
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

    update public.driver_request_offers
    set
      status = 'expired',
      responded_at = coalesce(responded_at, v_now),
      response_source = coalesce(response_source, 'scheduled_checkin_expired'),
      expires_at = coalesce(expires_at, v_now),
      updated_at = v_now
    where trip_id = v_trip.id
      and driver_id = v_trip.driver_id
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
      v_trip.customer_id,
      v_trip.pickup_location,
      v_trip.dropoff_location,
      v_trip.vehicle_type,
      v_trip.price,
      v_trip.distance_miles,
      v_trip.items,
      v_trip.scheduled_time,
      'pending',
      null,
      null,
      null,
      null,
      v_trip.expires_at,
      v_trip.pickup_photos,
      v_trip.dropoff_photos,
      v_trip.stripe_payment_intent_id,
      v_trip.insurance_quote_id,
      v_trip.insurance_booking_id,
      v_trip.insurance_premium,
      v_trip.insurance_status,
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
      v_now,
      v_now
    )
    returning id into v_new_trip_id;

    if v_new_trip_id is not null and v_trip.driver_id is not null then
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
        v_new_trip_id,
        v_trip.driver_id,
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
