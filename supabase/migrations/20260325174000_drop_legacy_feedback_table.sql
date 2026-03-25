-- Finalize feedback schema unification:
-- migrate any legacy public.feedback rows into public.feedbacks, then drop legacy table.

insert into public.feedbacks (
  request_id,
  trip_id,
  user_id,
  driver_id,
  rating,
  tip_amount,
  comment,
  source_role,
  target_role,
  target_user_id,
  badges,
  created_at,
  updated_at
)
select
  f.trip_id::text as request_id,
  f.trip_id,
  f.from_user_id as user_id,
  case
    when exists (select 1 from public.drivers d where d.id = f.to_user_id) then f.to_user_id
    else null
  end as driver_id,
  greatest(1, least(5, coalesce(f.rating, 5)))::integer as rating,
  0::numeric as tip_amount,
  f.comment,
  case
    when exists (select 1 from public.drivers d where d.id = f.from_user_id) then 'driver'
    else 'customer'
  end as source_role,
  case
    when exists (select 1 from public.drivers d where d.id = f.to_user_id) then 'driver'
    else 'customer'
  end as target_role,
  f.to_user_id as target_user_id,
  '{}'::text[] as badges,
  f.created_at,
  coalesce(f.created_at, now()) as updated_at
from public.feedback f
where not exists (
  select 1
  from public.feedbacks f2
  where f2.trip_id = f.trip_id
    and f2.user_id = f.from_user_id
    and f2.target_user_id = f.to_user_id
    and f2.created_at = f.created_at
);

drop table if exists public.feedback cascade;
