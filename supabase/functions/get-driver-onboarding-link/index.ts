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

const DEFAULT_REFRESH_URL = "https://pikup-app.com/driver-onboarding";
const DEFAULT_RETURN_URL = "https://pikup-app.com/driver-onboarding-complete";

const toHttpsRedirectUrl = (value: unknown, fallback: string) => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return fallback;
  } catch (_error) {
    return fallback;
  }
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

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const payload = await req.json();
    const driverId = String(payload?.driverId || user.id);
    const refreshUrl = toHttpsRedirectUrl(payload?.refreshUrl, DEFAULT_REFRESH_URL);
    const returnUrl = toHttpsRedirectUrl(payload?.returnUrl, DEFAULT_RETURN_URL);

    if (driverId !== user.id) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }

    const { data: driverRow, error: driverError } = await supabaseClient
      .from("drivers")
      .select("id, email, stripe_account_id, metadata")
      .eq("id", driverId)
      .maybeSingle();

    if (driverError) {
      throw driverError;
    }

    let accountId = String(payload?.connectAccountId || "").trim() || driverRow?.stripe_account_id || "";

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: driverRow?.email || user.email || undefined,
        metadata: {
          driver_id: driverId,
        },
      });
      accountId = account.id;

      const currentMeta =
        driverRow?.metadata && typeof driverRow.metadata === "object"
          ? driverRow.metadata
          : {};

      const { error: updateError } = await supabaseClient
        .from("drivers")
        .update({
          stripe_account_id: accountId,
          metadata: {
            ...currentMeta,
            connectAccountId: accountId,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", driverId);

      if (updateError) {
        throw updateError;
      }
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return jsonResponse({
      success: true,
      accountId,
      onboardingUrl: accountLink.url,
      expiresAt: accountLink.expires_at,
    });
  } catch (error) {
    console.error("get-driver-onboarding-link error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ success: false, error: message }, 400);
  }
});
