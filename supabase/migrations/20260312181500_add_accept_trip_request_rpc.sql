CREATE OR REPLACE FUNCTION public.accept_trip_request(
  p_trip_id uuid,
  p_driver_id uuid
)
RETURNS SETOF public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.trips
  SET
    status = 'accepted',
    driver_id = p_driver_id,
    updated_at = NOW()
  WHERE id = p_trip_id
    AND status = 'pending'
    AND (driver_id IS NULL OR driver_id = p_driver_id)
  RETURNING *;
END;
$$;
