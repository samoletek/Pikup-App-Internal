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

  if v_lead_hours >= 48 then
    v_target := p_scheduled_time - interval '24 hours';
    return greatest(v_target, p_accepted_at);
  end if;

  -- Keep the 24-48h window aligned with the 24h check-in checkpoint.
  v_target := p_scheduled_time - interval '24 hours';
  return greatest(v_target, p_accepted_at);
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

with pending_checkins as (
  select
    t.id,
    coalesce(
      t.driver_checkin_required_at,
      public.compute_scheduled_trip_checkin_required_at(
        t.scheduled_time,
        coalesce(t.accepted_at, t.updated_at, t.created_at, now())
      )
    ) as required_at
  from public.trips t
  where t.status = 'accepted'
    and t.scheduled_time is not null
    and t.scheduled_time > now()
    and coalesce(t.driver_checkin_status, 'pending') = 'pending'
)
update public.trips as t
set
  driver_checkin_required_at = p.required_at,
  driver_checkin_deadline_at = case
    when p.required_at is not null then p.required_at + interval '30 minutes'
    else null
  end,
  driver_checkin_status = coalesce(nullif(t.driver_checkin_status, ''), 'pending'),
  updated_at = now()
from pending_checkins p
where t.id = p.id;
