import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
      }
    )

    // 1. Get the user from the request context
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    // 2. Get customer profile to retrieve stripe_customer_id
    const { data: customer, error: dbError } = await supabaseClient
      .from('customers')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (dbError) {
      console.error('Error fetching customer profile:', dbError)
      // If no profile found (maybe driver?), return empty list or handle gracefully
      // For now, assuming only customers have payment methods
      return new Response(
        JSON.stringify({ paymentMethods: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!customer?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ paymentMethods: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. List payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.stripe_customer_id,
      type: 'card',
    })

    // 4. Retrieve customer to check default payment method
    // Note: Stripe doesn't have a simple "default" property on payment methods list,
    // we have to check the customer's invoice_settings.default_payment_method
    const stripeCustomer = await stripe.customers.retrieve(customer.stripe_customer_id)
    const defaultPaymentMethodId = stripeCustomer.invoice_settings?.default_payment_method

    const formattedMethods = paymentMethods.data.map(pm => ({
      id: pm.id,
      stripePaymentMethodId: pm.id,
      brand: pm.card.brand,
      cardBrand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
      isDefault: pm.id === defaultPaymentMethodId
    }))

    return new Response(
      JSON.stringify({ paymentMethods: formattedMethods, defaultPaymentMethodId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error getting payment methods:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
