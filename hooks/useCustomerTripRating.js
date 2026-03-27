import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { normalizeBadgeIds, normalizeRating } from '../screens/customer/CustomerTripDetailsScreen.utils';
import { getLatestTripFeedbackByUser } from '../services/profileFeedbackService';
import { createTripTipPayment } from '../services/tripPaymentLifecycleService';
import { logger } from '../services/logger';

const TIP_PERCENT_PRESETS = [10, 15, 20];

export default function useCustomerTripRating({
  currentUserId,
  driverId,
  isTripCompleted,
  refreshProfile,
  submitTripRating,
  tripId,
  orderTotal,
}) {
  const [rating, setRating] = useState(0);
  const [selectedBadges, setSelectedBadges] = useState([]);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);
  const [existingTripFeedback, setExistingTripFeedback] = useState(null);
  const [tip, setTip] = useState(null);
  const [customTip, setCustomTip] = useState('');
  const [showCustomTip, setShowCustomTip] = useState(false);

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

  const selectTipPreset = useCallback((value) => {
    setTip((prevTip) => (prevTip === value ? null : value));
    setCustomTip('');
    setShowCustomTip(false);
  }, []);

  const openCustomTip = useCallback(() => {
    setShowCustomTip(true);
    setTip(null);
  }, []);

  const updateCustomTip = useCallback((value) => {
    const normalizedInput = String(value || '').replace(/[^\d.]/g, '');
    const [integerPart = '', ...decimalParts] = normalizedInput.split('.');
    const normalizedDecimal = decimalParts.join('').slice(0, 2);
    const nextValue = decimalParts.length > 0
      ? `${integerPart}.${normalizedDecimal}`
      : integerPart;

    setCustomTip(nextValue);
    setTip(null);
  }, []);

  const safeOrderTotal = Number.isFinite(orderTotal) && orderTotal > 0 ? orderTotal : 0;
  const tipFromPercent = typeof tip === 'number' ? Math.round(safeOrderTotal * tip / 100 * 100) / 100 : 0;
  const customTipAmount = customTip ? Number(customTip) : 0;
  const resolvedTipAmount = customTip ? customTipAmount : tipFromPercent;
  const chosenTip = Number.isFinite(resolvedTipAmount) && resolvedTipAmount >= 0 ? resolvedTipAmount : 0;
  const maxTipAmount = Math.round(safeOrderTotal * 2 * 100) / 100;

  const tipPresets = TIP_PERCENT_PRESETS.map((pct) => ({
    percent: pct,
    amount: Math.round(safeOrderTotal * pct / 100 * 100) / 100,
  }));

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

      if (chosenTip > 0) {
        if (maxTipAmount <= 0) {
          Alert.alert('Tip unavailable', 'Tip is unavailable for this trip amount.');
          setIsSubmittingRating(false);
          return;
        }

        if (chosenTip > maxTipAmount) {
          Alert.alert(
            'Tip limit exceeded',
            `Tip cannot exceed $${maxTipAmount.toFixed(2)} for this trip.`,
          );
          setIsSubmittingRating(false);
          return;
        }

        const tipResult = await createTripTipPayment({
          tripId,
          tipAmount: chosenTip,
          idempotencyKey: `trip_tip:${tripId}:${currentUserId}:${Math.round(chosenTip * 100)}`,
        });

        if (!tipResult.success) {
          Alert.alert('Tip Payment Failed', tipResult.error || 'Unable to process tip payment');
          setIsSubmittingRating(false);
          return;
        }
      }

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

      const message = chosenTip > 0
        ? `Your rating and $${chosenTip.toFixed(2)} tip have been sent!`
        : 'Your rating has been saved.';
      Alert.alert('Thanks for your feedback', message);
    } catch (error) {
      logger.error('CustomerTripRating', 'Error submitting trip rating from details', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setIsSubmittingRating(false);
    }
  }, [
    chosenTip,
    currentUserId,
    driverId,
    isTripCompleted,
    loadExistingTripFeedback,
    maxTipAmount,
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
    tip,
    customTip,
    showCustomTip,
    selectTipPreset,
    openCustomTip,
    updateCustomTip,
    tipPresets,
    maxTipAmount,
  };
}
