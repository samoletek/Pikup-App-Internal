import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { tripId, driverId } = await req.json()
        console.log(`Received request: tripId=${tripId}, driverId=${driverId}`)

        // MIMIC SUCCESS for debugging
        return new Response(
            JSON.stringify({
                success: true,
                message: "Debug: Function is reachable!",
                trip: { id: tripId, status: "accepted_debug" }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
