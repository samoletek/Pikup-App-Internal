import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Role = 'customer' | 'driver'
const DRIVER_BADGE_IDS = ['fast_loader', 'fragile_handler', 'friendly_service'] as const
const UUID_V4_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const normalizeRole = (value: unknown, fallback: Role): Role => {
  if (value === 'customer' || value === 'driver') return value
  return fallback
}

const toSafeRating = (value: unknown): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 5
  return Math.max(1, Math.min(5, parsed))
}

const toSafeBadges = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean)))
}

const hasMissingColumnError = (error: unknown, columnName: string) => {
  const message = `${(error as { message?: string })?.message || ''} ${(error as { details?: string })?.details || ''}`.toLowerCase()
  return message.includes('column') && message.includes('does not exist') && message.includes(columnName.toLowerCase())
}

const toTripIdIfUuid = (value: unknown): string | null => {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return null
  }
  return UUID_V4_LIKE_REGEX.test(normalized) ? normalized : null
}

const toSafeBadgeStats = (value: unknown, includeDriverDefaults = false): Record<string, number> => {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}

  const normalized: Record<string, number> = includeDriverDefaults
    ? Object.fromEntries(DRIVER_BADGE_IDS.map((badgeId) => [badgeId, 0]))
    : {}

  for (const [badgeId, badgeCount] of Object.entries(source)) {
    const parsedCount = Number(badgeCount)
    normalized[badgeId] = Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : 0
  }

  return normalized
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Supabase environment variables are missing')
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') || '',
        },
      },
    })

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()

    if (authError) throw authError
    if (!user) throw new Error('User not authenticated')

    const payload = await req.json()

    const requestId = String(payload?.requestId || '').trim()
    if (!requestId) {
      throw new Error('requestId is required')
    }
    const tripId = toTripIdIfUuid(requestId)

    const normalizedRating = toSafeRating(payload?.rating)
    const badges = toSafeBadges(payload?.badges)

    const inferredTargetRole = payload?.driverId ? 'driver' : 'customer'
    const targetRole = normalizeRole(payload?.toUserType, inferredTargetRole)
    const sourceRole = normalizeRole(
      payload?.sourceRole,
      targetRole === 'driver' ? 'customer' : 'driver'
    )

    const targetUserId = String(
      payload?.toUserId || (targetRole === 'driver' ? payload?.driverId || '' : '')
    ).trim() || null

    const feedbackComment =
      typeof payload?.feedback === 'string'
        ? payload.feedback
        : typeof payload?.comment === 'string'
          ? payload.comment
          : null

    const { data: existingFeedbackRows, error: existingFeedbackError } = await adminClient
      .from('feedbacks')
      .select('id')
      .eq('request_id', requestId)
      .eq('user_id', user.id)
      .limit(1)

    if (existingFeedbackError) throw existingFeedbackError

    if (Array.isArray(existingFeedbackRows) && existingFeedbackRows.length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          alreadySubmitted: true,
          feedbackId: existingFeedbackRows[0].id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const timestamp = new Date().toISOString()

    const fullFeedbackPayload = {
      request_id: requestId,
      trip_id: tripId,
      user_id: user.id,
      driver_id: targetRole === 'driver' ? targetUserId : null,
      rating: normalizedRating,
      tip_amount: 0,
      comment: feedbackComment,
      source_role: sourceRole,
      target_role: targetRole,
      target_user_id: targetUserId,
      badges,
      created_at: timestamp,
      updated_at: timestamp,
    }

    let feedbackRecord: { id?: string } | null = null

    const { data: insertedFeedback, error: feedbackInsertError } = await adminClient
      .from('feedbacks')
      .insert(fullFeedbackPayload)
      .select('id')
      .single()

    if (feedbackInsertError) {
      const canFallbackToLegacyColumns =
        hasMissingColumnError(feedbackInsertError, 'trip_id') ||
        hasMissingColumnError(feedbackInsertError, 'source_role') ||
        hasMissingColumnError(feedbackInsertError, 'target_role') ||
        hasMissingColumnError(feedbackInsertError, 'target_user_id') ||
        hasMissingColumnError(feedbackInsertError, 'badges')

      if (!canFallbackToLegacyColumns) {
        throw feedbackInsertError
      }

      const fallbackFeedbackPayload = {
        request_id: requestId,
        user_id: user.id,
        driver_id: targetRole === 'driver' ? targetUserId : null,
        rating: normalizedRating,
        tip_amount: 0,
        comment:
          feedbackComment ||
          (badges.length > 0 ? `Badges: ${badges.join(', ')}` : null),
        created_at: timestamp,
        updated_at: timestamp,
      }

      const { data: fallbackInsertedFeedback, error: fallbackFeedbackError } = await adminClient
        .from('feedbacks')
        .insert(fallbackFeedbackPayload)
        .select('id')
        .single()

      if (fallbackFeedbackError) {
        throw fallbackFeedbackError
      }

      feedbackRecord = fallbackInsertedFeedback
    } else {
      feedbackRecord = insertedFeedback
    }

    let ratingSummary: {
      rating?: number
      ratingCount?: number
      badgeStats?: Record<string, number>
    } = {}

    if (targetUserId) {
      const targetTable = targetRole === 'driver' ? 'drivers' : 'customers'
      const { data: targetProfile, error: targetProfileError } = await adminClient
        .from(targetTable)
        .select('*')
        .eq('id', targetUserId)
        .maybeSingle()

      if (targetProfileError && targetProfileError.code !== 'PGRST116') {
        throw targetProfileError
      }

      if (targetProfile) {
        const parsedCurrentRating = Number(targetProfile?.rating)
        const currentRating = Number.isFinite(parsedCurrentRating) ? parsedCurrentRating : 5
        const currentCount = Number(targetProfile?.rating_count) || 0
        const nextCount = currentCount + 1
        const nextAverage = Number((((currentRating * currentCount) + normalizedRating) / nextCount).toFixed(2))

        const currentBadgeStats = toSafeBadgeStats(
          targetProfile?.badge_stats,
          targetRole === 'driver'
        )

        for (const badgeId of badges) {
          currentBadgeStats[badgeId] = (Number(currentBadgeStats[badgeId]) || 0) + 1
        }

        const fullProfileUpdatePayload = {
          rating: nextAverage,
          rating_count: nextCount,
          badge_stats: currentBadgeStats,
          updated_at: timestamp,
        }

        const { error: fullProfileUpdateError } = await adminClient
          .from(targetTable)
          .update(fullProfileUpdatePayload)
          .eq('id', targetUserId)

        if (fullProfileUpdateError) {
          const ratingCountColumnMissing = hasMissingColumnError(fullProfileUpdateError, 'rating_count')
          const badgeStatsColumnMissing = hasMissingColumnError(fullProfileUpdateError, 'badge_stats')
          const canFallbackProfileUpdate =
            ratingCountColumnMissing ||
            badgeStatsColumnMissing

          if (!canFallbackProfileUpdate) {
            throw fullProfileUpdateError
          }

          const fallbackProfileUpdatePayload: {
            rating: number
            updated_at: string
            rating_count?: number
            badge_stats?: Record<string, number>
          } = {
            rating: nextAverage,
            updated_at: timestamp,
          }

          if (!ratingCountColumnMissing) {
            fallbackProfileUpdatePayload.rating_count = nextCount
          }
          if (!badgeStatsColumnMissing) {
            fallbackProfileUpdatePayload.badge_stats = currentBadgeStats
          }

          const { error: fallbackProfileUpdateError } = await adminClient
            .from(targetTable)
            .update(fallbackProfileUpdatePayload)
            .eq('id', targetUserId)

          if (fallbackProfileUpdateError) {
            throw fallbackProfileUpdateError
          }

          if (targetRole === 'driver' && badgeStatsColumnMissing) {
            const currentMetadata =
              targetProfile?.metadata && typeof targetProfile.metadata === 'object' && !Array.isArray(targetProfile.metadata)
                ? { ...(targetProfile.metadata as Record<string, unknown>) }
                : {}

            currentMetadata.badge_stats = currentBadgeStats

            const { error: metadataUpdateError } = await adminClient
              .from(targetTable)
              .update({
                metadata: currentMetadata,
                updated_at: timestamp,
              })
              .eq('id', targetUserId)

            if (metadataUpdateError && !hasMissingColumnError(metadataUpdateError, 'metadata')) {
              throw metadataUpdateError
            }
          }
        }

        ratingSummary = {
          rating: nextAverage,
          ratingCount: nextCount,
          badgeStats: currentBadgeStats,
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        feedbackId: feedbackRecord?.id || null,
        targetUserId,
        targetRole,
        ...ratingSummary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error submitting feedback:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
