import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const IGNORABLE_PG_CODES = new Set(["42P01", "42703", "PGRST205"])

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      throw new Error("Missing Authorization header")
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
    console.log(`Request to delete user: ${userId}`)

    const safeDelete = async (
      label: string,
      runDelete: () => Promise<{ error: { code?: string; message?: string } | null }>
    ) => {
      const { error } = await runDelete()
      if (!error) return

      if (error.code && IGNORABLE_PG_CODES.has(error.code)) {
        console.warn(`[delete-user] Skipping ${label}: ${error.message}`)
        return
      }

      throw error
    }

    const safeSelectIds = async (
      label: string,
      runSelect: () => Promise<{ data: Array<{ id: string }> | null; error: { code?: string; message?: string } | null }>
    ) => {
      const { data, error } = await runSelect()
      if (!error) {
        return data ?? []
      }

      if (error.code && IGNORABLE_PG_CODES.has(error.code)) {
        console.warn(`[delete-user] Skipping ${label}: ${error.message}`)
        return []
      }

      throw error
    }

    // Clean up user-dependent rows to avoid FK violations when deleting auth.users.
    const conversations = await safeSelectIds("conversations.select", () =>
      supabaseAdmin
        .from("conversations")
        .select("id")
        .or(`customer_id.eq.${userId},driver_id.eq.${userId}`)
    )
    const conversationIds = conversations.map((item) => item.id).filter(Boolean)

    await safeDelete("messages.sender_id", () =>
      supabaseAdmin.from("messages").delete().eq("sender_id", userId)
    )
    if (conversationIds.length > 0) {
      await safeDelete("messages.conversation_id", () =>
        supabaseAdmin.from("messages").delete().in("conversation_id", conversationIds)
      )
    }
    await safeDelete("conversations", () =>
      supabaseAdmin
        .from("conversations")
        .delete()
        .or(`customer_id.eq.${userId},driver_id.eq.${userId}`)
    )

    await safeDelete("feedback.user_id", () =>
      supabaseAdmin.from("feedback").delete().eq("user_id", userId)
    )
    await safeDelete("feedback.customer_id", () =>
      supabaseAdmin.from("feedback").delete().eq("customer_id", userId)
    )
    await safeDelete("feedback.driver_id", () =>
      supabaseAdmin.from("feedback").delete().eq("driver_id", userId)
    )
    await safeDelete("claims.user_id", () =>
      supabaseAdmin.from("claims").delete().eq("user_id", userId)
    )

    await safeDelete("trips.customer_id", () =>
      supabaseAdmin.from("trips").delete().eq("customer_id", userId)
    )
    await safeDelete("trips.driver_id", () =>
      supabaseAdmin.from("trips").delete().eq("driver_id", userId)
    )
    await safeDelete("trips.viewing_driver_id", () =>
      supabaseAdmin.from("trips").delete().eq("viewing_driver_id", userId)
    )

    await safeDelete("customers.id", () =>
      supabaseAdmin.from("customers").delete().eq("id", userId)
    )
    await safeDelete("drivers.id", () =>
      supabaseAdmin.from("drivers").delete().eq("id", userId)
    )
    await safeDelete("profiles.id", () =>
      supabaseAdmin.from("profiles").delete().eq("id", userId)
    )

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteError) {
      throw deleteError
    }

    console.log(`Successfully deleted user ${userId}`)
    return new Response(
      JSON.stringify({ success: true, message: "User account deleted successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("Error deleting user:", error)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
