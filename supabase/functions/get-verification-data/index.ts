import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY is not set');
}
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const stripe = new Stripe(stripeKey ?? '', {
    apiVersion: '2022-11-15',
})

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        if (!stripeKey || !supabaseUrl || !supabaseAnonKey) {
            throw new Error('Missing required server configuration');
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Unauthorized');
        }

        const supabaseClient = createClient(
            supabaseUrl,
            supabaseAnonKey,
            { global: { headers: { Authorization: authHeader } } }
        );

        const {
            data: { user },
            error: userError
        } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            throw new Error('Unauthorized');
        }

        const { sessionId } = await req.json();
        if (!sessionId) {
            throw new Error('sessionId is required');
        }

        const session = await stripe.identity.verificationSessions.retrieve(
            sessionId,
            { expand: ['verified_outputs'] }
        );

        // Security: ensure this session belongs to the requesting user
        if (session.metadata?.user_id !== user.id) {
            throw new Error('Forbidden: session does not belong to this user');
        }

        // Still processing — client should retry
        if (session.status === 'processing' || session.status === 'requires_input') {
            return new Response(
                JSON.stringify({
                    status: session.status,
                    message: 'Verification is still being processed',
                }),
                { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (session.status !== 'verified') {
            return new Response(
                JSON.stringify({
                    error: 'Verification not completed',
                    status: session.status,
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const verified = session.verified_outputs;
        const result = {
            firstName: verified?.first_name || null,
            lastName: verified?.last_name || null,
            dob: verified?.dob ? {
                day: verified.dob.day,
                month: verified.dob.month,
                year: verified.dob.year,
            } : null,
            address: verified?.address ? {
                line1: verified.address.line1 || '',
                city: verified.address.city || '',
                state: verified.address.state || '',
                postalCode: verified.address.postal_code || '',
            } : null,
        };

        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error retrieving verification data:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
})
