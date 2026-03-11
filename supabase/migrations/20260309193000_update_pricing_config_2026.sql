DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'pricing_config'
  ) THEN
    INSERT INTO public.pricing_config (id, value)
    VALUES
      (
        'vehicle_rates',
        '{
          "midsize_suv": {
            "label": "Midsize Truck / SUV",
            "baseFare": 18.5,
            "laborPerMin": 0.75,
            "mileageFirst10": 1.65,
            "mileageAfter10": 0.85
          },
          "fullsize_pickup": {
            "label": "Full Sized Truck / SUV",
            "baseFare": 28.5,
            "laborPerMin": 0.95,
            "mileageFirst10": 1.9,
            "mileageAfter10": 1.0
          },
          "fullsize_truck": {
            "label": "Cargo Van",
            "baseFare": 48.5,
            "laborPerMin": 1.15,
            "mileageFirst10": 2.45,
            "mileageAfter10": 1.25
          },
          "cargo_truck": {
            "label": "Box Truck",
            "baseFare": 92.5,
            "laborPerMin": 1.65,
            "mileageFirst10": 3.0,
            "mileageAfter10": 1.5
          }
        }'::jsonb
      ),
      (
        'surge_config',
        '{
          "trafficMultiplierMin": 1.2,
          "trafficMultiplierMax": 1.4,
          "peakTimeMultiplier": 1.5,
          "weatherHazardFee": 7.5,
          "peakHoursStart": 7,
          "peakHoursEnd": 10,
          "peakHoursEveningStart": 16,
          "peakHoursEveningEnd": 19
        }'::jsonb
      ),
      (
        'platform_fees',
        '{
          "mileageThreshold": 10,
          "serviceFeePercent": 0.25,
          "taxRate": 0.25,
          "insuranceSpread": 2,
          "mandatoryInsurance": 12.99,
          "driverPayoutPercent": 0.75
        }'::jsonb
      )
    ON CONFLICT (id) DO UPDATE
    SET value = EXCLUDED.value;
  END IF;
END $$;
