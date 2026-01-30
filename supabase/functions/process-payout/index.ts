import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2022-11-15',
})

serve(async (req) => {
  try {
    const { amount, currency = 'usd', connectAccountId, transferGroup } = await req.json()

    console.log(`Processing payout for ${connectAccountId}: ${amount} ${currency.toUpperCase()}`);

    if (!connectAccountId) {
      throw new Error("Missing 'connectAccountId'");
    }

    // Create a Transfer to the connected account
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      destination: connectAccountId,
      transfer_group: transferGroup || undefined, // Link to the original order if provided
    });

    console.log('Transfer successful:', transfer.id);

    return new Response(
      JSON.stringify({ success: true, transferId: transfer.id }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error('Error processing payout:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }
})
