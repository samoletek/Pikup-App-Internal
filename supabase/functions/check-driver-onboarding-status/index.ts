import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey || supabaseAnonKey
    );

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

    const { data: driverRow, error: driverError } = await supabaseAdmin
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
    const requirements = Array.from(
      new Set([
        ...(account.requirements?.currently_due || []),
        ...(account.requirements?.eventually_due || []),
      ])
    );

    const onboardingComplete = Boolean(account.details_submitted);
    const canReceivePayments =
      Boolean(account.charges_enabled) &&
      Boolean(account.payouts_enabled) &&
      requirements.length === 0;
    const status = canReceivePayments
      ? "verified"
      : onboardingComplete
        ? "review"
        : "processing";

    const currentMeta =
      driverRow?.metadata && typeof driverRow.metadata === "object"
        ? driverRow.metadata
        : {};

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
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
          onboardingRequirements: requirements,
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
      requirements,
      status,
    });
  } catch (error) {
    console.error("check-driver-onboarding-status error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ success: false, error: message }, 400);
  }
});
