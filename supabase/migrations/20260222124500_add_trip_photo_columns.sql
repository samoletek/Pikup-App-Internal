-- Ensure trip photo columns exist for pickup/dropoff proof images.
alter table if exists public.trips
  add column if not exists pickup_photos text[] not null default '{}',
  add column if not exists dropoff_photos text[] not null default '{}';

-- Force PostgREST schema cache refresh so new columns are visible immediately.
notify pgrst, 'reload schema';
