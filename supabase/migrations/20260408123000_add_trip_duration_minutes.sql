alter table if exists public.trips
  add column if not exists duration_minutes integer;

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
  v_pricing jsonb := coalesce(v_pickup->'pricing', '{}'::jsonb);
  v_dispatch jsonb := coalesce(
    to_jsonb(p_trip)->'dispatch_requirements',
    v_pickup->'dispatchRequirements',
    v_pickup_details->'dispatchRequirements',
    '{}'::jsonb
  );
  v_items_count integer := coalesce(jsonb_array_length(coalesce(p_trip.items, '[]'::jsonb)), 0);
  v_distance_miles numeric := greatest(coalesce(p_trip.distance_miles, 0), 0);
  v_help_requested boolean := false;
  v_estimated integer := null;
begin
  if coalesce(p_trip.duration_minutes, 0) > 0 then
    v_estimated := greatest(0, p_trip.duration_minutes);
  end if;

  if v_estimated is null then
    begin
      if coalesce(v_dispatch->>'estimatedDurationMinutes', '') <> '' then
        v_estimated := greatest(0, round((v_dispatch->>'estimatedDurationMinutes')::numeric)::integer);
      end if;
    exception
      when others then
        v_estimated := null;
    end;
  end if;

  if v_estimated is null then
    begin
      if coalesce(v_pricing->>'durationMinutes', '') <> '' then
        v_estimated := greatest(0, round((v_pricing->>'durationMinutes')::numeric)::integer);
      elsif coalesce(v_pricing->>'duration_minutes', '') <> '' then
        v_estimated := greatest(0, round((v_pricing->>'duration_minutes')::numeric)::integer);
      elsif coalesce(v_pricing->>'duration', '') <> '' then
        v_estimated := greatest(0, round((v_pricing->>'duration')::numeric)::integer);
      end if;
    exception
      when others then
        v_estimated := null;
    end;
  end if;

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

update public.trips t
set duration_minutes = public.resolve_trip_estimated_duration_minutes(t)
where coalesce(t.duration_minutes, 0) <= 0;
