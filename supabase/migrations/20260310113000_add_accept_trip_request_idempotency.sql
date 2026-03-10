create table if not exists public.driver_dispatch_idempotency (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  action text not null check (action in ('accept', 'decline')),
  idempotency_key text not null,
  response_status text not null default 'pending',
  response_trip_id uuid references public.trips(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, action, idempotency_key)
);

create index if not exists driver_dispatch_idempotency_driver_action_trip_idx
  on public.driver_dispatch_idempotency(driver_id, action, trip_id);

drop trigger if exists set_driver_dispatch_idempotency_updated_at on public.driver_dispatch_idempotency;
create trigger set_driver_dispatch_idempotency_updated_at
before update on public.driver_dispatch_idempotency
for each row execute function public.set_updated_at();

drop function if exists public.accept_trip_request(uuid, uuid);
drop function if exists public.accept_trip_request(uuid, uuid, text);

create or replace function public.accept_trip_request(
  p_trip_id uuid,
  p_driver_id uuid,
  p_idempotency_key text default null
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
  v_normalized_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_idempotency_row public.driver_dispatch_idempotency%rowtype;
  v_response_status text := 'unavailable';
  v_response_trip_id uuid := null;
  v_should_return_trip boolean := false;
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

  if v_normalized_key is not null and length(v_normalized_key) > 128 then
    raise exception 'Idempotency key is too long' using errcode = '22023';
  end if;

  if v_normalized_key is not null then
    insert into public.driver_dispatch_idempotency (
      driver_id,
      trip_id,
      action,
      idempotency_key,
      response_status,
      created_at,
      updated_at
    )
    values (
      p_driver_id,
      p_trip_id,
      'accept',
      v_normalized_key,
      'pending',
      v_now,
      v_now
    )
    on conflict (driver_id, action, idempotency_key) do nothing;

    select *
    into v_idempotency_row
    from public.driver_dispatch_idempotency
    where driver_id = p_driver_id
      and action = 'accept'
      and idempotency_key = v_normalized_key
    for update;

    if not found then
      raise exception 'Failed to lock idempotency row' using errcode = '55000';
    end if;

    if v_idempotency_row.trip_id <> p_trip_id then
      raise exception 'Idempotency key already used for another trip' using errcode = '23505';
    end if;

    if v_idempotency_row.response_status <> 'pending' then
      if v_idempotency_row.response_trip_id is not null then
        return query
        select t.*
        from public.trips t
        where t.id = v_idempotency_row.response_trip_id;
      end if;
      return;
    end if;
  end if;

  select *
  into v_trip
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    v_response_status := 'not_found';
  elsif lower(coalesce(v_trip.status, '')) = 'accepted' and v_trip.driver_id = p_driver_id then
    v_response_status := 'accepted';
    v_response_trip_id := p_trip_id;
    v_should_return_trip := true;
  elsif lower(coalesce(v_trip.status, '')) <> 'pending' then
    v_response_status := 'unavailable';
  elsif v_trip.driver_id is not null and v_trip.driver_id <> p_driver_id then
    v_response_status := 'unavailable';
  else
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

    v_response_status := 'accepted';
    v_response_trip_id := p_trip_id;
    v_should_return_trip := true;
  end if;

  if v_normalized_key is not null then
    update public.driver_dispatch_idempotency
    set
      response_status = v_response_status,
      response_trip_id = v_response_trip_id,
      updated_at = v_now
    where id = v_idempotency_row.id;
  end if;

  if v_should_return_trip then
    return query
    select t.*
    from public.trips t
    where t.id = p_trip_id;
  end if;

  return;
end;
$$;

grant execute on function public.accept_trip_request(uuid, uuid, text) to authenticated;
