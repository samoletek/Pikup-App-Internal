import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const IGNORABLE_PG_CODES = new Set(["42P01", "42703"])

type RowRecord = Record<string, unknown>

const isRowRecord = (value: unknown): value is RowRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const asRowList = (value: unknown): RowRecord[] => {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is RowRecord => isRowRecord(entry))
}

const csvValue = (value: unknown): string => {
  if (value === null || value === undefined) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch (_error) {
    return String(value)
  }
}

const escapeCsv = (raw: string): string => {
  if (!/[",\n]/.test(raw)) return raw
  return `"${raw.replace(/"/g, "\"\"")}"`
}

const toCsv = (rows: RowRecord[]): string => {
  if (rows.length === 0) {
    return "\uFEFFNo data available\n"
  }

  const columnSet = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columnSet.add(key)
    }
  }

  const columns = Array.from(columnSet)
  const header = columns.map(escapeCsv).join(",")
  const body = rows.map((row) =>
    columns.map((column) => escapeCsv(csvValue(row[column]))).join(",")
  )

  return `\uFEFF${[header, ...body].join("\n")}`
}

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

    // 5. Feedbacks
    let feedbacks = await safeQuery("feedbacks", () =>
      supabaseAdmin
        .from("feedbacks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
    )

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

    // Send data via email using SMTP
    const smtpHostname = Deno.env.get("SMTP_HOSTNAME")
    const smtpPort = Number(Deno.env.get("SMTP_PORT") || "465")
    const smtpUsername = Deno.env.get("SMTP_USERNAME")
    const smtpPassword = Deno.env.get("SMTP_PASSWORD")

    if (!smtpHostname || !smtpUsername || !smtpPassword) {
      throw new Error("Email service is not configured. Please contact support.")
    }

    const encoder = new TextEncoder()

    const profileRows = isRowRecord(profile) ? [profile] : []
    const tripRows = asRowList(trips)
    const conversationRows = asRowList(conversations)
    const messageRows = asRowList(messages)
    const feedbackRows = asRowList(feedbacks)
    const claimRows = role === "customer" ? asRowList(claims) : []

    const summaryLines = [
      "PikUp Data Export Summary",
      `Generated at: ${new Date().toISOString()}`,
      `User ID: ${userId}`,
      `Email: ${user.email ?? "unknown"}`,
      `Role: ${role}`,
      "",
      `Profile records: ${profileRows.length}`,
      `Trips: ${tripRows.length}`,
      `Conversations: ${conversationRows.length}`,
      `Messages: ${messageRows.length}`,
      `Feedback entries: ${feedbackRows.length}`,
    ]

    if (role === "customer") {
      summaryLines.push(`Claims: ${claimRows.length}`)
    }

    summaryLines.push(
      "",
      "Attached CSV files can be opened in Excel, Numbers, Google Sheets, or any text editor."
    )

    const attachments = [
      {
        filename: "pikup-export-summary.txt",
        content: encoder.encode(summaryLines.join("\n")),
        contentType: "text/plain; charset=utf-8",
        encoding: "binary",
      },
      {
        filename: "profile.csv",
        content: encoder.encode(toCsv(profileRows)),
        contentType: "text/csv; charset=utf-8",
        encoding: "binary",
      },
      {
        filename: "trips.csv",
        content: encoder.encode(toCsv(tripRows)),
        contentType: "text/csv; charset=utf-8",
        encoding: "binary",
      },
      {
        filename: "conversations.csv",
        content: encoder.encode(toCsv(conversationRows)),
        contentType: "text/csv; charset=utf-8",
        encoding: "binary",
      },
      {
        filename: "messages.csv",
        content: encoder.encode(toCsv(messageRows)),
        contentType: "text/csv; charset=utf-8",
        encoding: "binary",
      },
      {
        filename: "feedbacks.csv",
        content: encoder.encode(toCsv(feedbackRows)),
        contentType: "text/csv; charset=utf-8",
        encoding: "binary",
      },
    ]

    if (role === "customer") {
      attachments.push({
        filename: "claims.csv",
        content: encoder.encode(toCsv(claimRows)),
        contentType: "text/csv; charset=utf-8",
        encoding: "binary",
      })
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHostname,
        port: smtpPort,
        tls: true,
        auth: {
          username: smtpUsername,
          password: smtpPassword,
        },
      },
    })

    try {
      await client.send({
        from: smtpUsername,
        to: user.email!,
        subject: "Your PikUp Data Export (CSV)",
        html: `
          <h2>Your Data Export</h2>
          <p>Hi there,</p>
          <p>You requested an export of your PikUp data.</p>
          <p>We attached CSV files you can open in Excel, Google Sheets, or Numbers.</p>
          <p>This export includes your profile information, trip history, conversations, messages, and feedback.</p>
          <br/>
          <p>— The PikUp Team</p>
        `,
        attachments,
      })
    } finally {
      await client.close()
    }

    return new Response(
      JSON.stringify({ success: true, message: "Data export email with CSV attachments sent." }),
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
