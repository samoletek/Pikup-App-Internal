-- Seed 5 mock completed trips for a driver to validate the Earnings screen.
-- Safe to rerun: previously seeded trips with the same marker are deleted first.
--
-- Usage in Supabase SQL Editor:
-- 1. Set v_driver_email or v_driver_id below.
-- 2. Optionally set v_customer_email to force a specific customer.
-- 3. Run the whole script.

begin;

drop table if exists pg_temp.seed_driver_earnings_ctx;

create temp table seed_driver_earnings_ctx (
  driver_id uuid not null,
  seed_tag text not null
) on commit drop;

do $seed$
declare
  v_driver_email text := 'drew@architeq.io';
  v_driver_id uuid := null;

  v_customer_email text := null;
  v_customer_id uuid := null;

  v_seed_tag constant text := 'driver_earnings_sql_seed_v1';
  v_now timestamptz := now();
begin
  if v_driver_id is null then
    select d.id
    into v_driver_id
    from public.drivers d
    where lower(coalesce(d.email, '')) = lower(v_driver_email)
      limit 1;
  end if;

  if v_driver_id is null then
    select u.id
    into v_driver_id
    from auth.users u
    where lower(coalesce(u.email, '')) = lower(v_driver_email)
    limit 1;
  end if;

  if v_driver_id is null then
    raise exception 'Driver not found in public.drivers or auth.users. Set v_driver_email or v_driver_id before running the script.';
  end if;

  if v_customer_id is null and v_customer_email is not null then
    select c.id
    into v_customer_id
    from public.customers c
    where lower(coalesce(c.email, '')) = lower(v_customer_email)
    limit 1;
  end if;

  if v_customer_id is null then
    select c.id
    into v_customer_id
    from public.customers c
    where c.id <> v_driver_id
    order by c.email asc nulls last, c.id asc
    limit 1;
  end if;

  if v_customer_id is null then
    raise exception 'Customer not found. Set v_customer_email or insert at least one customer first.';
  end if;

  delete from public.trips t
  where t.driver_id = v_driver_id
    and coalesce(t.pickup_location -> 'details' ->> 'mockSource', '') = v_seed_tag;

  insert into public.trips (
    customer_id,
    driver_id,
    pickup_location,
    dropoff_location,
    vehicle_type,
    price,
    distance_miles,
    items,
    status,
    created_at,
    accepted_at,
    picked_up_at,
    completed_at,
    actual_duration_minutes,
    updated_at,
    booking_payment_status,
    booking_currency,
    booking_auth_amount,
    booking_authorized_at,
    booking_captured_at,
    insurance_premium,
    insurance_status
  )
  select
    v_customer_id,
    v_driver_id,
    jsonb_build_object(
      'address', seed.pickup_address,
      'coordinates', jsonb_build_object(
        'latitude', seed.pickup_lat,
        'longitude', seed.pickup_lng
      ),
      'details', jsonb_build_object(
        'mockSource', v_seed_tag,
        'mockTripLabel', seed.label,
        'seededAt', v_now,
        'dispatchRequirements', jsonb_build_object(
          'estimatedDistanceMiles', seed.distance_miles,
          'estimatedDurationMinutes', seed.duration_minutes
        )
      ),
      'pricing', jsonb_build_object(
        'total', seed.total_amount,
        'distance', seed.distance_miles,
        'duration', seed.duration_minutes,
        'durationMinutes', seed.duration_minutes,
        'driverPayout', seed.driver_payout,
        'driverPayoutPercent', 0.75,
        'platformSharePercent', 0.25
      )
    ),
    jsonb_build_object(
      'address', seed.dropoff_address,
      'coordinates', jsonb_build_object(
        'latitude', seed.dropoff_lat,
        'longitude', seed.dropoff_lng
      ),
      'details', jsonb_build_object(
        'mockSource', v_seed_tag,
        'mockTripLabel', seed.label
      )
    ),
    seed.vehicle_type,
    seed.total_amount,
    seed.distance_miles,
    jsonb_build_array(
      jsonb_build_object(
        'name', seed.item_name,
        'weight', seed.item_weight,
        'value', seed.item_value,
        'category', seed.item_category,
        'condition', seed.item_condition,
        'hasInsurance', seed.item_has_insurance
      )
    ),
    'completed',
    seed.created_at,
    seed.accepted_at,
    seed.picked_up_at,
    seed.completed_at,
    seed.duration_minutes,
    seed.completed_at,
    'captured',
    'usd',
    seed.total_amount,
    seed.authorized_at,
    seed.completed_at,
    seed.insurance_premium,
    case
      when seed.insurance_premium > 0 then 'purchased'
      else null
    end
  from (
    values
      (
        'Mock Earnings Trip 1',
        '767 Deer Lake Trail, Stone Mountain, Georgia 30087, United States',
        33.7871::double precision,
        -84.1887::double precision,
        '1825 Rockbridge Road, Stone Mountain, Georgia 30087, United States',
        33.7823::double precision,
        -84.1851::double precision,
        'Standard',
        24.90::numeric,
        18.68::numeric,
        5.2::numeric,
        20::integer,
        'Dining Table',
        80::numeric,
        350::numeric,
        'furniture',
        'used',
        false,
        v_now - interval '75 minutes',
        v_now - interval '65 minutes',
        v_now - interval '65 minutes',
        v_now - interval '50 minutes',
        v_now - interval '45 minutes',
        0::numeric
      ),
      (
        'Mock Earnings Trip 2',
        '767 Deer Lake Trail, Stone Mountain, Georgia 30087, United States',
        33.7871::double precision,
        -84.1887::double precision,
        '772 Deer Lake Trail, Stone Mountain, Georgia 30087, United States',
        33.7860::double precision,
        -84.1896::double precision,
        'Standard',
        32.81::numeric,
        24.61::numeric,
        7.8::numeric,
        20::integer,
        'Sofa',
        110::numeric,
        480::numeric,
        'furniture',
        'used',
        false,
        v_now - interval '62 minutes',
        v_now - interval '55 minutes',
        v_now - interval '54 minutes',
        v_now - interval '37 minutes',
        v_now - interval '34 minutes',
        0::numeric
      ),
      (
        'Mock Earnings Trip 3',
        '5065 Stone Mountain Highway, Stone Mountain, Georgia 30087, United States',
        33.8054::double precision,
        -84.1708::double precision,
        '767 Deer Lake Trail, Stone Mountain, Georgia 30087, United States',
        33.7871::double precision,
        -84.1887::double precision,
        'Standard',
        33.31::numeric,
        24.98::numeric,
        8.4::numeric,
        18::integer,
        'Bookshelf',
        70::numeric,
        260::numeric,
        'furniture',
        'used',
        false,
        v_now - interval '49 minutes',
        v_now - interval '43 minutes',
        v_now - interval '42 minutes',
        v_now - interval '27 minutes',
        v_now - interval '24 minutes',
        0::numeric
      ),
      (
        'Mock Earnings Trip 4',
        '767 Deer Lake Trail, Stone Mountain, Georgia 30087, United States',
        33.7871::double precision,
        -84.1887::double precision,
        '1825 Rockbridge Road, Stone Mountain, Georgia 30087, United States',
        33.7823::double precision,
        -84.1851::double precision,
        'Standard',
        22.61::numeric,
        16.96::numeric,
        4.9::numeric,
        18::integer,
        'Side Table',
        30::numeric,
        140::numeric,
        'furniture',
        'used',
        false,
        v_now - interval '36 minutes',
        v_now - interval '31 minutes',
        v_now - interval '31 minutes',
        v_now - interval '16 minutes',
        v_now - interval '13 minutes',
        0::numeric
      ),
      (
        'Mock Earnings Trip 5',
        '4287 Memorial Drive, Decatur, Georgia 30032, United States',
        33.7734::double precision,
        -84.2480::double precision,
        '2450 Lawrenceville Highway, Decatur, Georgia 30033, United States',
        33.8114::double precision,
        -84.2502::double precision,
        'XL',
        48.40::numeric,
        36.30::numeric,
        11.7::numeric,
        15::integer,
        'Washer',
        175::numeric,
        900::numeric,
        'appliance',
        'new',
        true,
        v_now - interval '24 minutes',
        v_now - interval '20 minutes',
        v_now - interval '20 minutes',
        v_now - interval '8 minutes',
        v_now - interval '5 minutes',
        4.99::numeric
      )
  ) as seed(
    label,
    pickup_address,
    pickup_lat,
    pickup_lng,
    dropoff_address,
    dropoff_lat,
    dropoff_lng,
    vehicle_type,
    total_amount,
    driver_payout,
    distance_miles,
    duration_minutes,
    item_name,
    item_weight,
    item_value,
    item_category,
    item_condition,
    item_has_insurance,
    created_at,
    accepted_at,
    picked_up_at,
    authorized_at,
    completed_at,
    insurance_premium
  );

  update public.drivers d
  set
    metadata = jsonb_set(
      (
        coalesce(d.metadata, '{}'::jsonb)
        - 'availableBalance'
        - 'totalEarnings'
        - 'totalTrips'
        - 'lastTripEarnings'
        - 'lastTripCompletedAt'
      ),
      '{updatedAt}',
      to_jsonb(v_now),
      true
    ),
    updated_at = v_now
  where d.id = v_driver_id;

  insert into seed_driver_earnings_ctx (driver_id, seed_tag)
  values (v_driver_id, v_seed_tag);
end
$seed$;

select
  t.id,
  t.completed_at,
  t.price,
  t.distance_miles,
  coalesce(
    nullif(t.pickup_location -> 'pricing' ->> 'driverPayout', '')::numeric,
    round(coalesce(t.price, 0) * 0.75, 2)
  ) as driver_payout,
  t.pickup_location ->> 'address' as pickup_address,
  t.dropoff_location ->> 'address' as dropoff_address
from public.trips t
join seed_driver_earnings_ctx ctx on ctx.driver_id = t.driver_id
where coalesce(t.pickup_location -> 'details' ->> 'mockSource', '') = ctx.seed_tag
order by t.completed_at desc;

select
  count(*) as seeded_trip_count,
  round(sum(t.price), 2) as seeded_gross_total,
  round(sum(
    coalesce(
      nullif(t.pickup_location -> 'pricing' ->> 'driverPayout', '')::numeric,
      round(coalesce(t.price, 0) * 0.75, 2)
    )
  ), 2) as seeded_driver_earnings_total
from public.trips t
join seed_driver_earnings_ctx ctx on ctx.driver_id = t.driver_id
where coalesce(t.pickup_location -> 'details' ->> 'mockSource', '') = ctx.seed_tag;

commit;
