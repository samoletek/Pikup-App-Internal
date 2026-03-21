import { useCallback } from 'react';
import { isUnavailableAcceptError } from './DriverHomeScreen.utils';
import { logger } from '../../services/logger';
import { getTripScheduledAtMs } from '../../constants/tripStatus';

export default function useDriverHomeRequestActions({
  acceptRequest,
  clearIncomingRoute,
  isAcceptingRequestRef,
  loadRequests,
  navigation,
  refreshProfile,
  reopenRequestModalModeRef,
  reopenRequestModalOnFocusRef,
  setAcceptedRequestId,
  setActiveJob,
  setAvailableRequests,
  setIncomingRequest,
  setIsMinimized,
  setPhoneVerifyVisible,
  setSelectedRequest,
  setShowAllRequests,
  setShowIncomingModal,
  setShowRequestModal,
  showRequestModal,
}) {
  const handleRequestMarkerPress = useCallback((request) => {
    logger.info('DriverHomeRequestActions', 'Request marker pressed', { requestId: request.id });
    setSelectedRequest(request);
    setShowRequestModal(true);
  }, [setSelectedRequest, setShowRequestModal]);

  const handleAcceptRequest = useCallback(async (request) => {
    if (isAcceptingRequestRef.current || !request?.id) {
      return;
    }

    try {
      isAcceptingRequestRef.current = true;
      logger.info('DriverHomeRequestActions', 'Accepting request', { requestId: request.id });
      await acceptRequest(request.id);

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
        void loadRequests(false);
        alert('Scheduled request accepted. It will start closer to pickup time.');
        return;
      }

      setAcceptedRequestId(request.id);
      setActiveJob(request);
      navigation.navigate('GpsNavigationScreen', { request });
    } catch (error) {
      logger.error('DriverHomeRequestActions', 'Error accepting request', error);
      const normalizedMessage = String(error?.message || '').trim();

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
      } else if (normalizedMessage.toLowerCase().includes('conflicts with your accepted schedule')) {
        alert('This request overlaps with your accepted scheduled trips.');
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
    navigation,
    setAcceptedRequestId,
    setActiveJob,
    setAvailableRequests,
    setIncomingRequest,
    setIsMinimized,
    setSelectedRequest,
    setShowAllRequests,
    setShowIncomingModal,
    setShowRequestModal,
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
  }, [setSelectedRequest, setShowAllRequests, setShowRequestModal]);

  const handleClosePhoneVerify = useCallback(() => {
    setPhoneVerifyVisible(false);
  }, [setPhoneVerifyVisible]);

  const handlePhoneVerified = useCallback(async () => {
    setPhoneVerifyVisible(false);
    await refreshProfile();
  }, [refreshProfile, setPhoneVerifyVisible]);

  return {
    handleAcceptRequest,
    handleClosePhoneVerify,
    handleCloseRequestModal,
    handleMessageCustomer,
    handlePhoneVerified,
    handleRequestMarkerPress,
    handleViewRequestDetails,
  };
}
