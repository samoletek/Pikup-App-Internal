import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const normalizePhone = (value: string | null | undefined) => {
  const digits = String(value ?? '').replace(/[^\d]/g, '')
  return digits ? `+${digits}` : ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, userId, userTable } = await req.json()

    if (!phone || !phone.startsWith('+')) {
      throw new Error('Valid phone number with country code is required')
    }

    if (userTable && !['drivers', 'customers'].includes(userTable)) {
      throw new Error('Invalid user table')
    }

    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioVerifyServiceSid = Deno.env.get('TWILIO_VERIFY_SERVICE_SID')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!twilioAccountSid || !twilioAuthToken || !twilioVerifyServiceSid || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing server configuration')
    }

    const normalizedPhone = normalizePhone(phone)

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    if (userId && userTable) {
      const { data: currentProfile, error: profileError } = await supabaseAdmin
        .from(userTable)
        .select('id, phone_number, phone_verified')
        .eq('id', userId)
        .maybeSingle()

      if (profileError) {
        throw new Error(profileError.message || 'Failed to validate current profile')
      }

      const currentPhone = normalizePhone(currentProfile?.phone_number)
      if (currentProfile && currentProfile.phone_verified === true && currentPhone && currentPhone === normalizedPhone) {
        throw new Error('This phone number is already verified on your account')
      }
    }

    const [{ data: driverMatches, error: driverError }, { data: customerMatches, error: customerError }] = await Promise.all([
      supabaseAdmin.from('drivers').select('id').eq('phone_number', normalizedPhone).limit(5),
      supabaseAdmin.from('customers').select('id').eq('phone_number', normalizedPhone).limit(5),
    ])

    if (driverError) {
      throw new Error(driverError.message || 'Failed to validate drivers phone ownership')
    }
    if (customerError) {
      throw new Error(customerError.message || 'Failed to validate customers phone ownership')
    }

    const ownerIds = [
      ...(driverMatches || []).map((row) => row.id),
      ...(customerMatches || []).map((row) => row.id),
    ]

    const isOwnedByAnotherAccount = ownerIds.some((ownerId) => ownerId !== userId)
    if (isOwnedByAnotherAccount) {
      throw new Error('This phone number is already linked to another account')
    }

    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${twilioVerifyServiceSid}/Verifications`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
        },
        body: new URLSearchParams({
          To: phone,
          Channel: 'sms',
        }),
      }
    )

    const result = await response.json()

    if (!response.ok) {
      if (result.code === 60200) throw new Error('Invalid phone number')
      if (result.code === 60203) throw new Error('Too many requests. Please wait before trying again.')
      throw new Error(result.message || 'Failed to send verification code')
    }

    return new Response(
      JSON.stringify({ success: true, status: result.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
