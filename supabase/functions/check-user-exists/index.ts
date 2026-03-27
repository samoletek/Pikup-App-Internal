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
    const { email } = await req.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()

    if (!normalizedEmail) {
      throw new Error('Email is required')
    }

    // Create a Supabase client with the SERVICE ROLE KEY to bypass RLS
    // and query auth.users if needed, or public tables securely.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`Checking existence for email: ${normalizedEmail}`)

    // 1. Check if user exists in 'drivers' table
    const { data: driver, error: driverError } = await supabaseAdmin
      .from('drivers')
      .select('id, email')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (driverError) {
      console.error('Error checking drivers:', driverError)
    }

    if (driver) {
      console.log('Found in drivers')
      return new Response(
        JSON.stringify({ exists: true, userType: 'driver' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Check if user exists in 'customers' table
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, email')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (customerError) {
      console.error('Error checking customers:', customerError)
    }

    if (customer) {
      console.log('Found in customers')
      return new Response(
        JSON.stringify({ exists: true, userType: 'customer' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Optional: Check auth.users directly?
    // If they are in auth.users but NOT in tables, they might be in a bad state
    // But for the purpose of "Registration", if they aren't in public tables, we can treat them as "New"
    // OR we can say "Account exists but setup incomplete".
    // For now, simpler is better: Not in tables = New User.
    // However, if they try to sign up with same email, Supabase Auth will fail ("User already exists").
    // So we SHOULD check auth.users to be safe, so the UI can define "Login" instead of "Register".

    return new Response(
      JSON.stringify({ exists: false, userType: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
