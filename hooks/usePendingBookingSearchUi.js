import { Animated, Easing } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatScheduleLabel,
  formatSearchDuration,
  getBookingAddress,
  toMapboxCoordinate,
} from '../screens/customer/CustomerHomeScreen.utils';

export default function usePendingBookingSearchUi({
  pendingBooking,
  userLocation,
}) {
  const [isSearchSheetExpanded, setIsSearchSheetExpanded] = useState(false);
  const [searchElapsedSeconds, setSearchElapsedSeconds] = useState(0);
  const searchingPinPulse = useRef(new Animated.Value(0)).current;
  const searchSheetExpandAnim = useRef(new Animated.Value(0)).current;

  const searchingMarkerCoordinate = useMemo(() => {
    const pickupCoordinate = toMapboxCoordinate(pendingBooking?.pickup);
    if (pickupCoordinate) {
      return pickupCoordinate;
    }

    if (userLocation?.longitude && userLocation?.latitude) {
      return [userLocation.longitude, userLocation.latitude];
    }

    return null;
  }, [pendingBooking?.pickup, userLocation]);

  const searchingStartedAtMs = useMemo(() => {
    const rawDate = pendingBooking?.createdAt || pendingBooking?.created_at;
    if (!rawDate) {
      return Date.now();
    }

    const parsed = new Date(rawDate).getTime();
    return Number.isFinite(parsed) ? parsed : Date.now();
  }, [pendingBooking?.createdAt, pendingBooking?.created_at]);

  const searchTimerLabel = useMemo(
    () => formatSearchDuration(searchElapsedSeconds),
    [searchElapsedSeconds]
  );

  const pendingBookingSummary = useMemo(() => {
    if (!pendingBooking) {
      return null;
    }

    const totalAmount =
      Number(pendingBooking?.pricing?.total ?? pendingBooking?.price ?? 0) || 0;
    const itemsCount = Array.isArray(pendingBooking?.items)
      ? pendingBooking.items.length
      : pendingBooking?.item
        ? 1
        : 0;

    return {
      pickupAddress: getBookingAddress(pendingBooking, 'pickup'),
      dropoffAddress: getBookingAddress(pendingBooking, 'dropoff'),
      vehicleType: pendingBooking?.vehicleType || pendingBooking?.vehicle?.type || 'Vehicle',
      scheduleLabel: formatScheduleLabel(
        pendingBooking?.scheduledTime || pendingBooking?.scheduled_time
      ),
      itemsCount,
      totalAmountLabel: `$${totalAmount.toFixed(2)}`,
    };
  }, [pendingBooking]);

  const searchingPulseSize = searchingPinPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 96],
  });

  const searchingPulseRingOpacity = searchingPinPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.02],
  });

  const searchSheetDetailsHeight = searchSheetExpandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 165],
  });

  const searchSheetDetailsOpacity = searchSheetExpandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  useEffect(() => {
    if (!pendingBooking) {
      setIsSearchSheetExpanded(false);
    }
  }, [pendingBooking]);

  useEffect(() => {
    Animated.timing(searchSheetExpandAnim, {
      toValue: isSearchSheetExpanded ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isSearchSheetExpanded, searchSheetExpandAnim]);

  useEffect(() => {
    if (!pendingBooking) {
      searchingPinPulse.stopAnimation();
      searchingPinPulse.setValue(0);
      return;
    }

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(searchingPinPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(searchingPinPulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );
    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
      searchingPinPulse.stopAnimation();
      searchingPinPulse.setValue(0);
    };
  }, [pendingBooking, searchingPinPulse]);

  useEffect(() => {
    if (!pendingBooking) {
      setSearchElapsedSeconds(0);
      return;
    }

    const updateTimer = () => {
      const seconds = Math.floor((Date.now() - searchingStartedAtMs) / 1000);
      setSearchElapsedSeconds(Math.max(0, seconds));
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);

    return () => clearInterval(timerId);
  }, [pendingBooking, searchingStartedAtMs]);

  return {
    isSearchSheetExpanded,
    setIsSearchSheetExpanded,
    searchTimerLabel,
    pendingBookingSummary,
    searchSheetDetailsHeight,
    searchSheetDetailsOpacity,
    searchingMarkerCoordinate,
    searchingPulseSize,
    searchingPulseRingOpacity,
  };
}
