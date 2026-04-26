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

const normalizeMetadata = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const uniqueStringList = (values: unknown[] = []) =>
  Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

const resolveDriverOnboardingStatus = ({
  canReceivePayments,
  onboardingComplete,
  disabledReason,
  blockingRequirements,
  pendingVerification,
}: {
  canReceivePayments: boolean;
  onboardingComplete: boolean;
  disabledReason: string | null;
  blockingRequirements: string[];
  pendingVerification: string[];
}) => {
  if (canReceivePayments) {
    return "verified";
  }

  if (!onboardingComplete) {
    return "action_required";
  }

  const isPendingVerificationOnly = disabledReason === "requirements.pending_verification";
  if (isPendingVerificationOnly || pendingVerification.length > 0) {
    return "under_review";
  }

  if (blockingRequirements.length > 0 || Boolean(disabledReason)) {
    return "action_required";
  }

  return "under_review";
};

const buildOnboardingMetadataPatch = ({
  currentMeta,
  accountId,
  canReceivePayments,
  onboardingComplete,
  status,
  requirements,
  currentlyDue,
  pastDue,
  eventuallyDue,
  pendingVerification,
  disabledReason,
  transfersCapability,
  payoutsEnabled,
  detailsSubmitted,
  checkedAt,
}: {
  currentMeta: Record<string, unknown>;
  accountId: string | null;
  canReceivePayments: boolean;
  onboardingComplete: boolean;
  status: string;
  requirements: string[];
  currentlyDue: string[];
  pastDue: string[];
  eventuallyDue: string[];
  pendingVerification: string[];
  disabledReason: string | null;
  transfersCapability: string | null;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  checkedAt: string;
}) => ({
  ...currentMeta,
  connectAccountId: accountId,
  canReceivePayments,
  onboardingComplete,
  onboardingStatus: status,
  onboardingRequirements: requirements,
  onboardingRequirementsByBucket: {
    currentlyDue,
    pastDue,
    eventuallyDue,
    pendingVerification,
  },
  onboardingDisabledReason: disabledReason,
  transfersCapability,
  payoutsEnabled,
  detailsSubmitted,
  onboardingLastCheckedAt: checkedAt,
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!stripeKey || !supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error("Missing required server configuration.");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

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

    const { data: driverRow, error: driverError } = await adminClient
      .from("drivers")
      .select("id, stripe_account_id, metadata")
      .eq("id", driverId)
      .maybeSingle();

    if (driverError) {
      throw driverError;
    }

    const currentMeta = normalizeMetadata(driverRow?.metadata);
    const storedAccountId = String(
      driverRow?.stripe_account_id || currentMeta.connectAccountId || ""
    ).trim();
    const requestedAccountId = String(payload?.connectAccountId || "").trim();

    if (requestedAccountId && storedAccountId && requestedAccountId !== storedAccountId) {
      return jsonResponse(
        { success: false, error: "Payout destination does not match your onboarding account." },
        403
      );
    }

    const accountId = storedAccountId;

    const checkedAt = new Date().toISOString();

    if (!accountId) {
      const metadataPatch = buildOnboardingMetadataPatch({
        currentMeta,
        accountId: null,
        canReceivePayments: false,
        onboardingComplete: false,
        status: "missing_account",
        requirements: [],
        currentlyDue: [],
        pastDue: [],
        eventuallyDue: [],
        pendingVerification: [],
        disabledReason: null,
        transfersCapability: null,
        payoutsEnabled: false,
        detailsSubmitted: false,
        checkedAt,
      });

      const { error: updateMissingAccountError } = await adminClient
        .from("drivers")
        .update({
          stripe_account_id: null,
          onboarding_complete: false,
          can_receive_payments: false,
          metadata: metadataPatch,
          updated_at: checkedAt,
        })
        .eq("id", driverId);

      if (updateMissingAccountError) {
        throw updateMissingAccountError;
      }

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
    const transfersCapability = String(account.capabilities?.transfers || "").trim().toLowerCase();
    const isTransfersCapabilityActive = transfersCapability === "active";
    const isTransfersCapabilityPending = transfersCapability === "pending";
    const capabilityRequirement = !isTransfersCapabilityActive && !isTransfersCapabilityPending
      ? ["capabilities.transfers"]
      : [];
    const blockingRequirements = uniqueStringList([
      ...currentlyDue,
      ...pastDue,
      ...capabilityRequirement,
    ]);
    const onboardingComplete = Boolean(account.details_submitted);
    const payoutsEnabled = Boolean(account.payouts_enabled);
    const canReceivePayments =
      payoutsEnabled &&
      isTransfersCapabilityActive &&
      blockingRequirements.length === 0 &&
      !disabledReason;
    const status = resolveDriverOnboardingStatus({
      canReceivePayments,
      onboardingComplete,
      disabledReason,
      blockingRequirements,
      pendingVerification,
    });

    const metadataPatch = buildOnboardingMetadataPatch({
      currentMeta,
      accountId,
      canReceivePayments,
      onboardingComplete,
      status,
      requirements: blockingRequirements,
      currentlyDue,
      pastDue,
      eventuallyDue,
      pendingVerification,
      disabledReason,
      transfersCapability,
      payoutsEnabled,
      detailsSubmitted: onboardingComplete,
      checkedAt,
    });

    const { error: updateError } = await adminClient
      .from("drivers")
      .update({
        stripe_account_id: accountId,
        onboarding_complete: onboardingComplete,
        can_receive_payments: canReceivePayments,
        metadata: metadataPatch,
        updated_at: checkedAt,
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
      transfersCapability,
      payoutsEnabled,
      detailsSubmitted: onboardingComplete,
      status,
    });
  } catch (error) {
    console.error("check-driver-onboarding-status error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ success: false, error: message }, 400);
  }
});
