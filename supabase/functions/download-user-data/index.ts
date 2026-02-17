import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const IGNORABLE_PG_CODES = new Set(["42P01", "42703"])

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      throw new Error("Missing Authorization header")
    }

    const body = await req.json().catch(() => ({}))
    const role = body.role // "customer" or "driver"
    if (role !== "customer" && role !== "driver") {
      throw new Error("Missing or invalid role. Expected 'customer' or 'driver'.")
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      throw new Error("Invalid token")
    }

    const userId = user.id
    console.log(`Data export requested for user: ${userId}, role: ${role}`)

    const safeQuery = async (
      label: string,
      runQuery: () => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>
    ) => {
      const { data, error } = await runQuery()
      if (!error) return data

      if (error.code && IGNORABLE_PG_CODES.has(error.code)) {
        console.warn(`[download-user-data] Skipping ${label}: ${error.message}`)
        return null
      }

      throw error
    }

    // 1. Profile — from the role-specific table
    const profileTable = role === "customer" ? "customers" : "drivers"
    const profile = await safeQuery(profileTable, () =>
      supabaseAdmin.from(profileTable).select("*").eq("id", userId).maybeSingle()
    )

    // 2. Trips — customer_id for customers, driver_id for drivers
    const tripColumn = role === "customer" ? "customer_id" : "driver_id"
    const trips = await safeQuery("trips", () =>
      supabaseAdmin
        .from("trips")
        .select("*")
        .eq(tripColumn, userId)
        .order("created_at", { ascending: false })
    )

    // 3. Conversations — customer_id for customers, driver_id for drivers
    const convColumn = role === "customer" ? "customer_id" : "driver_id"
    const conversations = await safeQuery("conversations", () =>
      supabaseAdmin
        .from("conversations")
        .select("*")
        .eq(convColumn, userId)
        .order("created_at", { ascending: false })
    )

    // 4. Messages — from user's conversations + sent by user
    let messages: Array<Record<string, unknown>> = []

    if (Array.isArray(conversations) && conversations.length > 0) {
      const conversationIds = conversations.map((c: { id: string }) => c.id)
      const convMessages = await safeQuery("messages.conversation_id", () =>
        supabaseAdmin
          .from("messages")
          .select("*")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
      )
      if (Array.isArray(convMessages)) {
        messages = convMessages
      }
    }

    const sentMessages = await safeQuery("messages.sender_id", () =>
      supabaseAdmin
        .from("messages")
        .select("*")
        .eq("sender_id", userId)
        .order("created_at", { ascending: false })
    )

    if (Array.isArray(sentMessages)) {
      const existingIds = new Set(messages.map((m) => m.id))
      for (const msg of sentMessages) {
        if (!existingIds.has(msg.id)) {
          messages.push(msg)
        }
      }
    }

    // 5. Feedbacks — try both table names used in codebase
    let feedbacks = await safeQuery("feedbacks", () =>
      supabaseAdmin
        .from("feedbacks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
    )
    if (feedbacks === null) {
      feedbacks = await safeQuery("feedback", () =>
        supabaseAdmin
          .from("feedback")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
      )
    }

    // 6. Claims (customer-only, skip for drivers)
    let claims = null
    if (role === "customer") {
      claims = await safeQuery("claims", () =>
        supabaseAdmin
          .from("claims")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
      )
    }

    const exportData: Record<string, unknown> = {
      export_info: {
        exported_at: new Date().toISOString(),
        user_id: userId,
        email: user.email,
        role,
        format_version: "1.1",
      },
      profile: profile || null,
      trips: trips || [],
      conversations: conversations || [],
      messages: messages || [],
      feedbacks: feedbacks || [],
    }

    if (role === "customer") {
      exportData.claims = claims || []
    }

    return new Response(
      JSON.stringify(exportData, null, 2),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("Error exporting user data:", error)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
