import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const {
            data: { user },
        } = await supabaseClient.auth.getUser()

        if (!user) {
            throw new Error('User not authenticated')
        }

        const {
            requestId,
            rating,
            tip,
            feedback,
            driverId
        } = await req.json()

        // 1. Insert feedback record
        const { data: feedbackData, error: feedbackError } = await supabaseClient
            .from('feedbacks')
            .insert({
                request_id: requestId,
                user_id: user.id,
                driver_id: driverId,
                rating: rating,
                tip_amount: tip || 0,
                comment: feedback
            })
            .select()
            .single()

        if (feedbackError) throw feedbackError

        // 2. Optionally update request status or driver rating average here
        // For now, just storing the feedback is enough for this task scope.

        return new Response(
            JSON.stringify(feedbackData),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    } catch (error) {
        console.error('Error submitting feedback:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    }
})
