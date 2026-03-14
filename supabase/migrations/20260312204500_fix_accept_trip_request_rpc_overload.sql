-- Prevent PostgREST RPC ambiguity when both 2-arg and 3-arg signatures exist.
-- Keep only the 3-arg signature used by mobile clients.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'accept_trip_request'
      AND p.pronargs = 3
      AND oidvectortypes(p.proargtypes) = 'uuid, uuid, text'
  ) THEN
    EXECUTE $function$
      CREATE FUNCTION public.accept_trip_request(
        p_trip_id uuid,
        p_driver_id uuid,
        p_idempotency_key text DEFAULT NULL
      )
      RETURNS SETOF public.trips
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_actor_id uuid;
      BEGIN
        v_actor_id := auth.uid();

        IF v_actor_id IS NULL THEN
          RAISE EXCEPTION 'Authentication required';
        END IF;

        IF p_driver_id IS NULL THEN
          RAISE EXCEPTION 'Driver id is required';
        END IF;

        IF v_actor_id <> p_driver_id THEN
          RAISE EXCEPTION 'Authenticated driver does not match requested driver id'
            USING ERRCODE = '42501';
        END IF;

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
      $body$;
    $function$;
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.accept_trip_request(uuid, uuid);
