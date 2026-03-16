import { logger } from './logger';
import { normalizeError } from './errorService';
import {
  FEEDBACK_ROLE_BY_TYPE,
  hasMissingTableError,
  normalizeFeedbackRow,
  normalizeUserType,
  PROFILE_TABLE_BY_TYPE,
  toSafeRating,
} from './profileFeedbackUtils';
import {
  applyFeedbackToTargetProfile,
  hasExistingTripFeedback,
  insertFeedbackWithFallback,
} from './profileFeedbackPersistence';
import {
  fetchFeedbackRowsByDriver,
  fetchLatestTripFeedbackRowsByUser,
  fetchLegacyFeedbackRowsByDriver,
  fetchProfileRatingSnapshot,
  insertFeedbackRowWithSelect,
  insertLegacyFeedbackRowWithSelect,
  invokeSubmitFeedback,
  updateProfileRatingSnapshot,
} from './repositories/feedbackRepository';

export const updateUserRating = async (userId, newRating, profileType = 'driverProfile') => {
  try {
    const { data: profile } = await fetchProfileRatingSnapshot(userId);

    const currentRating = profile?.rating || 5.0;
    const currentCount = profile?.rating_count || 0;
    const totalRatingPoints = currentRating * currentCount;
    const newTotalPoints = totalRatingPoints + newRating;
    const newCount = currentCount + 1;
    const newAverageRating = newTotalPoints / newCount;

    const updates = {
      rating: Math.round(newAverageRating * 100) / 100,
      rating_count: newCount,
      updated_at: new Date().toISOString(),
    };

    if (profileType === 'customerProfile') {
      updates.completed_orders = (profile?.completed_orders || 0) + 1;
    }

    const { error } = await updateProfileRatingSnapshot(userId, updates);

    if (error) {
      throw error;
    }

    logger.info('ProfileFeedback', 'Updated rating', {
      previousRating: currentRating,
      nextRating: updates.rating,
      ratingCount: newCount,
      userId,
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to update user rating');
    logger.error('ProfileFeedback', 'Error updating user rating', normalized, error);
  }
};

export const submitTripRating = async (ratingData = {}, currentUser) => {
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  const {
    requestId,
    toUserId,
    toUserType = 'driver',
    rating = 5,
    badges = [],
    comment = null,
  } = ratingData;

  if (!requestId) {
    throw new Error('Request ID is required');
  }
  if (!toUserId) {
    throw new Error('Target user is required');
  }

  const sourceUserId = currentUser.uid || currentUser.id;
  const normalizedTargetType = normalizeUserType(toUserType, 'driver');
  const normalizedSourceType = normalizeUserType(
    currentUser?.user_type || currentUser?.userType,
    normalizedTargetType === 'driver' ? 'customer' : 'driver'
  );

  const tableName = PROFILE_TABLE_BY_TYPE[normalizedTargetType];
  const parsedRating = Number(rating);
  const normalizedRating = Math.min(5, Math.max(1, Number.isFinite(parsedRating) ? parsedRating : 5));
  const uniqueBadges = Array.from(
    new Set((Array.isArray(badges) ? badges : []).map((badge) => String(badge).trim()).filter(Boolean))
  );

  const { data: edgeFunctionData, error: edgeFunctionError } = await invokeSubmitFeedback({
    requestId,
    rating: normalizedRating,
    driverId: normalizedTargetType === 'driver' ? toUserId : null,
    toUserId,
    toUserType: normalizedTargetType,
    sourceRole: FEEDBACK_ROLE_BY_TYPE[normalizedSourceType],
    badges: uniqueBadges,
    feedback: comment,
  });

  if (!edgeFunctionError) {
    return {
      ...(edgeFunctionData || {}),
    };
  }

  logger.warn(
    'ProfileFeedback',
    'submit-feedback edge function failed, falling back to client-side update',
    edgeFunctionError
  );

  const alreadySubmitted = await hasExistingTripFeedback({
    requestId,
    sourceUserId,
  });
  if (alreadySubmitted) {
    return { alreadySubmitted: true };
  }

  const timestamp = new Date().toISOString();
  const profileUpdateResult = await applyFeedbackToTargetProfile({
    tableName,
    toUserId,
    normalizedTargetType,
    normalizedRating,
    uniqueBadges,
    timestamp,
  });

  await insertFeedbackWithFallback({
    requestId,
    sourceUserId,
    toUserId,
    normalizedTargetType,
    normalizedSourceType,
    normalizedRating,
    comment,
    uniqueBadges,
    timestamp,
  });

  return {
    rating: profileUpdateResult.nextAverage,
    ratingCount: profileUpdateResult.nextCount,
    badgeStats: profileUpdateResult.nextBadgeStats,
  };
};

export const saveFeedback = async (feedbackData, currentUser) => {
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  try {
    const sourceUserId = currentUser.uid || currentUser.id;
    const normalizedRating = toSafeRating(feedbackData.rating);
    const timestamp = new Date().toISOString();

    const feedbackPayload = {
      request_id: feedbackData.requestId,
      driver_id: feedbackData.driverId || null,
      user_id: sourceUserId,
      rating: normalizedRating,
      tip_amount: 0,
      comment: feedbackData.comment || null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    let insertedFeedback = null;
    const { data: feedbacksData, error: feedbacksError } = await insertFeedbackRowWithSelect(
      feedbackPayload
    );

    if (feedbacksError) {
      if (!hasMissingTableError(feedbacksError, 'feedbacks')) {
        throw feedbacksError;
      }

      const { data: legacyData, error: legacyError } = await insertLegacyFeedbackRowWithSelect({
        request_id: feedbackData.requestId,
        driver_id: feedbackData.driverId || null,
        customer_id: sourceUserId,
        rating: normalizedRating,
        comment: feedbackData.comment || null,
        type: feedbackData.type || 'customer_to_driver',
        created_at: timestamp,
      });

      if (legacyError) {
        throw legacyError;
      }

      insertedFeedback = legacyData;
    } else {
      insertedFeedback = feedbacksData;
    }

    logger.info('ProfileFeedback', 'Feedback saved successfully', {
      feedbackId: insertedFeedback?.id || null,
    });

    if (feedbackData.type === 'customer_to_driver' && feedbackData.driverId && normalizedRating) {
      await updateUserRating(feedbackData.driverId, normalizedRating, 'driverProfile');
    }

    return insertedFeedback?.id || null;
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to save feedback');
    logger.error('ProfileFeedback', 'Error saving feedback', normalized, error);
    return null;
  }
};

export const getDriverFeedback = async (driverId, limit = 5) => {
  try {
    const { data: feedbacksData, error: feedbacksError } = await fetchFeedbackRowsByDriver(
      driverId,
      limit
    );

    if (!feedbacksError && Array.isArray(feedbacksData) && feedbacksData.length > 0) {
      return feedbacksData.map(normalizeFeedbackRow);
    }

    if (feedbacksError && !hasMissingTableError(feedbacksError, 'feedbacks')) {
      logger.warn(
        'ProfileFeedback',
        'Error fetching feedback from feedbacks table, trying legacy feedback table',
        feedbacksError
      );
    }

    const { data: legacyData, error: legacyError } = await fetchLegacyFeedbackRowsByDriver(
      driverId,
      limit
    );

    if (legacyError && !hasMissingTableError(legacyError, 'feedback')) {
      throw legacyError;
    }

    if (feedbacksError && !hasMissingTableError(feedbacksError, 'feedbacks')) {
      throw feedbacksError;
    }

    return Array.isArray(legacyData) ? legacyData.map(normalizeFeedbackRow) : [];
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to fetch driver feedback');
    logger.error('ProfileFeedback', 'Error fetching driver feedback', normalized, error);
    return [];
  }
};

export const getLatestTripFeedbackByUser = async ({ requestId, userId }) => {
  if (!requestId || !userId) {
    return null;
  }

  try {
    let feedbackRows = [];
    const primaryResult = await fetchLatestTripFeedbackRowsByUser({
      requestId,
      userId,
      includeBadges: true,
    });

    if (primaryResult.error) {
      const errorMessage = String(primaryResult.error?.message || '').toLowerCase();
      if (!errorMessage.includes('badges')) {
        throw primaryResult.error;
      }

      const fallbackResult = await fetchLatestTripFeedbackRowsByUser({
        requestId,
        userId,
        includeBadges: false,
      });

      if (fallbackResult.error) {
        throw fallbackResult.error;
      }

      feedbackRows = Array.isArray(fallbackResult.data) ? fallbackResult.data : [];
    } else {
      feedbackRows = Array.isArray(primaryResult.data) ? primaryResult.data : [];
    }

    return feedbackRows[0] || null;
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to load latest trip feedback');
    logger.error('ProfileFeedback', 'Error loading latest trip feedback by user', normalized, error);
    return null;
  }
};
