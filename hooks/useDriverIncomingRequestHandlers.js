import { useCallback, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { getTripScheduledAtMs } from '../constants/tripStatus';
import { isUnavailableAcceptError } from '../screens/driver/DriverHomeScreen.utils';
import { logger } from '../services/logger';

const isScheduledRequest = (request) => Number.isFinite(getTripScheduledAtMs(request));
const normalizeRequestId = (value) => String(value || '').trim();

export default function useDriverIncomingRequestHandlers({
  acceptRequest,
  activeRequestPool,
  availableRequests,
  cameraRef,
  clearIncomingRoute,
  declineRequestOffer,
  handleOfferTimeoutRef,
  hasActiveTrip,
  incomingMarkers,
  incomingRequest,
  isAcceptingRequestRef,
  isMinimized,
  isOnline,
  isScheduledPoolActive,
  loadRequests,
  onTripAccepted,
  setAcceptedRequestId,
  setActiveJob,
  setAvailableRequests,
  setIncomingRequest,
  setIsMinimized,
  setShowIncomingModal,
  startDriving,
  showIncomingModal,
}) {
  const miniBarPulse = useRef(new Animated.Value(0)).current;

  const handleIncomingRequestTimeout = useCallback(() => {
    const currentRequestId = normalizeRequestId(incomingRequest?.id);
    const declineOnTimeoutPromise = currentRequestId && typeof declineRequestOffer === 'function'
      ? declineRequestOffer(currentRequestId, { requestPool: activeRequestPool })
        .catch((declineError) => {
          logger.warn('DriverIncomingRequestHandlers', 'Auto-decline on timeout failed', declineError);
        })
      : Promise.resolve();

    setShowIncomingModal(false);
    setIsMinimized(false);
    setIncomingRequest(null);
    clearIncomingRoute();
    setAvailableRequests((prevRequests) =>
      prevRequests.filter((request) => normalizeRequestId(request?.id) !== currentRequestId)
    );
    logger.info('DriverIncomingRequestHandlers', 'Incoming request timed out', { requestId: currentRequestId });

    if (!isScheduledPoolActive && isOnline && !hasActiveTrip) {
      setTimeout(() => {
        void (async () => {
          await declineOnTimeoutPromise;
          await loadRequests(false);
        })();
      }, 1000);
    }
  }, [
    activeRequestPool,
    clearIncomingRoute,
    declineRequestOffer,
    hasActiveTrip,
    incomingRequest?.id,
    isOnline,
    isScheduledPoolActive,
    loadRequests,
    setAvailableRequests,
    setIncomingRequest,
    setIsMinimized,
    setShowIncomingModal,
  ]);

  useEffect(() => {
    handleOfferTimeoutRef.current = handleIncomingRequestTimeout;
  }, [handleIncomingRequestTimeout, handleOfferTimeoutRef]);

  const handleIncomingRequestAccept = useCallback(async (request) => {
    if (isAcceptingRequestRef.current || !request?.id) {
      return;
    }

    try {
      isAcceptingRequestRef.current = true;
      logger.info('DriverIncomingRequestHandlers', 'Accepting incoming request', { requestId: request.id });
      const acceptedRequest = await acceptRequest(request.id);
      let activeAcceptedRequest = acceptedRequest?.id ? acceptedRequest : request;
      const scheduledAtMs = getTripScheduledAtMs(request);
      const isFutureScheduledRequest = Number.isFinite(scheduledAtMs) && scheduledAtMs > Date.now();
      if (!isFutureScheduledRequest && typeof startDriving === 'function') {
        try {
          const startedTrip = await startDriving(activeAcceptedRequest.id, null);
          if (startedTrip?.id) {
            activeAcceptedRequest = startedTrip;
          }
        } catch (startError) {
          logger.warn('DriverIncomingRequestHandlers', 'Failed to mark accepted incoming request as in progress', {
            requestId: activeAcceptedRequest.id,
            error: startError?.message || startError,
          });
        }
      }

      setAcceptedRequestId(activeAcceptedRequest.id);
      setActiveJob(activeAcceptedRequest);
      setAvailableRequests((prevRequests) =>
        prevRequests.filter((item) => item.id !== request.id)
      );
      setShowIncomingModal(false);
      setIsMinimized(false);
      setIncomingRequest(null);
      clearIncomingRoute();

      if (typeof onTripAccepted === 'function') {
        await onTripAccepted(activeAcceptedRequest);
      }
    } catch (error) {
      logger.error('DriverIncomingRequestHandlers', 'Error accepting incoming request', error);
      const normalizedMessage = String(error?.message || '').trim();
      const normalizedLower = normalizedMessage.toLowerCase();

      if (isUnavailableAcceptError(error)) {
        setAvailableRequests((prevRequests) =>
          prevRequests.filter((item) => item.id !== request.id)
        );
        setShowIncomingModal(false);
        setIsMinimized(false);
        setIncomingRequest(null);
        clearIncomingRoute();
        void loadRequests(false);
        alert('This request was already taken by another driver.');
      } else if (
        normalizedLower.includes('payment authorization failed') ||
        normalizedLower.includes('request was returned to pool')
      ) {
        alert('Could not accept request: customer payment hold failed. Request was returned to pool.');
      } else if (normalizedMessage && normalizedLower !== 'failed to accept request') {
        alert(normalizedMessage);
      } else {
        alert('Could not accept request. Please try again.');
      }
    } finally {
      isAcceptingRequestRef.current = false;
    }
  }, [
    acceptRequest,
    clearIncomingRoute,
    isAcceptingRequestRef,
    loadRequests,
    onTripAccepted,
    setAcceptedRequestId,
    setActiveJob,
    setAvailableRequests,
    setIncomingRequest,
    setIsMinimized,
    setShowIncomingModal,
    startDriving,
  ]);

  const handleIncomingRequestDecline = useCallback(() => {
    const currentRequestId = normalizeRequestId(incomingRequest?.id);
    const declinePromise = currentRequestId && typeof declineRequestOffer === 'function'
      ? declineRequestOffer(currentRequestId, { requestPool: activeRequestPool })
      : Promise.resolve();

    setShowIncomingModal(false);
    setIsMinimized(false);
    setIncomingRequest(null);
    clearIncomingRoute();
    logger.info('DriverIncomingRequestHandlers', 'Declined incoming request', { requestId: currentRequestId });

    setAvailableRequests((prevRequests) =>
      prevRequests.filter((request) => normalizeRequestId(request?.id) !== currentRequestId)
    );

    if (!isScheduledPoolActive && isOnline && !hasActiveTrip) {
      void (async () => {
        try {
          await declinePromise;
        } catch (declineError) {
          logger.warn('DriverIncomingRequestHandlers', 'Decline request offer call failed', declineError);
        }
        await loadRequests(false);
      })();
      return;
    }

    void declinePromise.catch((declineError) => {
      logger.warn('DriverIncomingRequestHandlers', 'Decline request offer call failed', declineError);
    });
  }, [
    activeRequestPool,
    clearIncomingRoute,
    declineRequestOffer,
    hasActiveTrip,
    incomingRequest?.id,
    isOnline,
    isScheduledPoolActive,
    loadRequests,
    setAvailableRequests,
    setIncomingRequest,
    setIsMinimized,
    setShowIncomingModal,
  ]);

  const handleIncomingRequestMinimize = useCallback(() => {
    setShowIncomingModal(false);
    setIsMinimized(true);

    if (incomingMarkers) {
      const { pickup, dropoff } = incomingMarkers;
      const sw = [
        Math.min(pickup[0], dropoff[0]) - 0.01,
        Math.min(pickup[1], dropoff[1]) - 0.01,
      ];
      const ne = [
        Math.max(pickup[0], dropoff[0]) + 0.01,
        Math.max(pickup[1], dropoff[1]) + 0.01,
      ];

      if (cameraRef.current) {
        cameraRef.current.fitBounds(ne, sw, [80, 60, 200, 60], 1000);
      }
    }
  }, [cameraRef, incomingMarkers, setIsMinimized, setShowIncomingModal]);

  const handleExpandFromMiniBar = useCallback(() => {
    setIsMinimized(false);
    setShowIncomingModal(true);
  }, [setIsMinimized, setShowIncomingModal]);

  const handleIncomingSnapChange = useCallback((snapIndex) => {
    logger.debug('DriverIncomingRequestHandlers', 'Incoming modal snap', { snapIndex });
  }, []);

  useEffect(() => {
    if (isMinimized && incomingRequest) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(miniBarPulse, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(miniBarPulse, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }

    miniBarPulse.setValue(0);
    return undefined;
  }, [incomingRequest, isMinimized, miniBarPulse]);

  useEffect(() => {
    const firstAsapRequest = availableRequests.find((request) => !isScheduledRequest(request));

    if (
      isOnline &&
      !isScheduledPoolActive &&
      !hasActiveTrip &&
      Boolean(firstAsapRequest) &&
      !showIncomingModal &&
      !incomingRequest &&
      !isMinimized
    ) {
      const timer = setTimeout(() => {
        setIncomingRequest(firstAsapRequest);
        setShowIncomingModal(true);
        logger.info('DriverIncomingRequestHandlers', 'Auto-showing incoming request', {
          requestId: firstAsapRequest.id,
        });
      }, 1000);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [
    availableRequests,
    hasActiveTrip,
    incomingRequest,
    isMinimized,
    isOnline,
    isScheduledPoolActive,
    setIncomingRequest,
    setShowIncomingModal,
    showIncomingModal,
  ]);

  return {
    miniBarPulse,
    handleIncomingRequestAccept,
    handleIncomingRequestDecline,
    handleIncomingRequestMinimize,
    handleIncomingSnapChange,
    handleExpandFromMiniBar,
  };
}
