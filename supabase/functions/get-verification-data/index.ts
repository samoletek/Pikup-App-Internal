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

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
};

const pickString = (...values: unknown[]) => {
    for (const value of values) {
        const normalized = String(value || '').trim();
        if (normalized) {
            return normalized;
        }
    }
    return null;
};

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
            { expand: ['verified_outputs', 'last_verification_report.document'] }
        );

        // Security: ensure this session belongs to the requesting user
        if (session.metadata?.user_id !== user.id) {
            throw new Error('Forbidden: session does not belong to this user');
        }

        // Still processing — client should retry
        if (session.status === 'processing') {
            return new Response(
                JSON.stringify({
                    status: session.status,
                    message: 'Verification is still being processed',
                }),
                { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (session.status === 'requires_input') {
            const hasAttemptedVerification = Boolean(
                session.last_error ||
                session.last_verification_report
            );

            return new Response(
                JSON.stringify({
                    status: session.status,
                    hasAttemptedVerification,
                    lastError: session.last_error
                        ? {
                            code: session.last_error.code || null,
                            reason: session.last_error.reason || null,
                        }
                        : null,
                    lastVerificationReport: session.last_verification_report || null,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

        const verified = asRecord(session.verified_outputs);
        const report = asRecord(session.last_verification_report);
        const reportDocument = asRecord(report.document);
        const verifiedAddress = asRecord(verified.address);
        const reportAddress = asRecord(reportDocument.address);

        const result = {
            status: 'verified',
            firstName: pickString(verified.first_name, reportDocument.first_name),
            lastName: pickString(verified.last_name, reportDocument.last_name),
            address: (() => {
                const line1 = pickString(verifiedAddress.line1, reportAddress.line1) || '';
                const city = pickString(verifiedAddress.city, reportAddress.city) || '';
                const state = pickString(verifiedAddress.state, reportAddress.state) || '';
                const postalCode = pickString(verifiedAddress.postal_code, reportAddress.postal_code) || '';
                return (line1 || city || state || postalCode)
                    ? {
                        line1,
                        city,
                        state,
                        postalCode,
                    }
                    : null;
            })(),
        };

        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error retrieving verification data:', error);
        const message = error instanceof Error ? error.message : 'Unexpected error';
        const normalized = String(message || '').toLowerCase();
        const status = normalized.includes('unauthorized')
            ? 401
            : normalized.includes('forbidden')
                ? 403
                : normalized.includes('sessionid is required')
                    ? 422
                    : 400;

        return new Response(
            JSON.stringify({ error: message }),
            { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
})
