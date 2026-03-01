-- Add insurance tracking fields to trips table
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS insurance_quote_id TEXT,
  ADD COLUMN IF NOT EXISTS insurance_booking_id TEXT,
  ADD COLUMN IF NOT EXISTS insurance_premium NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS insurance_status TEXT DEFAULT NULL;

-- Index for claims screen lookup (only index rows that have a booking)
CREATE INDEX IF NOT EXISTS trips_insurance_booking_id_idx
  ON public.trips(insurance_booking_id)
  WHERE insurance_booking_id IS NOT NULL;
