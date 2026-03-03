import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

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
            return jsonResponse({ error: 'User not authenticated' }, 401)
        }

        const body = await req.json()
        const {
            bookingId,
            lossType,
            lossDate,
            lossDescription,
            lossEstimatedClaimValue,
            claimantName,
            claimantEmail,
            documentTypes,
        } = body

        // Validate required fields
        if (!bookingId) {
            return jsonResponse({ error: 'bookingId is required' }, 400)
        }
        if (!lossDescription) {
            return jsonResponse({ error: 'lossDescription is required' }, 400)
        }

        const { data, error } = await supabaseClient
            .from('claims')
            .insert({
                user_id: user.id,
                booking_id: bookingId,
                claim_type: lossType || 'OTHER',
                loss_date: lossDate || new Date().toISOString().split('T')[0],
                loss_description: lossDescription,
                estimated_value: lossEstimatedClaimValue || null,
                claimant_name: claimantName || user.email,
                claimant_email: claimantEmail || user.email,
                status: 'SUBMITTED',
                document_types: Array.isArray(documentTypes) ? documentTypes : [],
            })
            .select()
            .single()

        if (error) throw error

        console.log('[submit-claim] Claim created:', data.id, 'for booking:', bookingId)

        return jsonResponse(data)
    } catch (error) {
        console.error('Error submitting claim:', error)
        const message = error instanceof Error ? error.message : 'Failed to submit claim'
        return jsonResponse({ error: message }, 400)
    }
})
