import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { tripId, driverId } = await req.json()

        if (!tripId) {
            throw new Error('Trip ID is required')
        }
        if (!driverId) {
            throw new Error('Driver ID is required')
        }

        // Create a Supabase client with the SERVICE ROLE KEY to bypass RLS
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        console.log(`Accepting trip ${tripId} by driver ${driverId}`)

        // 1. Check if trip exists and is pending
        const { data: trip, error: fetchError } = await supabaseAdmin
            .from('trips')
            .select('id, status, customer_id')
            .eq('id', tripId)
            .single()

        if (fetchError) {
            console.error('Error fetching trip:', fetchError)
            throw new Error(`Trip not found: ${fetchError.message}`)
        }

        if (trip.status !== 'pending') {
            throw new Error(`Trip is not available (current status: ${trip.status})`)
        }

        // 2. Update the trip with driver assignment
        const { data: updatedTrip, error: updateError } = await supabaseAdmin
            .from('trips')
            .update({
                status: 'accepted',
                driver_id: driverId
            })
            .eq('id', tripId)
            .select()
            .single()

        if (updateError) {
            console.error('Error updating trip:', updateError)
            throw new Error(`Failed to accept trip: ${updateError.message}`)
        }

        console.log('Trip accepted successfully:', updatedTrip.id)

        // 3. Optionally create conversation
        try {
            // Get customer and driver names for conversation
            const { data: customerProfile } = await supabaseAdmin
                .from('customers')
                .select('first_name, last_name, email')
                .eq('id', trip.customer_id)
                .single()

            const { data: driverProfile } = await supabaseAdmin
                .from('drivers')
                .select('first_name, last_name, email')
                .eq('id', driverId)
                .single()

            const customerName = customerProfile?.first_name || customerProfile?.email?.split('@')[0] || 'Customer'
            const driverName = driverProfile?.first_name || driverProfile?.email?.split('@')[0] || 'Driver'

            // Create conversation
            const { error: convError } = await supabaseAdmin
                .from('conversations')
                .insert({
                    trip_id: tripId,
                    customer_id: trip.customer_id,
                    driver_id: driverId,
                    type: 'trip',
                    participant_names: {
                        [trip.customer_id]: customerName,
                        [driverId]: driverName
                    }
                })

            if (convError) {
                console.warn('Failed to create conversation:', convError.message)
            } else {
                console.log('Conversation created for trip:', tripId)
            }
        } catch (convErr) {
            console.warn('Error creating conversation:', convErr)
        }

        return new Response(
            JSON.stringify({
                success: true,
                trip: updatedTrip
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error in accept-trip function:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
