import { useCallback } from 'react';
import { isUnavailableAcceptError } from './DriverHomeScreen.utils';
import { logger } from '../../services/logger';

export default function useDriverHomeRequestActions({
  acceptRequest,
  clearIncomingRoute,
  currentUserId,
  getDriverTrips,
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
  setRecentTrips,
  setRecentTripsLoading,
  setSelectedRequest,
  setShowAllRequests,
  setShowIncomingModal,
  setShowRecentTrips,
  setShowRequestModal,
  showRequestModal,
}) {
  const handleOpenRecentTrips = useCallback(async () => {
    setShowRecentTrips(true);
    setRecentTripsLoading(true);
    try {
      const trips = (await getDriverTrips?.(currentUserId)) || [];
      setRecentTrips(trips);
    } catch (error) {
      logger.error('DriverHomeRequestActions', 'Error loading recent trips', error);
    } finally {
      setRecentTripsLoading(false);
    }
  }, [
    currentUserId,
    getDriverTrips,
    setRecentTrips,
    setRecentTripsLoading,
    setShowRecentTrips,
  ]);

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

      setAcceptedRequestId(request.id);
      setActiveJob(request);
      setAvailableRequests((prev) => prev.filter((item) => item.id !== request.id));

      setShowRequestModal(false);
      setShowAllRequests(false);
      navigation.navigate('GpsNavigationScreen', { request });
    } catch (error) {
      logger.error('DriverHomeRequestActions', 'Error accepting request', error);

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

  const handleCloseRecentTrips = useCallback(() => {
    setShowRecentTrips(false);
  }, [setShowRecentTrips]);

  return {
    handleAcceptRequest,
    handleClosePhoneVerify,
    handleCloseRecentTrips,
    handleCloseRequestModal,
    handleMessageCustomer,
    handleOpenRecentTrips,
    handlePhoneVerified,
    handleRequestMarkerPress,
    handleViewRequestDetails,
  };
}
