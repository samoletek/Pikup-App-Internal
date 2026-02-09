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
    // Handle CORS preflight requests
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

        const { userId, email } = await req.json()
        if (userId && userId !== user.id) {
            throw new Error('Forbidden');
        }

        // Создаем сессию верификации в Stripe
        const verificationSession = await stripe.identity.verificationSessions.create({
            type: 'document',
            metadata: {
                user_id: user.id,
                email: email || user.email || '',
            },
            // Ссылка, куда вернуть юзера после проверки
            // Using HTTPS to satisfy potential Stripe API constraints if custom scheme fails
            return_url: 'https://pikup-app.com/verification-complete',
        });

        // Create Ephemeral Key (Required for React Native SDK)
        const ephemeralKey = await stripe.ephemeralKeys.create(
            { verification_session: verificationSession.id },
            { apiVersion: '2022-11-15' }
        );

        // Отправляем ссылку обратно в приложение
        return new Response(
            JSON.stringify({
                url: verificationSession.url,
                client_secret: verificationSession.client_secret,
                id: verificationSession.id,
                ephemeral_key_secret: ephemeralKey.secret
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    }
})
