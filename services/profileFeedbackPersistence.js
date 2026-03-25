import {
  FEEDBACK_ROLE_BY_TYPE,
  hasMissingColumnError,
  toBadgeStats,
  withDefaultDriverBadgeStats,
} from './profileFeedbackUtils';
import {
  fetchFeedbackIdsByRequestAndUser,
  fetchProfileByTableAndId,
  insertFeedbackRow,
  updateProfileByTableAndId,
} from './repositories/feedbackRepository';

const UUID_V4_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toTripIdIfUuid = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }
  return UUID_V4_LIKE_REGEX.test(normalized) ? normalized : null;
};

export const hasExistingTripFeedback = async ({ requestId, sourceUserId }) => {
  const { data, error } = await fetchFeedbackIdsByRequestAndUser(requestId, sourceUserId);

  if (error) {
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
};

export const applyFeedbackToTargetProfile = async ({
  tableName,
  toUserId,
  normalizedTargetType,
  normalizedRating,
  uniqueBadges,
  timestamp,
}) => {
  const { data: targetProfile, error: targetProfileError } = await fetchProfileByTableAndId(
    tableName,
    toUserId
  );

  if (targetProfileError && targetProfileError?.code !== 'PGRST116') {
    throw targetProfileError;
  }

  const parsedCurrentRating = Number(targetProfile?.rating);
  const currentRating = Number.isFinite(parsedCurrentRating) ? parsedCurrentRating : 5;
  const currentCount = Number(targetProfile?.rating_count) || 0;
  const nextCount = currentCount + 1;
  const nextAverage = Number((((currentRating * currentCount) + normalizedRating) / nextCount).toFixed(2));

  const currentBadgeStats = normalizedTargetType === 'driver'
    ? withDefaultDriverBadgeStats(targetProfile?.badge_stats)
    : toBadgeStats(targetProfile?.badge_stats);
  const nextBadgeStats = { ...currentBadgeStats };

  uniqueBadges.forEach((badgeId) => {
    nextBadgeStats[badgeId] = (Number(nextBadgeStats[badgeId]) || 0) + 1;
  });

  const fullProfileUpdates = {
    rating: nextAverage,
    rating_count: nextCount,
    badge_stats: nextBadgeStats,
    updated_at: timestamp,
  };

  const { error: fullUpdateError } = await updateProfileByTableAndId(
    tableName,
    toUserId,
    fullProfileUpdates
  );

  if (fullUpdateError) {
    const ratingCountColumnMissing = hasMissingColumnError(fullUpdateError, 'rating_count');
    const badgeStatsColumnMissing = hasMissingColumnError(fullUpdateError, 'badge_stats');
    const optionalColumnMissing = ratingCountColumnMissing || badgeStatsColumnMissing;

    if (!optionalColumnMissing) {
      throw fullUpdateError;
    }

    const fallbackUpdates = {
      rating: nextAverage,
      updated_at: timestamp,
    };

    if (!ratingCountColumnMissing) {
      fallbackUpdates.rating_count = nextCount;
    }
    if (!badgeStatsColumnMissing) {
      fallbackUpdates.badge_stats = nextBadgeStats;
    }

    const { error: fallbackUpdateError } = await updateProfileByTableAndId(
      tableName,
      toUserId,
      fallbackUpdates
    );

    if (fallbackUpdateError) {
      throw fallbackUpdateError;
    }

    if (badgeStatsColumnMissing && normalizedTargetType === 'driver') {
      const currentMetadata =
        targetProfile?.metadata &&
        typeof targetProfile.metadata === 'object' &&
        !Array.isArray(targetProfile.metadata)
          ? { ...targetProfile.metadata }
          : {};

      currentMetadata.badge_stats = nextBadgeStats;

      const { error: metadataUpdateError } = await updateProfileByTableAndId(tableName, toUserId, {
        metadata: currentMetadata,
        updated_at: timestamp,
      });

      if (metadataUpdateError && !hasMissingColumnError(metadataUpdateError, 'metadata')) {
        throw metadataUpdateError;
      }
    }
  }

  return {
    nextAverage,
    nextCount,
    nextBadgeStats,
  };
};

export const insertFeedbackWithFallback = async ({
  requestId,
  sourceUserId,
  toUserId,
  normalizedTargetType,
  normalizedSourceType,
  normalizedRating,
  comment,
  uniqueBadges,
  timestamp,
}) => {
  const tripId = toTripIdIfUuid(requestId);
  const feedbackPayload = {
    request_id: requestId,
    trip_id: tripId,
    user_id: sourceUserId,
    driver_id: normalizedTargetType === 'driver' ? toUserId : null,
    rating: normalizedRating,
    tip_amount: 0,
    comment,
    source_role: FEEDBACK_ROLE_BY_TYPE[normalizedSourceType],
    target_role: FEEDBACK_ROLE_BY_TYPE[normalizedTargetType],
    target_user_id: toUserId,
    badges: uniqueBadges,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const { error: feedbackInsertError } = await insertFeedbackRow(feedbackPayload);

  if (!feedbackInsertError) {
    return;
  }

  const extendedColumnsMissing =
    hasMissingColumnError(feedbackInsertError, 'trip_id') ||
    hasMissingColumnError(feedbackInsertError, 'source_role') ||
    hasMissingColumnError(feedbackInsertError, 'target_role') ||
    hasMissingColumnError(feedbackInsertError, 'target_user_id') ||
    hasMissingColumnError(feedbackInsertError, 'badges');

  if (!extendedColumnsMissing) {
    throw feedbackInsertError;
  }

  const fallbackFeedbackPayload = {
    request_id: requestId,
    user_id: sourceUserId,
    driver_id: normalizedTargetType === 'driver' ? toUserId : null,
    rating: normalizedRating,
    tip_amount: 0,
    comment: comment || (uniqueBadges.length > 0 ? `Badges: ${uniqueBadges.join(', ')}` : null),
    created_at: timestamp,
    updated_at: timestamp,
  };

  const { error: fallbackFeedbackError } = await insertFeedbackRow(fallbackFeedbackPayload);

  if (fallbackFeedbackError) {
    throw fallbackFeedbackError;
  }
};
