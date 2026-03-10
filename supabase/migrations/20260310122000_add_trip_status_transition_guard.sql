create or replace function public.normalize_trip_status_value(p_status text)
returns text
language plpgsql
immutable
as $$
declare
  v_status text := lower(
    replace(
      replace(
        regexp_replace(trim(coalesce(p_status, '')), '([a-z0-9])([A-Z])', '\1_\2', 'g'),
        '-',
        '_'
      ),
      ' ',
      '_'
    )
  );
begin
  if v_status = '' then
    return '';
  end if;

  return case v_status
    when 'inprogress' then 'in_progress'
    when 'arrivedatpickup' then 'arrived_at_pickup'
    when 'pickedup' then 'picked_up'
    when 'enroutetodropoff' then 'en_route_to_dropoff'
    when 'arrivedatdropoff' then 'arrived_at_dropoff'
    when 'canceled' then 'cancelled'
    else v_status
  end;
end;
$$;

create or replace function public.is_trip_status_transition_allowed(
  p_from_status text,
  p_to_status text
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_from text := public.normalize_trip_status_value(p_from_status);
  v_to text := public.normalize_trip_status_value(p_to_status);
begin
  if v_to = '' then
    return false;
  end if;

  if v_from = '' then
    -- Allow recovery from legacy/unknown rows where previous status is empty.
    return true;
  end if;

  if v_from = v_to then
    return true;
  end if;

  if v_from not in (
    'pending',
    'accepted',
    'in_progress',
    'arrived_at_pickup',
    'picked_up',
    'en_route_to_dropoff',
    'arrived_at_dropoff',
    'completed',
    'cancelled'
  ) then
    -- Preserve compatibility for legacy values; we still normalize destination.
    return true;
  end if;

  case v_from
    when 'pending' then
      return v_to in ('accepted', 'cancelled');
    when 'accepted' then
      return v_to in ('in_progress', 'arrived_at_pickup', 'picked_up', 'cancelled');
    when 'in_progress' then
      return v_to in ('arrived_at_pickup', 'picked_up', 'cancelled');
    when 'arrived_at_pickup' then
      return v_to in ('picked_up', 'cancelled');
    when 'picked_up' then
      return v_to in ('en_route_to_dropoff', 'arrived_at_dropoff', 'completed', 'cancelled');
    when 'en_route_to_dropoff' then
      return v_to in ('arrived_at_dropoff', 'completed', 'cancelled');
    when 'arrived_at_dropoff' then
      return v_to in ('completed', 'cancelled');
    when 'completed' then
      return false;
    when 'cancelled' then
      return false;
    else
      return true;
  end case;
end;
$$;

create or replace function public.enforce_trip_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text := public.normalize_trip_status_value(old.status);
  v_new text := public.normalize_trip_status_value(new.status);
begin
  if v_old = v_new then
    new.status := v_new;
    return new;
  end if;

  if not public.is_trip_status_transition_allowed(v_old, v_new) then
    raise exception 'Invalid trip status transition: % -> %', coalesce(old.status, 'null'), coalesce(new.status, 'null')
      using errcode = '23514';
  end if;

  new.status := v_new;
  return new;
end;
$$;

drop trigger if exists enforce_trip_status_transition on public.trips;
create trigger enforce_trip_status_transition
before update of status on public.trips
for each row
execute function public.enforce_trip_status_transition();
