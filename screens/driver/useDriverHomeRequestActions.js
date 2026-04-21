import { useCallback } from 'react';
import { isUnavailableAcceptError } from './DriverHomeScreen.utils';
import { logger } from '../../services/logger';
import { getTripScheduledAtMs } from '../../constants/tripStatus';

export default function useDriverHomeRequestActions({
  acceptRequest,
  appendAcceptedScheduledRequest,
  clearIncomingRoute,
  driverLocation,
  isAcceptingRequestRef,
  loadRequests,
  navigation,
  onTripAccepted,
  refreshAcceptedScheduledRequests,
  reopenRequestModalModeRef,
  reopenRequestModalOnFocusRef,
  setAcceptedRequestId,
  setActiveJob,
  setAvailableRequests,
  setIncomingRequest,
  setIsMinimized,
  setSelectedRequest,
  setShowAllRequests,
  setShowIncomingModal,
  setShowRequestModal,
  setRequestModalMode,
  startDriving,
  showRequestModal,
}) {
  const isGenericAcceptFailureMessage = useCallback((message) => {
    const normalizedMessage = String(message || '').trim().toLowerCase();
    if (!normalizedMessage) {
      return true;
    }

    return (
      normalizedMessage === 'failed to accept request' ||
      normalizedMessage === 'something went wrong. please try again.'
    );
  }, []);

  const handleRequestMarkerPress = useCallback((request) => {
    logger.info('DriverHomeRequestActions', 'Request marker pressed', { requestId: request.id });
    setRequestModalMode?.('available');
    setSelectedRequest(request);
    setShowRequestModal(true);
  }, [setRequestModalMode, setSelectedRequest, setShowRequestModal]);

  const handleAcceptRequest = useCallback(async (request) => {
    if (isAcceptingRequestRef.current || !request?.id) {
      return;
    }

    try {
      isAcceptingRequestRef.current = true;
      logger.info('DriverHomeRequestActions', 'Accepting request', { requestId: request.id });
      const acceptedRequest = await acceptRequest(request.id);

      const scheduledAtMs = getTripScheduledAtMs(request);
      const isFutureScheduledRequest = Number.isFinite(scheduledAtMs) && scheduledAtMs > Date.now();

      setAvailableRequests((prev) => prev.filter((item) => item.id !== request.id));
      setShowRequestModal(false);
      setShowAllRequests(false);

      if (isFutureScheduledRequest) {
        logger.info('DriverHomeRequestActions', 'Scheduled request accepted for future start', {
          requestId: request.id,
          scheduledAtMs,
        });
        const acceptedScheduledRequest = acceptedRequest?.id
          ? acceptedRequest
          : {
            ...request,
            status: 'accepted',
            driverId: request?.driverId || request?.driver_id || null,
          };
        if (acceptedScheduledRequest?.id && typeof appendAcceptedScheduledRequest === 'function') {
          appendAcceptedScheduledRequest(acceptedScheduledRequest);
        }
        if (typeof refreshAcceptedScheduledRequests === 'function') {
          void refreshAcceptedScheduledRequests({ silent: true });
        }
        void loadRequests(false);
        alert('Scheduled request accepted. It will start closer to pickup time.');
        return;
      }

      let activeAcceptedRequest = acceptedRequest?.id ? acceptedRequest : request;
      if (typeof startDriving === 'function') {
        try {
          const startedTrip = await startDriving(activeAcceptedRequest.id, driverLocation || null);
          if (startedTrip?.id) {
            activeAcceptedRequest = startedTrip;
          }
        } catch (startError) {
          logger.warn('DriverHomeRequestActions', 'Failed to mark accepted request as in progress', {
            requestId: activeAcceptedRequest.id,
            error: startError?.message || startError,
          });
        }
      }
      setAcceptedRequestId(activeAcceptedRequest.id);
      setActiveJob(activeAcceptedRequest);
      if (typeof onTripAccepted === 'function') {
        await onTripAccepted(activeAcceptedRequest);
      }
    } catch (error) {
      logger.error('DriverHomeRequestActions', 'Error accepting request', error);
      const normalizedMessage = String(error?.message || '').trim();
      const normalizedLower = normalizedMessage.toLowerCase();

      if (isUnavailableAcceptError(error)) {
        setAvailableRequests((prev) => prev.filter((item) => item.id !== request.id));
        setSelectedRequest((prev) => (prev?.id === request.id ? null : prev));
        setShowRequestModal(false);
        setShowIncomingModal(false);
        setIsMinimized(false);
        setIncomingRequest((prev) => (prev?.id === request.id ? null : prev));
        clearIncomingRoute();
        void loadRequests(false);
        alert('This request was already taken by another driver.');
      } else if (
        normalizedLower.includes('conflicts with your accepted schedule') ||
        normalizedLower.includes('conflicts with your current schedule')
      ) {
        alert('This request overlaps with your accepted scheduled trips.');
      } else if (
        normalizedLower.includes('payment authorization failed') ||
        normalizedLower.includes('request was returned to pool')
      ) {
        alert('Could not accept request: customer payment hold failed. Request was returned to pool.');
      } else if (!isGenericAcceptFailureMessage(normalizedMessage)) {
        alert(normalizedMessage);
      } else {
        alert('Could not accept request. Please try again.');
      }
    } finally {
      isAcceptingRequestRef.current = false;
    }
  }, [
    acceptRequest,
    appendAcceptedScheduledRequest,
    clearIncomingRoute,
    driverLocation,
    isAcceptingRequestRef,
    isGenericAcceptFailureMessage,
    loadRequests,
    onTripAccepted,
    refreshAcceptedScheduledRequests,
    setAcceptedRequestId,
    setActiveJob,
    setAvailableRequests,
    setIncomingRequest,
    setIsMinimized,
    setSelectedRequest,
    setShowAllRequests,
    setShowIncomingModal,
    setShowRequestModal,
    startDriving,
  ]);

  const handleViewRequestDetails = useCallback((request) => {
    if (!request) return;
    reopenRequestModalOnFocusRef.current = true;
    reopenRequestModalModeRef.current = showRequestModal ? 'single' : 'all';
    setShowRequestModal(false);
    setShowAllRequests(false);
    setSelectedRequest(null);
    navigation.navigate('DriverRequestDetailsScreen', { request });
  }, [
    navigation,
    reopenRequestModalModeRef,
    reopenRequestModalOnFocusRef,
    setSelectedRequest,
    setShowAllRequests,
    setShowRequestModal,
    showRequestModal,
  ]);

  const handleMessageCustomer = useCallback((request) => {
    setShowRequestModal(false);
    // TODO: Start conversation with customer
    logger.info('DriverHomeRequestActions', 'Starting conversation with customer', {
      requestId: request.id,
    });
  }, [setShowRequestModal]);

  const handleCloseRequestModal = useCallback(() => {
    setShowRequestModal(false);
    setShowAllRequests(false);
    setSelectedRequest(null);
    setRequestModalMode?.('available');
  }, [setRequestModalMode, setSelectedRequest, setShowAllRequests, setShowRequestModal]);

  return {
    handleAcceptRequest,
    handleCloseRequestModal,
    handleMessageCustomer,
    handleRequestMarkerPress,
    handleViewRequestDetails,
  };
}
