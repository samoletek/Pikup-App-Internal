import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno"

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY is not set');
}

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
        if (!stripeKey) {
            throw new Error('STRIPE_SECRET_KEY is missing in Edge Function secrets');
        }

        // Получаем данные, которые прислало приложение
        const { userId, email } = await req.json()

        // Создаем сессию верификации в Stripe
        const verificationSession = await stripe.identity.verificationSessions.create({
            type: 'document',
            metadata: {
                user_id: userId,
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
