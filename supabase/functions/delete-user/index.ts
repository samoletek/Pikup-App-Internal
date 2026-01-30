import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    // 1. Get the Authorization header (JWT)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    // 2. Initialize Supabase Admin Client (Service Role Key)
    // We need this to delete users from auth.users
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 3. Verify the user calling the function
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Invalid token')
    }

    const userId = user.id
    console.log(`Request to delete user: ${userId}`)

    // 4. Delete user from auth.users
    // This will trigger CASCADE delete on public tables if configured,
    // otherwise we might need to manually delete from public tables too.
    // Assuming configured valid foreign keys with CASCADE:
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      throw deleteError
    }

    console.log(`Successfully deleted user ${userId}`)

    return new Response(
      JSON.stringify({ success: true, message: 'User account deleted successfully' }),
      { headers: { "Content-Type": "application/json" } },
    )

  } catch (error) {
    console.error('Error deleting user:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }
})
