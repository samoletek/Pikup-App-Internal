-- One-time backfill for legacy feedback tip_amount into trip_tips ledger.
-- Run only after applying migrations that create public.trip_tips.

with feedback_tip_source as (
  select
    f.id as feedback_id,
    coalesce(
      f.trip_id,
      case
        when f.request_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then f.request_id::uuid
        else null
      end
    ) as trip_id,
    f.user_id as customer_id,
    coalesce(f.driver_id, t.driver_id) as driver_id,
    coalesce(f.tip_amount, 0)::numeric(10,2) as amount,
    coalesce(f.created_at, now()) as created_at,
    coalesce(f.updated_at, now()) as updated_at
  from public.feedbacks f
  left join public.trips t
    on t.id = coalesce(
      f.trip_id,
      case
        when f.request_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then f.request_id::uuid
        else null
      end
    )
  where coalesce(f.tip_amount, 0) > 0
),
normalized as (
  select *
  from feedback_tip_source
  where trip_id is not null
    and customer_id is not null
    and driver_id is not null
    and amount > 0
)
insert into public.trip_tips (
  trip_id,
  customer_id,
  driver_id,
  payment_intent_id,
  charge_id,
  payment_method_id,
  amount,
  currency,
  status,
  credited_to_driver_at,
  created_at,
  updated_at
)
select
  n.trip_id,
  n.customer_id,
  n.driver_id,
  concat('legacy_feedback_tip:', n.feedback_id::text) as payment_intent_id,
  null as charge_id,
  'legacy_migrated' as payment_method_id,
  n.amount,
  'usd' as currency,
  'succeeded' as status,
  now() as credited_to_driver_at,
  n.created_at,
  n.updated_at
from normalized n
on conflict (payment_intent_id) do nothing;
