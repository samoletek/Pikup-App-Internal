import { useCallback, useEffect, useRef, useState } from 'react';
import { Share } from 'react-native';
import { TRIP_STATUS, normalizeTripStatus } from '../../constants/tripStatus';
import { links } from '../../constants/links';
import { logger } from '../../services/logger';

const MILESTONE_TARGET = 5;
const MILESTONE_REWARD = 15;

export default function useCustomerRewardsData({
  deepLinkCode,
  currentUser,
  getUserPickupRequests,
}) {
  const [completedTrips, setCompletedTrips] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState(null);
  const [credits] = useState(0);
  const promoTimerRef = useRef(null);

  useEffect(() => {
    if (deepLinkCode) {
      setPromoCode(deepLinkCode.toUpperCase());
    }
  }, [deepLinkCode]);

  const loadTripCount = useCallback(async () => {
    try {
      const requests = await getUserPickupRequests?.();
      const completed = (requests || []).filter(
        (request) => normalizeTripStatus(request.status) === TRIP_STATUS.COMPLETED
      );
      setCompletedTrips(completed.length);
    } catch (error) {
      logger.error('CustomerRewardsData', 'Error loading trip count', error);
    }
  }, [getUserPickupRequests]);

  useEffect(() => {
    void loadTripCount();

    return () => {
      if (promoTimerRef.current) {
        clearTimeout(promoTimerRef.current);
      }
    };
  }, [loadTripCount]);

  const handleApplyPromo = useCallback(() => {
    if (!promoCode.trim()) return;

    // TODO(remove-dev): UI-only feedback until promo backend is connected.
    setPromoStatus('success');
    if (promoTimerRef.current) clearTimeout(promoTimerRef.current);
    promoTimerRef.current = setTimeout(() => setPromoStatus(null), 3000);
    setPromoCode('');
  }, [promoCode]);

  const handleShare = useCallback(async () => {
    const code = currentUser?.id?.slice(0, 8)?.toUpperCase() || 'PIKUP10';
    try {
      await Share.share({
        message: `Join PikUp and get $10 off your first delivery! Use my code: ${code}\n${links.inviteBase}${code}`,
      });
    } catch (_error) {
      // User cancelled share dialog.
    }
  }, [currentUser?.id]);

  const milestoneProgress = completedTrips % MILESTONE_TARGET;
  const milestonesCompleted = Math.floor(completedTrips / MILESTONE_TARGET);
  const progressPercent = (milestoneProgress / MILESTONE_TARGET) * 100;

  return {
    credits,
    promoCode,
    setPromoCode,
    promoStatus,
    handleApplyPromo,
    handleShare,
    milestoneProgress,
    milestonesCompleted,
    progressPercent,
    milestoneTarget: MILESTONE_TARGET,
    milestoneReward: MILESTONE_REWARD,
  };
}
