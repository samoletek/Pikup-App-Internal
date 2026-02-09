-- Add cancellation metadata fields for customer/driver order cancellation flow.
alter table if exists public.trips
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text,
  add column if not exists cancellation_reason text;
