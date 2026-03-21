create or replace function public.resolve_trip_estimated_duration_minutes(
  p_trip public.trips
)
returns integer
language plpgsql
stable
as $$
declare
  v_pickup jsonb := coalesce(p_trip.pickup_location, '{}'::jsonb);
  v_dropoff jsonb := coalesce(p_trip.dropoff_location, '{}'::jsonb);
  v_pickup_details jsonb := coalesce(v_pickup->'details', '{}'::jsonb);
  v_dropoff_details jsonb := coalesce(v_dropoff->'details', '{}'::jsonb);
  v_dispatch jsonb := coalesce(
    p_trip.dispatch_requirements,
    v_pickup->'dispatchRequirements',
    v_pickup_details->'dispatchRequirements',
    '{}'::jsonb
  );
  v_items_count integer := coalesce(jsonb_array_length(coalesce(p_trip.items, '[]'::jsonb)), 0);
  v_distance_miles numeric := greatest(coalesce(p_trip.distance_miles, 0), 0);
  v_help_requested boolean := false;
  v_estimated integer := null;
begin
  begin
    if coalesce(v_dispatch->>'estimatedDurationMinutes', '') <> '' then
      v_estimated := greatest(0, round((v_dispatch->>'estimatedDurationMinutes')::numeric)::integer);
    end if;
  exception
    when others then
      v_estimated := null;
  end;

  if v_estimated is null then
    begin
      if coalesce(v_pickup_details->>'estimatedDurationMinutes', '') <> '' then
        v_estimated := greatest(0, round((v_pickup_details->>'estimatedDurationMinutes')::numeric)::integer);
      end if;
    exception
      when others then
        v_estimated := null;
    end;
  end if;

  v_help_requested := (
    coalesce(lower(v_pickup_details->>'driverHelpsLoading'), 'false') in ('true', '1', 'yes')
    or coalesce(lower(v_pickup_details->>'driverHelp'), 'false') in ('true', '1', 'yes')
    or coalesce(lower(v_dropoff_details->>'driverHelpsUnloading'), 'false') in ('true', '1', 'yes')
    or coalesce(lower(v_dropoff_details->>'driverHelp'), 'false') in ('true', '1', 'yes')
  );

  if v_estimated is null or v_estimated <= 0 then
    v_estimated := (
      25
      + ceil(v_distance_miles * 4.0)::integer
      + least(v_items_count, 8) * 3
      + case when v_help_requested then 20 else 0 end
    );
  end if;

  return least(greatest(v_estimated, 30), 240);
end;
$$;

create or replace function public.resolve_trip_schedule_window(
  p_trip public.trips
)
returns tstzrange
language plpgsql
stable
as $$
declare
  v_scheduled_at timestamptz := p_trip.scheduled_time;
  v_distance_miles numeric := greatest(coalesce(p_trip.distance_miles, 0), 0);
  v_lead_minutes integer := least(greatest(10, ceil(v_distance_miles * 2.0)::integer), 90);
  v_duration_minutes integer := public.resolve_trip_estimated_duration_minutes(p_trip);
  v_buffer_minutes integer := 10;
  v_window_start timestamptz;
  v_window_end timestamptz;
begin
  if v_scheduled_at is null then
    return null;
  end if;

  v_window_start := v_scheduled_at - make_interval(mins => v_lead_minutes + v_buffer_minutes);
  v_window_end := v_scheduled_at + make_interval(mins => v_duration_minutes + v_buffer_minutes);

  return tstzrange(v_window_start, v_window_end, '[)');
end;
$$;

create or replace function public.driver_has_scheduled_trip_conflict(
  p_driver_id uuid,
  p_candidate_trip public.trips
)
returns boolean
language plpgsql
stable
as $$
declare
  v_candidate_window tstzrange;
begin
  if p_driver_id is null or p_candidate_trip.scheduled_time is null then
    return false;
  end if;

  v_candidate_window := public.resolve_trip_schedule_window(p_candidate_trip);
  if v_candidate_window is null then
    return false;
  end if;

  return exists (
    select 1
    from public.trips t
    where t.driver_id = p_driver_id
      and t.id <> p_candidate_trip.id
      and t.status in (
        'accepted',
        'in_progress',
        'arrived_at_pickup',
        'picked_up',
        'en_route_to_dropoff',
        'arrived_at_dropoff'
      )
      and t.scheduled_time is not null
      and t.scheduled_time >= (p_candidate_trip.scheduled_time - interval '12 hours')
      and t.scheduled_time <= (p_candidate_trip.scheduled_time + interval '12 hours')
      and public.resolve_trip_schedule_window(t) && v_candidate_window
  );
end;
$$;

create index if not exists trips_driver_status_schedule_idx
  on public.trips(driver_id, status, scheduled_time);

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
  v_trip public.trips%rowtype;
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
    and status = 'pending'
    and (driver_id is null or driver_id = p_driver_id)
  for update;

  if not found then
    return;
  end if;

  if v_trip.scheduled_time is not null and v_trip.scheduled_time > v_now then
    if public.driver_has_scheduled_trip_conflict(p_driver_id, v_trip) then
      raise exception 'Scheduled trip conflicts with your accepted schedule';
    end if;
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
        then public.compute_scheduled_trip_checkin_required_at(scheduled_time, v_now) + interval '30 minutes'
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
