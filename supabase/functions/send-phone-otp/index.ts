import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone } = await req.json()

    if (!phone || !phone.startsWith('+')) {
      throw new Error('Valid phone number with country code is required')
    }

    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioVerifyServiceSid = Deno.env.get('TWILIO_VERIFY_SERVICE_SID')

    if (!twilioAccountSid || !twilioAuthToken || !twilioVerifyServiceSid) {
      throw new Error('Missing Twilio configuration')
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
