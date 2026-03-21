import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../../services/logger';
import {
  firstNonEmptyString,
  resolveAvatarUrlFromUser,
  resolveCustomerAvatarFromRequest,
  resolveCustomerIdFromRequest,
  resolveCustomerNameFromRequest,
  resolveCustomerRatingFromRequest,
  resolveDisplayNameFromUser,
} from '../../utils/participantIdentity';
import {
  getScheduledTimeMs,
  isAcceptedScheduledRequest,
  resolveDriverCheckinState,
  isScheduledRequestDue,
} from './DriverHomeScreen.utils';
import useScheduledCheckinPrompt from './useScheduledCheckinPrompt';
import {
  isMeaningfulParticipantProfile,
  mergeAcceptedTripWithFallbackPresentation,
  resolveNumericRating,
  resolveParticipantRating,
} from './acceptedScheduledRequestPresentation';

const ACCEPTED_SCHEDULED_REFRESH_MS = 15000;
const CUSTOMER_PROFILE_RETRY_MS = 15000;

const compareByScheduledTimeAsc = (firstTrip, secondTrip) =>
  getScheduledTimeMs(firstTrip) - getScheduledTimeMs(secondTrip);

const filterAcceptedScheduledTripsForDriver = (trips, currentUserId) => {
  return (Array.isArray(trips) ? trips : [])
    .filter((trip) => {
      if (!trip?.id || !currentUserId) {
        return false;
      }

      if (!isAcceptedScheduledRequest(trip)) {
        return false;
      }

      const assignedDriverId =
        trip.driverId ||
        trip.driver_id ||
        trip.assignedDriverId ||
        trip.assigned_driver_id;
      return assignedDriverId === currentUserId;
    })
    .sort(compareByScheduledTimeAsc);
};


