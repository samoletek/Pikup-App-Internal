import {
  toArray,
  toObject,
  type AnyRecord,
} from "./poolUtils.ts"

const PHOTO_URL_TTL_SECONDS = 60 * 60 * 6
const REMOTE_URI_REGEX = /^https?:\/\//i
const LOCAL_URI_REGEX = /^(file:\/\/|content:\/\/|ph:\/\/|asset:\/\/|data:image\/)/i

const parseRatingValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.max(0, Math.min(value, 5))
  }

  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim()
    if (!normalized) {
      return null
    }

    const direct = Number(normalized)
    if (Number.isFinite(direct) && direct > 0) {
      return Math.max(0, Math.min(direct, 5))
    }

    const match = normalized.match(/-?\d+(?:\.\d+)?/)
    if (!match?.[0]) {
      return null
    }

    const extracted = Number(match[0])
    if (Number.isFinite(extracted) && extracted > 0) {
      return Math.max(0, Math.min(extracted, 5))
    }
  }

  return null
}

export const parseRatingFromCandidates = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = parseRatingValue(value)
    if (parsed) {
      return parsed
    }
  }

  return null
}

const decodePathSegment = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch (_error) {
    return value
  }
}

const extractTripPhotoPath = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null
  }

  const raw = value.trim()
  if (!raw) {
    return null
  }

  if (raw.startsWith("trip_photos/")) {
    return decodePathSegment(raw.replace(/^trip_photos\//, ""))
  }
  if (raw.startsWith("/trip_photos/")) {
    return decodePathSegment(raw.replace(/^\/trip_photos\//, ""))
  }

  const storageMatch = raw.match(
    /\/storage\/v1\/object\/(?:public|sign|authenticated|private)\/trip_photos\/([^?]+)/i
  )
  if (storageMatch?.[1]) {
    return decodePathSegment(storageMatch[1])
  }

  const withoutQuery = (raw.split("?")[0] || raw).replace(/^\/+/, "")
  if (withoutQuery.startsWith("trip_photos/")) {
    return decodePathSegment(withoutQuery.replace(/^trip_photos\//, ""))
  }

  if (raw.includes("/trip_photos/")) {
    const [, suffix = ""] = raw.split("/trip_photos/")
    if (suffix) {
      return decodePathSegment((suffix.split("?")[0] || suffix).replace(/^\/+/, ""))
    }
  }

  if (
    withoutQuery.includes("/") &&
    !REMOTE_URI_REGEX.test(raw) &&
    !LOCAL_URI_REGEX.test(raw)
  ) {
    return decodePathSegment(withoutQuery)
  }

  return null
}

export const firstNonEmptyArray = (...values: unknown[]): unknown[] => {
  for (const value of values) {
    const parsed = toArray(value)
    if (parsed.length > 0) {
      return parsed
    }
  }

  return []
}

const resolvePhotoCandidate = (photo: unknown): string | null => {
  if (!photo) {
    return null
  }

  if (typeof photo === "string") {
    const raw = photo.trim()
    if (!raw) {
      return null
    }

    if (raw.startsWith("{") || raw.startsWith("[")) {
      try {
        return resolvePhotoCandidate(JSON.parse(raw))
      } catch (_error) {
        return null
      }
    }

    return raw
  }

  if (Array.isArray(photo)) {
    return resolvePhotoCandidate(photo[0])
  }

  if (typeof photo === "object") {
    const source = photo as Record<string, unknown>
    const candidates = [
      source.uri,
      source.photo,
      source.url,
      source.photo_url,
      source.publicUrl,
      source.public_url,
      source.image,
      source.imageUrl,
      source.image_url,
      source.imageUri,
      source.image_uri,
      source.photoUri,
      source.photo_uri,
      source.thumbnailUrl,
      source.thumbnail_url,
      source.previewUrl,
      source.preview_url,
      source.signedUrl,
      source.signed_url,
      source.secure_url,
      source.path,
      source.storagePath,
      source.storage_path,
      source.filePath,
      source.file_path,
      toObject(source.source).uri,
      toObject(source.asset).uri,
    ]

    for (const candidate of candidates) {
      const resolved = resolvePhotoCandidate(candidate)
      if (resolved) {
        return resolved
      }
    }
  }

  return null
}

export const resolveItemPhotoSources = (item: AnyRecord): unknown[] => {
  return firstNonEmptyArray(
    item.photos,
    item.photo,
    item.photoUrl,
    item.photo_url,
    item.photoUri,
    item.photo_uri,
    item.photoUrls,
    item.photo_urls,
    item.image,
    item.imageUrl,
    item.image_url,
    item.imageUri,
    item.image_uri,
    item.itemPhotos,
    item.item_photos,
    item.images,
    item.media,
    item.mediaUrls,
    item.media_urls,
    item.gallery,
    item.files,
    item.attachments
  )
}

export const resolveAvatarFromCustomerRow = (customer: AnyRecord): string | null => {
  const metadata = toObject(customer.metadata)
  const avatarUrl = String(
    customer.profile_image_url ||
      customer.profileImageUrl ||
      customer.avatar_url ||
      customer.avatarUrl ||
      customer.photo_url ||
      customer.photo ||
      metadata.profile_image_url ||
      metadata.profileImageUrl ||
      metadata.avatar_url ||
      metadata.avatarUrl ||
      metadata.photo_url ||
      metadata.photo ||
      ""
  ).trim()

  return avatarUrl || null
}

type SignedUrlResult = {
  data: { signedUrl?: string | null } | null
  error: unknown
}

type PublicUrlResult = {
  data: { publicUrl: string }
}

type StorageFromClient = {
  createSignedUrl: (path: string, expiresInSeconds: number) => Promise<SignedUrlResult>
  getPublicUrl: (path: string) => PublicUrlResult
}

type StorageCapableClient = {
  storage: {
    from: (bucket: string) => StorageFromClient
  }
}

export const createTripPhotoSigner = (storageClient: StorageCapableClient) => {
  const signedPhotoCache = new Map<string, string>()

  return async (photo: unknown): Promise<string | null> => {
    const candidate = resolvePhotoCandidate(photo)
    if (!candidate) {
      return null
    }

    if (LOCAL_URI_REGEX.test(candidate)) {
      return candidate
    }

    const path = extractTripPhotoPath(candidate)
    if (!path) {
      return candidate
    }

    if (signedPhotoCache.has(path)) {
      return signedPhotoCache.get(path) || null
    }

    const { data, error } = await storageClient.storage
      .from("trip_photos")
      .createSignedUrl(path, PHOTO_URL_TTL_SECONDS)

    if (!error && data?.signedUrl) {
      signedPhotoCache.set(path, data.signedUrl)
      return data.signedUrl
    }

    const fallbackPublicUrl =
      storageClient.storage.from("trip_photos").getPublicUrl(path).data.publicUrl || candidate
    signedPhotoCache.set(path, fallbackPublicUrl)
    return fallbackPublicUrl
  }
}

export const buildFeedbackRatingMap = async ({
  dbClient,
  customerIds,
}: {
  dbClient: {
    from: (table: string) => {
      select: (columns: string) => {
        in: (column: string, values: string[]) => Promise<{ data: unknown[] | null; error: AnyRecord | null }>
      }
    }
  }
  customerIds: string[]
}) => {
  const customerFeedbackRatingMap: Record<string, number> = {}
  if (customerIds.length === 0) {
    return customerFeedbackRatingMap
  }

  const { data: feedbackRows, error: feedbackError } = await dbClient
    .from("feedbacks")
    .select("target_user_id,target_role,rating")
    .in("target_user_id", customerIds)

  if (feedbackError) {
    return customerFeedbackRatingMap
  }

  const ratingAccumulator: Record<string, { sum: number; count: number }> = {}

  ;(feedbackRows || []).forEach((feedback) => {
    const source = toObject(feedback)
    const targetUserId = String(source.target_user_id || "").trim()
    if (!targetUserId) {
      return
    }

    const targetRole = String(source.target_role || "").trim().toLowerCase()
    if (targetRole && targetRole !== "customer") {
      return
    }

    const parsedRating = parseRatingValue(source.rating)
    if (!parsedRating) {
      return
    }

    const current = ratingAccumulator[targetUserId] || { sum: 0, count: 0 }
    current.sum += parsedRating
    current.count += 1
    ratingAccumulator[targetUserId] = current
  })

  Object.entries(ratingAccumulator).forEach(([userId, stats]) => {
    if (!stats.count) return
    customerFeedbackRatingMap[userId] = Number((stats.sum / stats.count).toFixed(2))
  })

  return customerFeedbackRatingMap
}
