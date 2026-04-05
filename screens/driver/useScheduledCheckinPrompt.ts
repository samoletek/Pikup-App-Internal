import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { Alert } from 'react-native';
import { resolveDriverCheckinState } from './DriverHomeScreen.utils';
import { logger } from '../../services/logger';

type TripLike = Record<string, any>;
type ServiceResultLike = {
  success?: boolean;
  error?: string;
  errorCode?: string | null;
  trip?: TripLike;
  requeuedTrip?: TripLike;
};

type UseScheduledCheckinPromptParams = {
  acceptedScheduledRequests: TripLike[];
  hasActiveTrip: boolean;
  isOnline: boolean;
  confirmScheduledTripCheckin?: ((requestId: string) => Promise<TripLike | ServiceResultLike | null | undefined>) | null;
  declineScheduledTripCheckin?: ((requestId: string) => Promise<TripLike | ServiceResultLike | null | undefined>) | null;
  refreshAcceptedScheduledRequests: (options?: { silent?: boolean }) => Promise<TripLike[]>;
  setAcceptedScheduledRequests: Dispatch<SetStateAction<TripLike[]>>;
};

const replaceTripById = (trips: TripLike[], updatedTrip: TripLike) =>
  (Array.isArray(trips) ? trips : []).map((trip) =>
    trip?.id === updatedTrip?.id ? { ...trip, ...updatedTrip } : trip
  );

const removeTripById = (trips: TripLike[], tripId: string) =>
  (Array.isArray(trips) ? trips : []).filter((trip) => trip?.id !== tripId);

const getCheckinPromptMessage = (trip: TripLike) => {
  const scheduledTime = trip?.scheduledTime || trip?.scheduled_time || '';
  const fallbackAddress = trip?.pickupAddress || trip?.pickup?.address || 'your scheduled pickup';
  return scheduledTime
    ? `Please confirm that you are still ready for this trip (${fallbackAddress}).`
    : 'Please confirm that you are still ready for this scheduled trip.';
};

export default function useScheduledCheckinPrompt({
  acceptedScheduledRequests,
  hasActiveTrip,
  isOnline,
  confirmScheduledTripCheckin,
  declineScheduledTripCheckin,
  refreshAcceptedScheduledRequests,
  setAcceptedScheduledRequests,
}: UseScheduledCheckinPromptParams) {
  const promptedTripIdRef = useRef<string | null>(null);
  const inFlightTripIdRef = useRef<string | null>(null);

  const confirmTripCheckin = useCallback(
    async (trip: TripLike) => {
      const requestId = String(trip?.id || '').trim();
      if (!requestId || typeof confirmScheduledTripCheckin !== 'function') {
        return;
      }

      try {
        inFlightTripIdRef.current = requestId;
        const confirmationResult = await confirmScheduledTripCheckin(requestId);
        if (confirmationResult && typeof confirmationResult === 'object' && 'success' in confirmationResult) {
          if (!confirmationResult.success) {
            throw new Error(confirmationResult.error || 'Could not confirm this scheduled trip.');
          }
        }
        const updatedTrip =
          confirmationResult && typeof confirmationResult === 'object' && 'trip' in confirmationResult
            ? confirmationResult.trip
            : confirmationResult;
        if (updatedTrip?.id) {
          setAcceptedScheduledRequests((prevTrips) => replaceTripById(prevTrips, updatedTrip));
        }
        await refreshAcceptedScheduledRequests({ silent: true });
      } catch (error) {
        logger.error('DriverScheduledCheckin', 'Failed to confirm scheduled trip check-in', error);
        Alert.alert('Check-in Error', 'Could not confirm this scheduled trip. Please try again.');
      } finally {
        promptedTripIdRef.current = null;
        inFlightTripIdRef.current = null;
      }
    },
    [
      confirmScheduledTripCheckin,
      refreshAcceptedScheduledRequests,
      setAcceptedScheduledRequests,
    ]
  );

  const declineTripCheckin = useCallback(
    async (trip: TripLike) => {
      const requestId = String(trip?.id || '').trim();
      if (!requestId || typeof declineScheduledTripCheckin !== 'function') {
        return;
      }

      try {
        inFlightTripIdRef.current = requestId;
        const declineResult = await declineScheduledTripCheckin(requestId);
        if (declineResult && typeof declineResult === 'object' && 'success' in declineResult) {
          if (!declineResult.success) {
            throw new Error(declineResult.error || 'Could not decline this scheduled trip.');
          }
        }
        setAcceptedScheduledRequests((prevTrips) => removeTripById(prevTrips, requestId));
        await refreshAcceptedScheduledRequests({ silent: true });
      } catch (error) {
        logger.error('DriverScheduledCheckin', 'Failed to decline scheduled trip check-in', error);
        Alert.alert('Check-in Error', 'Could not decline this scheduled trip. Please try again.');
      } finally {
        promptedTripIdRef.current = null;
        inFlightTripIdRef.current = null;
      }
    },
    [
      declineScheduledTripCheckin,
      refreshAcceptedScheduledRequests,
      setAcceptedScheduledRequests,
    ]
  );

  useEffect(() => {
    if (
      !isOnline ||
      hasActiveTrip ||
      typeof confirmScheduledTripCheckin !== 'function' ||
      typeof declineScheduledTripCheckin !== 'function'
    ) {
      return;
    }

    const dueTrip = (Array.isArray(acceptedScheduledRequests) ? acceptedScheduledRequests : []).find((trip) => {
      const checkinState = resolveDriverCheckinState(trip, Date.now());
      return checkinState.shouldPrompt;
    });

    if (!dueTrip?.id) {
      promptedTripIdRef.current = null;
      return;
    }

    if (
      promptedTripIdRef.current === dueTrip.id ||
      inFlightTripIdRef.current === dueTrip.id
    ) {
      return;
    }

    promptedTripIdRef.current = dueTrip.id;
    Alert.alert(
      'Scheduled Trip Check-in',
      getCheckinPromptMessage(dueTrip),
      [
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            void declineTripCheckin(dueTrip);
          },
        },
        {
          text: 'Confirm',
          onPress: () => {
            void confirmTripCheckin(dueTrip);
          },
        },
      ],
      { cancelable: false }
    );
  }, [
    acceptedScheduledRequests,
    confirmScheduledTripCheckin,
    declineScheduledTripCheckin,
    hasActiveTrip,
    isOnline,
    confirmTripCheckin,
    declineTripCheckin,
  ]);
}
