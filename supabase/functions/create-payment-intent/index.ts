import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2022-11-15',
})

serve(async (req) => {
  try {
    const { amount, currency, customerId } = await req.json()

    console.log(`Creating payment intent: ${amount} ${currency.toUpperCase()}`);

    // Create the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId, // (Optional) Attach to Stripe Customer
      automatic_payment_methods: { enabled: true },
    })

    console.log('PaymentIntent created:', paymentIntent.id);

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }
})
