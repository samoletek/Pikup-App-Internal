import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY is not set');
}
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const stripe = new Stripe(stripeKey ?? '', {
    apiVersion: '2022-11-15',
})

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
};

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

        // Persist active session id/status immediately so client can recover
        // even if Stripe SDK reports canceled before final verification settles.
        try {
            const driverUpdateClient = supabaseServiceRoleKey
                ? createClient(supabaseUrl, supabaseServiceRoleKey)
                : supabaseClient;

            const { data: existingDriver, error: existingDriverError } = await driverUpdateClient
                .from('drivers')
                .select('metadata')
                .eq('id', user.id)
                .maybeSingle();

            if (existingDriverError) {
                throw existingDriverError;
            }

            const existingMetadata = asRecord(existingDriver?.metadata);
            const existingDraft = asRecord(existingMetadata.onboardingDraft);
            const nextDraft = {
                ...existingDraft,
                verificationStatus: 'pending',
                verificationDataPopulated: false,
                updatedAt: new Date().toISOString(),
            };

            const updatePayload = {
                verification_session_id: verificationSession.id,
                updated_at: new Date().toISOString(),
                metadata: {
                    ...existingMetadata,
                    identityVerificationStatus: 'pending',
                    onboardingDraft: nextDraft,
                    onboardingLastSavedAt: nextDraft.updatedAt,
                },
            };

            let updateDriverError = null;
            if (existingDriver) {
                const updateResult = await driverUpdateClient
                    .from('drivers')
                    .update(updatePayload)
                    .eq('id', user.id);
                updateDriverError = updateResult.error;
            } else {
                const upsertResult = await driverUpdateClient
                    .from('drivers')
                    .upsert({
                        id: user.id,
                        email: user.email || null,
                        first_name: '',
                        last_name: '',
                        phone_number: '',
                        phone_verified: false,
                        rating: 5.0,
                        created_at: new Date().toISOString(),
                        ...updatePayload,
                    });
                updateDriverError = upsertResult.error;
            }

            if (updateDriverError) {
                throw updateDriverError;
            }
        } catch (persistError) {
            console.error('Failed to persist verification session id:', persistError);
        }

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
        const message = error instanceof Error ? error.message : 'Unexpected error';
        const normalized = String(message || '').toLowerCase();
        const status = normalized.includes('unauthorized')
            ? 401
            : normalized.includes('forbidden')
                ? 403
                : 400;

        return new Response(
            JSON.stringify({ error: message }),
            { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    }
})
