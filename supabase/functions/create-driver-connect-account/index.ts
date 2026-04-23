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

const DEFAULT_REFRESH_URL = "https://pikup-app.com";
const DEFAULT_RETURN_URL = "https://pikup-app.com";
const APP_SCHEME = "pikup:";
const DEFAULT_HTTPS_REDIRECT_HOSTS = ["pikup-app.com", "www.pikup-app.com"];
const STRIPE_PLATFORM_PROFILE_URL = "https://dashboard.stripe.com/settings/connect/platform-profile";
const STRIPE_PLATFORM_PROFILE_ERROR_CODE = "stripe_platform_profile_incomplete";
const STRIPE_PLATFORM_PROFILE_MESSAGE =
  "Stripe Connect live setup is incomplete. In Stripe Dashboard, open Connect > Platform profile and acknowledge managing losses responsibilities, then retry onboarding.";

const parseAllowedHttpsHosts = () => {
  const configured = String(
    Deno.env.get("STRIPE_ONBOARDING_ALLOWED_REDIRECT_HOSTS") || ""
  )
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return new Set([...DEFAULT_HTTPS_REDIRECT_HOSTS, ...configured]);
};

const ALLOWED_HTTPS_REDIRECT_HOSTS = parseAllowedHttpsHosts();

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const resolveSafeRedirectUrl = (value: unknown, fallbackUrl: string) => {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return fallbackUrl;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === APP_SCHEME) {
      return parsed.toString();
    }

    if (
      parsed.protocol === "https:" &&
      ALLOWED_HTTPS_REDIRECT_HOSTS.has(parsed.hostname.toLowerCase())
    ) {
      return parsed.toString();
    }
  } catch (_error) {
    // Ignore malformed redirect URLs and fallback to a safe default.
  }

  return fallbackUrl;
};

const normalizeMetadata = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const extractErrorMessage = (error: unknown) => {
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  if (error && typeof error === "object") {
    const maybeError = error as Record<string, unknown>;
    const directMessage = maybeError.message;
    if (typeof directMessage === "string" && directMessage.trim()) {
      return directMessage.trim();
    }

    const rawError = maybeError.raw;
    if (rawError && typeof rawError === "object") {
      const rawMessage = (rawError as Record<string, unknown>).message;
      if (typeof rawMessage === "string" && rawMessage.trim()) {
        return rawMessage.trim();
      }
    }
  }

  return "Unexpected error";
};

const isStripePlatformProfileError = (message: string) => {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("managing losses") ||
    normalized.includes("collecting requirements") ||
    normalized.includes("platform-profile") ||
    normalized.includes("platform profile")
  );
};

const resolveApiErrorPayload = (error: unknown) => {
  const rawMessage = extractErrorMessage(error);

  if (isStripePlatformProfileError(rawMessage)) {
    return {
      status: 400,
      body: {
        success: false,
        code: STRIPE_PLATFORM_PROFILE_ERROR_CODE,
        error: STRIPE_PLATFORM_PROFILE_MESSAGE,
        actionUrl: STRIPE_PLATFORM_PROFILE_URL,
      },
    };
  }

  return {
    status: 400,
    body: {
      success: false,
      error: rawMessage,
    },
  };
};

const ensureTransfersCapabilityRequested = async (accountId: string) => {
  const account = await stripe.accounts.retrieve(accountId);
  const transfersCapability = String(account.capabilities?.transfers || "").trim().toLowerCase();
  if (transfersCapability === "active" || transfersCapability === "pending") {
    return;
  }

  await stripe.accounts.update(accountId, {
    capabilities: {
      transfers: { requested: true },
    },
  });
};

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
    const email = String(payload?.email || user.email || "").trim() || undefined;
    const refreshUrl = resolveSafeRedirectUrl(payload?.refreshUrl, DEFAULT_REFRESH_URL);
    const returnUrl = resolveSafeRedirectUrl(payload?.returnUrl, DEFAULT_RETURN_URL);

    if (driverId !== user.id) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }

    const { data: driverRow, error: driverError } = await adminClient
      .from("drivers")
      .select("id, email, stripe_account_id, metadata")
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

    let accountId = storedAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: email || driverRow?.email || undefined,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          driver_id: driverId,
        },
      });
      accountId = account.id;
    }

    await ensureTransfersCapabilityRequested(accountId);

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    const now = new Date().toISOString();

    const { error: updateError } = await adminClient
      .from("drivers")
      .update({
        stripe_account_id: accountId,
        onboarding_complete: false,
        can_receive_payments: false,
        updated_at: now,
      })
      .eq("id", driverId);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({
      success: true,
      accountId,
      onboardingUrl: accountLink.url,
      expiresAt: accountLink.expires_at,
    });
  } catch (error) {
    console.error("create-driver-connect-account error:", error);
    const resolvedError = resolveApiErrorPayload(error);
    return jsonResponse(resolvedError.body, resolvedError.status);
  }
});
