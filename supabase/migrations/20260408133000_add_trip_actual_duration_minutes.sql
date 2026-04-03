alter table if exists public.trips
  add column if not exists actual_duration_minutes integer;

create or replace function public.resolve_trip_actual_duration_minutes(
  p_trip public.trips
)
returns integer
language plpgsql
stable
as $$
declare
  v_trip jsonb := to_jsonb(p_trip);
  v_started_at timestamptz := null;
  v_completed_at timestamptz := null;
begin
  begin
    if coalesce(v_trip->>'completed_at', '') <> '' then
      v_completed_at := (v_trip->>'completed_at')::timestamptz;
    end if;
  exception
    when others then
      v_completed_at := null;
  end;

  if v_completed_at is null then
    return null;
  end if;

  begin
    if coalesce(v_trip->>'picked_up_at', '') <> '' then
      v_started_at := (v_trip->>'picked_up_at')::timestamptz;
    elsif coalesce(v_trip->>'en_route_to_dropoff_at', '') <> '' then
      v_started_at := (v_trip->>'en_route_to_dropoff_at')::timestamptz;
    elsif coalesce(v_trip->>'arrived_at_pickup_at', '') <> '' then
      v_started_at := (v_trip->>'arrived_at_pickup_at')::timestamptz;
    elsif coalesce(v_trip->>'in_progress_at', '') <> '' then
      v_started_at := (v_trip->>'in_progress_at')::timestamptz;
    end if;
  exception
    when others then
      v_started_at := null;
  end;

  if v_started_at is null or v_completed_at <= v_started_at then
    return null;
  end if;

  return greatest(1, ceil(extract(epoch from (v_completed_at - v_started_at)) / 60.0)::integer);
end;
$$;

update public.trips t
set actual_duration_minutes = public.resolve_trip_actual_duration_minutes(t)
where t.completed_at is not null
  and coalesce(t.actual_duration_minutes, 0) <= 0;
