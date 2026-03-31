import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const stripe = new Stripe(stripeKey, {
  apiVersion: "2022-11-15",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const uniqueStringList = (values: unknown[] = []) =>
  Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!stripeKey || !supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing required server configuration.");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const payload = await req.json();
    const driverId = String(payload?.driverId || user.id);

    if (driverId !== user.id) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }

    const { data: driverRow, error: driverError } = await supabaseClient
      .from("drivers")
      .select("id, stripe_account_id, metadata")
      .eq("id", driverId)
      .maybeSingle();

    if (driverError) {
      throw driverError;
    }

    const accountId =
      String(payload?.connectAccountId || "").trim() || driverRow?.stripe_account_id || "";

    if (!accountId) {
      return jsonResponse({
        success: true,
        accountId: null,
        canReceivePayments: false,
        onboardingComplete: false,
        requirements: [],
        status: "missing_account",
      });
    }

    const account = await stripe.accounts.retrieve(accountId);
    const currentlyDue = uniqueStringList(account.requirements?.currently_due || []);
    const pastDue = uniqueStringList(account.requirements?.past_due || []);
    const eventuallyDue = uniqueStringList(account.requirements?.eventually_due || []);
    const pendingVerification = uniqueStringList(
      account.requirements?.pending_verification || []
    );
    const disabledReason = String(account.requirements?.disabled_reason || "").trim() || null;
    const blockingRequirements = uniqueStringList([
      ...currentlyDue,
      ...pastDue,
    ]);
    const onboardingComplete = Boolean(account.details_submitted);
    const payoutsEnabled = Boolean(account.payouts_enabled);
    const canReceivePayments =
      payoutsEnabled &&
      blockingRequirements.length === 0 &&
      !disabledReason;
    const status = canReceivePayments
      ? "verified"
      : disabledReason || blockingRequirements.length > 0 || !onboardingComplete
        ? "action_required"
        : "under_review";

    const currentMeta =
      driverRow?.metadata && typeof driverRow.metadata === "object"
        ? driverRow.metadata
        : {};

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseClient
      .from("drivers")
      .update({
        stripe_account_id: accountId,
        onboarding_complete: onboardingComplete,
        can_receive_payments: canReceivePayments,
        metadata: {
          ...currentMeta,
          connectAccountId: accountId,
          onboardingComplete,
          canReceivePayments,
          onboardingStatus: status,
          onboardingRequirements: blockingRequirements,
          onboardingRequirementsByBucket: {
            currentlyDue,
            pastDue,
            eventuallyDue,
            pendingVerification,
          },
          onboardingDisabledReason: disabledReason,
          onboardingLastCheckedAt: now,
          updatedAt: now,
        },
        updated_at: now,
      })
      .eq("id", driverId);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({
      success: true,
      accountId,
      canReceivePayments,
      onboardingComplete,
      requirements: blockingRequirements,
      currentlyDue,
      pastDue,
      eventuallyDue,
      pendingVerification,
      disabledReason,
      status,
    });
  } catch (error) {
    console.error("check-driver-onboarding-status error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ success: false, error: message }, 400);
  }
});
