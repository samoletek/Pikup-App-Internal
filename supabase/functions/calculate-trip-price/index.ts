import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const MILEAGE_THRESHOLD_MILES = 10

const DEFAULT_VEHICLE_RATES = {
  midsize_suv: {
    key: "midsize_suv",
    label: "Midsize Truck/SUV",
    baseFare: 18.5,
    laborPerMinute: 0.75,
    mileageFirstTen: 1.65,
    mileageAfterTen: 0.85,
  },
  fullsize_pickup: {
    key: "fullsize_pickup",
    label: "Full-Sized Truck/SUV",
    baseFare: 28.5,
    laborPerMinute: 0.95,
    mileageFirstTen: 1.9,
    mileageAfterTen: 1.0,
  },
  fullsize_truck: {
    key: "fullsize_truck",
    label: "Cargo Van",
    baseFare: 48.5,
    laborPerMinute: 1.15,
    mileageFirstTen: 2.45,
    mileageAfterTen: 1.25,
  },
  cargo_truck: {
    key: "cargo_truck",
    label: "Box Truck",
    baseFare: 92.5,
    laborPerMinute: 1.65,
    mileageFirstTen: 3.0,
    mileageAfterTen: 1.5,
  },
  cargo_van: {
    key: "cargo_van",
    label: "Cargo Van",
    baseFare: 48.5,
    laborPerMinute: 1.15,
    mileageFirstTen: 2.45,
    mileageAfterTen: 1.25,
  },
  box_truck: {
    key: "box_truck",
    label: "Box Truck",
    baseFare: 92.5,
    laborPerMinute: 1.65,
    mileageFirstTen: 3.0,
    mileageAfterTen: 1.5,
  },
} as const

const VEHICLE_TYPE_ALIASES: Record<string, keyof typeof DEFAULT_VEHICLE_RATES> = {
  standard: "midsize_suv",
  premium: "fullsize_pickup",
  van: "fullsize_truck",
  suv: "midsize_suv",
  pickup: "fullsize_pickup",
  truck: "fullsize_truck",
  midsize_truck: "midsize_suv",
  midsize_truck_suv: "midsize_suv",
  midsize_suv: "midsize_suv",
  midsize_truck_or_suv: "midsize_suv",
  full_sized_truck_suv: "fullsize_pickup",
  fullsize_pickup: "fullsize_pickup",
  fullsize_truck: "fullsize_truck",
  cargo_truck: "cargo_truck",
  cargo_van: "cargo_van",
  box_truck: "box_truck",
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const round2 = (value: number) => Math.round(value * 100) / 100

const normalizeVehicleType = (value: unknown): keyof typeof DEFAULT_VEHICLE_RATES => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")

  return VEHICLE_TYPE_ALIASES[normalized] || "midsize_suv"
}

const calculateMileageFare = (
  distanceMiles: number,
  rate: (typeof DEFAULT_VEHICLE_RATES)[keyof typeof DEFAULT_VEHICLE_RATES],
) => {
  const firstTierMiles = Math.min(distanceMiles, MILEAGE_THRESHOLD_MILES)
  const secondTierMiles = Math.max(0, distanceMiles - MILEAGE_THRESHOLD_MILES)

  return round2(
    firstTierMiles * rate.mileageFirstTen +
      secondTierMiles * rate.mileageAfterTen,
  )
}

const loadVehicleRates = async () => {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").trim()
  const serviceRoleKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim()

  if (!supabaseUrl || !serviceRoleKey) {
    return DEFAULT_VEHICLE_RATES
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await adminClient
    .from("pricing_config")
    .select("value")
    .eq("id", "vehicle_rates")
    .maybeSingle()

  if (error || !data?.value || typeof data.value !== "object") {
    return DEFAULT_VEHICLE_RATES
  }

  return {
    ...DEFAULT_VEHICLE_RATES,
    ...data.value,
  }
}

const resolveVehicleLabel = (
  vehicleKey: keyof typeof DEFAULT_VEHICLE_RATES,
  rate: Record<string, unknown>,
) => {
  const configuredLabel = String(rate.label || "").trim()
  if (configuredLabel) {
    if (vehicleKey === "midsize_suv") return "Midsize Truck/SUV"
    if (vehicleKey === "fullsize_pickup") return "Full-Sized Truck/SUV"
    if (vehicleKey === "fullsize_truck") return "Cargo Van"
    if (vehicleKey === "cargo_truck") return "Box Truck"
    return configuredLabel
  }

  return DEFAULT_VEHICLE_RATES[vehicleKey].label
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const rideDetails = payload?.rideDetails || payload || {}

    const distanceMiles = Math.max(0, toNumber(rideDetails.distance, Number.NaN))
    const durationMinutes = Math.max(0, toNumber(rideDetails.duration, Number.NaN))

    if (!Number.isFinite(distanceMiles) || !Number.isFinite(durationMinutes)) {
      throw new Error("Missing distance or duration")
    }

    const vehicleRates = await loadVehicleRates()
    const vehicleKey = normalizeVehicleType(rideDetails.vehicleType)
    const rate = vehicleRates[vehicleKey]
    const mileageFare = calculateMileageFare(distanceMiles, rate)
    const laborFee = round2(durationMinutes * rate.laborPerMinute)
    const amount = round2(rate.baseFare + mileageFare + laborFee)

    return new Response(
      JSON.stringify({
        success: true,
        amount,
        currency: "usd",
        breakdown: {
          vehicleType: vehicleKey,
          vehicleLabel: resolveVehicleLabel(vehicleKey, rate),
          baseFare: rate.baseFare,
          mileageFare,
          laborFee,
          mileageThresholdMiles: MILEAGE_THRESHOLD_MILES,
          distanceMiles: round2(distanceMiles),
          durationMinutes: round2(durationMinutes),
          total: amount,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to calculate price"
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    )
  }
})
