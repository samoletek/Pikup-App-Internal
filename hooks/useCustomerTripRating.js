import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { normalizeBadgeIds, normalizeRating } from '../screens/customer/CustomerTripDetailsScreen.utils';
import { getLatestTripFeedbackByUser } from '../services/profileFeedbackService';
import { creditDriverTip } from '../services/driverEarningsService';
import { logger } from '../services/logger';

const TIP_PERCENT_PRESETS = [10, 15, 20];

export default function useCustomerTripRating({
  currentUserId,
  driverId,
  isTripCompleted,
  refreshProfile,
  submitTripRating,
  tripId,
  confirmPayment,
  defaultPaymentMethod,
  createPaymentIntent,
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
    setTip(value);
    setCustomTip('');
    setShowCustomTip(false);
  }, []);

  const openCustomTip = useCallback(() => {
    setShowCustomTip(true);
    setTip(null);
  }, []);

  const updateCustomTip = useCallback((value) => {
    setCustomTip(value);
    setTip(null);
  }, []);

  const safeOrderTotal = Number.isFinite(orderTotal) && orderTotal > 0 ? orderTotal : 0;
  const tipFromPercent = typeof tip === 'number' ? Math.round(safeOrderTotal * tip / 100 * 100) / 100 : 0;
  const resolvedTipAmount = customTip ? Number(customTip) : tipFromPercent;
  const chosenTip = Number.isFinite(resolvedTipAmount) && resolvedTipAmount >= 0 ? resolvedTipAmount : 0;

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
        if (!defaultPaymentMethod?.stripePaymentMethodId) {
          Alert.alert('Payment method required', 'Please add a payment method before sending a tip.');
          setIsSubmittingRating(false);
          return;
        }

        const tipAmountInCents = Math.round(chosenTip * 100);
        const createTipIntentResult = await createPaymentIntent(tipAmountInCents, 'usd', {
          type: 'tip',
          requestId: tripId,
          driverId,
          customerId: currentUserId,
        });

        if (!createTipIntentResult.success || !createTipIntentResult.paymentIntent?.client_secret) {
          Alert.alert('Tip Payment Failed', createTipIntentResult.error || 'Unable to start tip payment');
          setIsSubmittingRating(false);
          return;
        }

        const paymentResult = await confirmPayment(
          createTipIntentResult.paymentIntent.client_secret,
          defaultPaymentMethod.stripePaymentMethodId
        );

        if (!paymentResult.success) {
          Alert.alert('Tip Payment Failed', paymentResult.error || 'Unable to process tip payment');
          setIsSubmittingRating(false);
          return;
        }

        await creditDriverTip(driverId, chosenTip);
      }

      const result = await submitTripRating({
        requestId: tripId,
        toUserId: driverId,
        toUserType: 'driver',
        rating,
        badges: selectedBadges,
        tip: chosenTip,
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
    confirmPayment,
    createPaymentIntent,
    currentUserId,
    defaultPaymentMethod?.stripePaymentMethodId,
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
    tip,
    customTip,
    showCustomTip,
    selectTipPreset,
    openCustomTip,
    updateCustomTip,
    tipPresets,
  };
}
