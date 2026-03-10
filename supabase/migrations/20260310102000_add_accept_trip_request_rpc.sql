create or replace function public.accept_trip_request(
  p_trip_id uuid,
  p_driver_id uuid
)
returns setof public.trips
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_trip public.trips%rowtype;
  v_now timestamptz := now();
  v_auth_uid uuid := auth.uid();
begin
  if p_trip_id is null then
    raise exception 'p_trip_id is required' using errcode = '22023';
  end if;

  if p_driver_id is null then
    raise exception 'p_driver_id is required' using errcode = '22023';
  end if;

  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if v_auth_uid <> p_driver_id then
    raise exception 'Cannot accept trip for another driver' using errcode = '42501';
  end if;

  select *
  into v_trip
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    return;
  end if;

  if lower(coalesce(v_trip.status, '')) = 'accepted' and v_trip.driver_id = p_driver_id then
    return query
    select t.*
    from public.trips t
    where t.id = p_trip_id;
    return;
  end if;

  if lower(coalesce(v_trip.status, '')) <> 'pending' then
    return;
  end if;

  if v_trip.driver_id is not null and v_trip.driver_id <> p_driver_id then
    return;
  end if;

  update public.trips
  set
    status = 'accepted',
    driver_id = p_driver_id,
    updated_at = v_now
  where id = p_trip_id;

  if v_trip.customer_id is not null then
    insert into public.conversations (
      request_id,
      customer_id,
      driver_id,
      created_at,
      updated_at
    )
    select
      p_trip_id,
      v_trip.customer_id,
      p_driver_id,
      v_now,
      v_now
    where not exists (
      select 1
      from public.conversations c
      where c.request_id = p_trip_id
        and c.customer_id = v_trip.customer_id
        and c.driver_id = p_driver_id
    )
    on conflict do nothing;
  end if;

  return query
  select t.*
  from public.trips t
  where t.id = p_trip_id;
end;
$$;

grant execute on function public.accept_trip_request(uuid, uuid) to authenticated;
