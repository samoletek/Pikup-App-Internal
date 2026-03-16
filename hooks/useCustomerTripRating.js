import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { normalizeBadgeIds, normalizeRating } from '../screens/customer/CustomerTripDetailsScreen.utils';
import { getLatestTripFeedbackByUser } from '../services/profileFeedbackService';
import { logger } from '../services/logger';

export default function useCustomerTripRating({
  currentUserId,
  driverId,
  isTripCompleted,
  refreshProfile,
  submitTripRating,
  tripId,
}) {
  const [rating, setRating] = useState(0);
  const [selectedBadges, setSelectedBadges] = useState([]);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);
  const [existingTripFeedback, setExistingTripFeedback] = useState(null);

  const loadExistingTripFeedback = useCallback(async () => {
    if (!isTripCompleted || !tripId || !currentUserId) {
      setExistingTripFeedback(null);
      setRating(0);
      setSelectedBadges([]);
      setIsRatingSubmitted(false);
      return;
    }

    try {
      const latestFeedback = await getLatestTripFeedbackByUser({
        requestId: tripId,
        userId: currentUserId,
      });
      if (!latestFeedback) {
        setExistingTripFeedback(null);
        setRating(0);
        setSelectedBadges([]);
        setIsRatingSubmitted(false);
        return;
      }

      const savedRating = normalizeRating(latestFeedback.rating);
      const savedBadges = normalizeBadgeIds(latestFeedback.badges);

      setExistingTripFeedback(latestFeedback);
      setRating(savedRating);
      setSelectedBadges(savedBadges);
      setIsRatingSubmitted(savedRating > 0);
    } catch (error) {
      logger.error('CustomerTripRating', 'Error loading existing trip rating', error);
      setExistingTripFeedback(null);
      setRating(0);
      setSelectedBadges([]);
      setIsRatingSubmitted(false);
    }
  }, [currentUserId, isTripCompleted, tripId]);

  useEffect(() => {
    void loadExistingTripFeedback();
  }, [loadExistingTripFeedback]);

  const isRatingReadOnly = isRatingSubmitted || Boolean(existingTripFeedback?.id);
  const canSubmitRating =
    isTripCompleted &&
    Boolean(driverId) &&
    !isRatingReadOnly &&
    rating >= 1 &&
    !isSubmittingRating;

  const toggleBadge = useCallback(
    (badgeId) => {
      if (isRatingReadOnly) {
        return;
      }

      setSelectedBadges((prev) => {
        if (prev.includes(badgeId)) {
          return prev.filter((id) => id !== badgeId);
        }
        return [...prev, badgeId];
      });
    },
    [isRatingReadOnly]
  );

  const submitDriverRating = useCallback(async () => {
    if (!isTripCompleted || !tripId || !driverId) {
      Alert.alert('Rating unavailable', 'Driver details are missing for this trip.');
      return;
    }

    if (rating < 1) {
      Alert.alert('Select rating', 'Please tap at least one star.');
      return;
    }

    try {
      setIsSubmittingRating(true);
      const result = await submitTripRating({
        requestId: tripId,
        toUserId: driverId,
        toUserType: 'driver',
        rating,
        badges: selectedBadges,
      });

      await refreshProfile?.();

      if (result?.alreadySubmitted) {
        await loadExistingTripFeedback();
        Alert.alert('Rating already submitted', 'You already rated this trip.');
        return;
      }

      setExistingTripFeedback({
        id: result?.feedbackId || `local-${tripId}`,
        request_id: tripId,
        user_id: currentUserId,
        rating,
        badges: selectedBadges,
      });
      setIsRatingSubmitted(true);
      Alert.alert('Thanks for your feedback', 'Your rating has been saved.');
    } catch (error) {
      logger.error('CustomerTripRating', 'Error submitting trip rating from details', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setIsSubmittingRating(false);
    }
  }, [
    currentUserId,
    driverId,
    isTripCompleted,
    loadExistingTripFeedback,
    rating,
    refreshProfile,
    selectedBadges,
    submitTripRating,
    tripId,
  ]);

  return {
    rating,
    setRating,
    selectedBadges,
    isSubmittingRating,
    isRatingSubmitted,
    isRatingReadOnly,
    canSubmitRating,
    toggleBadge,
    submitDriverRating,
    existingTripFeedback,
  };
}
