import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const details = payload?.rideDetails || payload || {}
    const { distance, duration, vehicleType } = details

    // Basic Validation
    if (distance === undefined || duration === undefined) {
      throw new Error('Missing distance or duration')
    }

    // Pricing Rates (Dynamic logic can be added here)
    const RATES = {
      standard: {
        base: 5.00,
        perMile: 1.50,
        perMinute: 0.50,
        minFare: 7.00
      },
      premium: {
        base: 8.00,
        perMile: 2.50,
        perMinute: 0.80,
        minFare: 12.00
      },
      van: {
        base: 10.00,
        perMile: 3.00,
        perMinute: 1.00,
        minFare: 15.00
      }
    }

    const type = vehicleType && RATES[vehicleType] ? vehicleType : 'standard'
    const rate = RATES[type]

    let price = rate.base + (Number(distance) * rate.perMile) + (Number(duration) * rate.perMinute)

    // Apply minimum fare
    if (price < rate.minFare) {
      price = rate.minFare
    }

    // Round to 2 decimal places
    price = Math.round(price * 100) / 100

    console.log(`Calculated price for ${distance}mi / ${duration}min (${type}): $${price}`)

    return new Response(
      JSON.stringify({
        amount: price,
        currency: 'usd',
        breakdown: {
          baseFare: rate.base,
          distanceFare: Number(distance) * rate.perMile,
          timeFare: Number(duration) * rate.perMinute
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error calculating price:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
