alter table if exists public.trips
  add column if not exists booking_payment_intent_id text;

alter table if exists public.trips
  add column if not exists booking_payment_method_id text;

alter table if exists public.trips
  add column if not exists booking_auth_amount numeric(10, 2);

alter table if exists public.trips
  add column if not exists booking_currency text default 'usd';

alter table if exists public.trips
  add column if not exists booking_payment_status text;

alter table if exists public.trips
  add column if not exists booking_authorized_at timestamptz;

alter table if exists public.trips
  add column if not exists booking_captured_at timestamptz;

alter table if exists public.trips
  add column if not exists booking_released_at timestamptz;

create index if not exists trips_booking_payment_intent_id_idx
  on public.trips(booking_payment_intent_id);

create index if not exists trips_booking_payment_status_idx
  on public.trips(booking_payment_status);

comment on column public.feedbacks.tip_amount is
  'Deprecated. Financial source of truth moved to public.trip_tips.';