export default function useAcceptedScheduledRequests({
  currentUserId,
  getUserPickupRequests,
  getUserProfile,
  confirmScheduledTripCheckin,
  declineScheduledTripCheckin,
  isOnline,
  hasActiveTrip,
  navigation,
  setAcceptedRequestId,
  setActiveJob,
  setShowRequestModal,
  setShowAllRequests,
  setRequestModalMode,
}) {
  const [acceptedScheduledRequests, setAcceptedScheduledRequests] = useState([]);
  const [acceptedScheduledLoading, setAcceptedScheduledLoading] = useState(false);
  const [acceptedScheduledError, setAcceptedScheduledError] = useState(null);
  const lastAutoOpenedScheduledTripIdRef = useRef(null);
  const customerProfileCacheRef = useRef(new Map());
  const customerProfileRetryAtRef = useRef(new Map());

  const enrichAcceptedTripsWithCustomerProfiles = useCallback(async (trips = []) => {
    const normalizedTrips = Array.isArray(trips) ? trips : [];
    if (normalizedTrips.length === 0 || typeof getUserProfile !== 'function') {
      return normalizedTrips;
    }

    const customerRequestMap = new Map();
    normalizedTrips.forEach((trip) => {
      const customerId = resolveCustomerIdFromRequest(trip);
      if (!customerId || customerRequestMap.has(customerId)) {
        return;
      }
      customerRequestMap.set(customerId, trip?.id || trip?.requestId || null);
    });

    const customerIds = Array.from(customerRequestMap.keys());
    const nowMs = Date.now();

    await Promise.all(
      customerIds.map(async (customerId) => {
        if (customerProfileCacheRef.current.has(customerId)) {
          return;
        }
        const nextRetryAtMs = customerProfileRetryAtRef.current.get(customerId) || 0;
        if (nextRetryAtMs > nowMs) {
          return;
        }

        try {
          const profile = await getUserProfile(customerId, {
            requestId: customerRequestMap.get(customerId) || undefined,
          });
          if (isMeaningfulParticipantProfile(profile)) {
            customerProfileCacheRef.current.set(customerId, profile);
            customerProfileRetryAtRef.current.delete(customerId);
            return;
          }
          customerProfileRetryAtRef.current.set(customerId, nowMs + CUSTOMER_PROFILE_RETRY_MS);
        } catch (_error) {
          customerProfileRetryAtRef.current.set(customerId, nowMs + CUSTOMER_PROFILE_RETRY_MS);
        }
      })
    );

    return normalizedTrips.map((trip) => {
      const customerId = resolveCustomerIdFromRequest(trip);
      const customerProfile = customerId
        ? customerProfileCacheRef.current.get(customerId) || null
        : null;

      if (!customerProfile) {
        return trip;
      }

      const customerName = resolveDisplayNameFromUser(
        customerProfile,
        resolveCustomerNameFromRequest(trip, 'Customer')
      );
      const customerAvatarUrl = firstNonEmptyString(
        resolveAvatarUrlFromUser(customerProfile),
        resolveCustomerAvatarFromRequest(trip)
      );
      const customerRating = resolveNumericRating(
        resolveParticipantRating(customerProfile),
        resolveCustomerRatingFromRequest(trip)
      );

      const customerFirstName = firstNonEmptyString(
        customerProfile?.first_name,
        customerProfile?.firstName
      );
      const customerLastName = firstNonEmptyString(
        customerProfile?.last_name,
        customerProfile?.lastName
      );

      return {
        ...trip,
        customerName,
        customerRating,
        customerAvatarUrl: customerAvatarUrl || null,
        customerFirstName,
        customerLastName,
        customer: {
          ...(trip?.customer || {}),
          id: customerId || trip?.customer?.id || null,
          name: customerName,
          email: customerProfile?.email || trip?.customer?.email || null,
          rating: customerRating,
          photo: customerAvatarUrl || null,
          profile_image_url: customerAvatarUrl || null,
          avatar_url: customerAvatarUrl || null,
          first_name: customerFirstName || trip?.customer?.first_name || null,
          last_name: customerLastName || trip?.customer?.last_name || null,
        },
      };
    });
  }, [getUserProfile]);

  const refreshAcceptedScheduledRequests = useCallback(
    async ({ silent = false } = {}) => {
      if (!currentUserId || typeof getUserPickupRequests !== 'function') {
        setAcceptedScheduledRequests([]);
        setAcceptedScheduledError(null);
        return [];
      }

      if (!silent) {
        setAcceptedScheduledLoading(true);
      }

      try {
        const trips = await getUserPickupRequests();
        const filteredTrips = filterAcceptedScheduledTripsForDriver(trips, currentUserId);
        const enrichedTrips = await enrichAcceptedTripsWithCustomerProfiles(filteredTrips);
        setAcceptedScheduledRequests((prevRequests) => {
          const previousMap = new Map(
            (Array.isArray(prevRequests) ? prevRequests : [])
              .filter((requestItem) => Boolean(requestItem?.id))
              .map((requestItem) => [requestItem.id, requestItem])
          );

          return enrichedTrips.map((trip) =>
            mergeAcceptedTripWithFallbackPresentation(trip, previousMap.get(trip.id))
          );
        });
        setAcceptedScheduledError(null);
        return enrichedTrips;
      } catch (refreshError) {
        logger.error('DriverHomeScreen', 'Error loading accepted scheduled requests', refreshError);
        setAcceptedScheduledError('Could not load accepted requests');
        if (!silent) {
          setAcceptedScheduledRequests([]);
        }
        return [];
      } finally {
        if (!silent) {
          setAcceptedScheduledLoading(false);
        }
      }
    },
    [currentUserId, enrichAcceptedTripsWithCustomerProfiles, getUserPickupRequests]
  );

  const appendAcceptedScheduledRequest = useCallback((acceptedRequest) => {
    setAcceptedScheduledRequests((prevRequests) => {
      const withoutDuplicate = prevRequests.filter((requestItem) => requestItem.id !== acceptedRequest?.id);
      return [...withoutDuplicate, acceptedRequest].sort(compareByScheduledTimeAsc);
    });
  }, []);

  useEffect(() => {
    if (!isOnline || hasActiveTrip) {
      return undefined;
    }
    void refreshAcceptedScheduledRequests({ silent: acceptedScheduledRequests.length > 0 });
    const refreshInterval = setInterval(() => {
      void refreshAcceptedScheduledRequests({ silent: true });
    }, ACCEPTED_SCHEDULED_REFRESH_MS);
    return () => {
      clearInterval(refreshInterval);
    };
  }, [acceptedScheduledRequests.length, hasActiveTrip, isOnline, refreshAcceptedScheduledRequests]);

  useScheduledCheckinPrompt({
    acceptedScheduledRequests,
    hasActiveTrip,
    isOnline,
    confirmScheduledTripCheckin,
    declineScheduledTripCheckin,
    refreshAcceptedScheduledRequests,
    setAcceptedScheduledRequests,
  });

  useEffect(() => {
    if (!isOnline || hasActiveTrip || acceptedScheduledRequests.length === 0) {
      return;
    }
    const nowMs = Date.now();
    const dueScheduledRequest = acceptedScheduledRequests.find((trip) => {
      if (!isScheduledRequestDue(trip, nowMs)) {
        return false;
      }
      const checkinState = resolveDriverCheckinState(trip, nowMs);
      if (!checkinState.requiresCheckin) {
        return true;
      }
      return checkinState.isConfirmed;
    });
    if (!dueScheduledRequest || !dueScheduledRequest.id) {
      return;
    }
    if (lastAutoOpenedScheduledTripIdRef.current === dueScheduledRequest.id) {
      return;
    }
    lastAutoOpenedScheduledTripIdRef.current = dueScheduledRequest.id;
    setAcceptedRequestId(dueScheduledRequest.id);
    setActiveJob(dueScheduledRequest);
    setShowRequestModal(false);
    setShowAllRequests(false);
    setRequestModalMode('available');
    navigation.navigate('GpsNavigationScreen', { request: dueScheduledRequest, stage: 'pickup' });
  }, [acceptedScheduledRequests, hasActiveTrip, isOnline, navigation, setAcceptedRequestId, setActiveJob, setRequestModalMode, setShowAllRequests, setShowRequestModal]);

  return {
    acceptedScheduledRequests,
    acceptedScheduledLoading,
    acceptedScheduledError,
    appendAcceptedScheduledRequest,
    refreshAcceptedScheduledRequests,
  };
}
