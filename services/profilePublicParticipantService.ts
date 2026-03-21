import { logger } from './logger'
import {
  getAuthenticatedSession,
  refreshAuthenticatedSession,
} from './repositories/authRepository'
import { invokeTripParticipantsPublic } from './repositories/tripRepository'

type ResolvePublicProfileArgs = {
  requestId?: string | null
  targetUserId?: string | null
}

const toTrimmedString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value).trim()
  }

  return ''
}

const extractInvokeErrorDetails = async (error: unknown): Promise<unknown> => {
  if (!error || typeof error !== 'object') {
    return error
  }

  const errorLike = error as { context?: { json?: () => Promise<unknown> } }
  if (!errorLike.context || typeof errorLike.context.json !== 'function') {
    return error
  }

  try {
    const payload = await errorLike.context.json()
    return payload || error
  } catch {
    return error
  }
}

const isInvalidJwtError = (errorDetails: unknown): boolean => {
  if (!errorDetails) {
    return false
  }

  if (typeof errorDetails === 'string') {
    return errorDetails.toLowerCase().includes('invalid jwt')
  }

  if (typeof errorDetails === 'object') {
    const payload = errorDetails as {
      message?: string
      error?: string
      code?: number | string
      status?: number | string
    }
    const message = String(payload.message || payload.error || '').toLowerCase()
    const code = Number(payload.code ?? payload.status)
    return message.includes('invalid jwt') || code === 401
  }

  return false
}

const ensureSessionIsReady = async (): Promise<boolean> => {
  try {
    const { data: sessionData, error: sessionError } = await getAuthenticatedSession()
    if (sessionError) {
      return false
    }

    const activeSession = sessionData?.session || null
    if (!activeSession?.access_token) {
      return false
    }

    const expiresAtSeconds = Number(activeSession.expires_at)
    const expiresAtMs = Number.isFinite(expiresAtSeconds)
      ? expiresAtSeconds * 1000
      : Number.NaN
    const shouldRefresh =
      Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now() + 60 * 1000

    if (!shouldRefresh) {
      return true
    }

    const { data: refreshedData, error: refreshError } = await refreshAuthenticatedSession()
    if (refreshError) {
      return false
    }

    return Boolean(refreshedData?.session?.access_token)
  } catch {
    return false
  }
}

const getCurrentAccessToken = async (): Promise<string | null> => {
  try {
    const { data, error } = await getAuthenticatedSession()
    if (error) {
      return null
    }
    return toTrimmedString(data?.session?.access_token) || null
  } catch {
    return null
  }
}

export const resolvePublicTripParticipantProfile = async ({
  requestId,
  targetUserId,
}: ResolvePublicProfileArgs): Promise<Record<string, unknown> | null> => {
  const normalizedRequestId = toTrimmedString(requestId)
  const normalizedTargetUserId = toTrimmedString(targetUserId)

  if (!normalizedRequestId || !normalizedTargetUserId) {
    return null
  }

  try {
    const isSessionReady = await ensureSessionIsReady()
    if (!isSessionReady) {
      logger.warn('ProfileService', 'Skipping public participant lookup: auth session is not ready', {
        requestId: normalizedRequestId,
        targetUserId: normalizedTargetUserId,
      })
      return null
    }
    let accessToken = await getCurrentAccessToken()
    if (!accessToken) {
      logger.warn('ProfileService', 'Skipping public participant lookup: access token is unavailable', {
        requestId: normalizedRequestId,
        targetUserId: normalizedTargetUserId,
      })
      return null
    }

    logger.debug('ProfileService', 'Resolving public trip participant profile', {
      requestId: normalizedRequestId,
      targetUserId: normalizedTargetUserId,
    })

    const invokeLookup = async () => {
      const response = await invokeTripParticipantsPublic({
        requestId: normalizedRequestId,
        targetUserId: normalizedTargetUserId,
      }, {
        accessToken,
      })

      const responseErrorDetails = response.error
        ? await extractInvokeErrorDetails(response.error)
        : null

      return {
        ...response,
        errorDetails: responseErrorDetails,
      }
    }

    let { data, error, errorDetails } = await invokeLookup()

    if (error && isInvalidJwtError(errorDetails)) {
      logger.warn('ProfileService', 'Invalid JWT for participant lookup, refreshing session and retrying', {
        requestId: normalizedRequestId,
        targetUserId: normalizedTargetUserId,
      })
      const { data: refreshedData, error: refreshError } = await refreshAuthenticatedSession()
      accessToken = toTrimmedString(refreshedData?.session?.access_token) || accessToken
      const didRefreshSession = !refreshError && Boolean(accessToken)

      if (didRefreshSession) {
        const retriedResponse = await invokeLookup()
        data = retriedResponse.data
        error = retriedResponse.error
        errorDetails = retriedResponse.errorDetails
      }
    }

    if (error) {
      logger.warn('ProfileService', 'Public participant profile lookup failed', {
        requestId: normalizedRequestId,
        targetUserId: normalizedTargetUserId,
        error: errorDetails || null,
      })
      return null
    }

    const errorPayload =
      data && typeof data === 'object' && 'error' in data
        ? (data as { error?: string; code?: string | null })
        : null

    if (errorPayload?.error) {
      logger.warn('ProfileService', 'Public participant profile lookup returned error payload', {
        requestId: normalizedRequestId,
        targetUserId: normalizedTargetUserId,
        error: errorPayload.error,
        code: errorPayload.code || null,
      })
      return null
    }

    const successPayload =
      data && typeof data === 'object' && 'profile' in data
        ? (data as { profile?: Record<string, unknown> | null })
        : null
    const profile = successPayload?.profile || null
    if (!profile || typeof profile !== 'object') {
      logger.warn('ProfileService', 'Public participant profile lookup returned empty payload', {
        requestId: normalizedRequestId,
        targetUserId: normalizedTargetUserId,
      })
      return null
    }

    logger.info('ProfileService', 'Resolved public participant profile via edge function', {
      requestId: normalizedRequestId,
      targetUserId: normalizedTargetUserId,
    })

    return profile as Record<string, unknown>
  } catch {
    logger.warn('ProfileService', 'Public participant profile lookup threw', {
      requestId: normalizedRequestId,
      targetUserId: normalizedTargetUserId,
    })
    return null
  }
}
