import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0"

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
        // initialize Supabase client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // Get the user from the authorization header (JWT)
        const {
            data: { user },
        } = await supabaseClient.auth.getUser()

        if (!user) {
            throw new Error('User not authenticated')
        }

        const {
            bookingId,
            lossType,
            lossDate,
            lossDescription,
            lossEstimatedClaimValue,
            claimantName,
            claimantEmail,
            documentTypes,
            // Note: File uploads are handled separately or passed as URLs/Base64. 
            // For this simplified migration, we assume files are uploaded to bucket and URLs passed, 
            // or we handle raw form data? 
            // React Native FormData body handling in Deno is tricky.
            // Better approach: Upload files to Storage first from Client, then pass URLs here.
            // BUT `CustomerClaimsScreen` sends FormData.
            // Deno `req.formData()` can parse it.
        } = await req.json().catch(async () => {
            // If JSON fails, try FormData? 
            // Actually, standard practice for Edge Functions usually prefers JSON.
            // But let's check if req.formData works.
            // For now, let's assume JSON input for simplicity and stability, 
            // and I will update Client to upload files to storage then send JSON.
            // Wait, `CustomerClaimsScreen` constructs FormData.
            // I should update Client to either:
            // 1. Upload files -> Get paths -> Call this function with JSON. (Best practice)
            // 2. Parse FormData here.
            return {};
        })

        // Wait, if I change Client to use `invoke`, it sends JSON by default usually unless body is FormData.
        // If body is FormData, Supabase invoke handles it?
        // Let's stick to parsing JSON. The client update should refactor to upload files first.
        // Or simpler: Just accept the fields for now and ignore files or expect URLs.

        // Actually, `req.json()` handles the body if it's application/json.
        // If the client sends FormData, `req.json()` will fail.

        // Let's implement reading JSON. I will modify the Client to send JSON.
        // Uploading files to Supabase Storage from the client is much better/standard.

        // Insert into 'claims' table
        const { data, error } = await supabaseClient
            .from('claims')
            .insert({
                user_id: user.id,
                booking_id: bookingId,
                claim_type: lossType,
                loss_date: lossDate,
                loss_description: lossDescription,
                estimated_value: lossEstimatedClaimValue,
                claimant_name: claimantName,
                claimant_email: claimantEmail,
                status: 'SUBMITTED',
                // document_urls: documents // if passed
            })
            .select()
            .single()

        if (error) throw error

        return new Response(
            JSON.stringify(data),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    } catch (error) {
        console.error('Error submitting claim:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    }
})
