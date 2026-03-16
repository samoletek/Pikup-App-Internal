import { createAuthDomainActions } from './actions/authActions';
import { createProfileDomainActions } from './actions/profileActions';
import { createTripDomainActions } from './actions/tripActions';
import { createDriverDomainActions } from './actions/driverActions';
import { createPaymentDomainActions } from './actions/paymentActions';
import { createMessagingDomainActions } from './actions/messagingActions';
import { createTermsDomainActions } from './actions/termsActions';
import { createStorageDomainActions } from './actions/storageActions';

export const createAuthActions = ({
  currentUser,
  userType,
  authFetch,
  setCurrentUser,
  setUserType,
  setLoading,
  setProfileImage
}) => {
  const authActions = createAuthDomainActions({
    currentUser,
    setCurrentUser,
    setUserType,
    setLoading,
  });

  const profileActions = createProfileDomainActions({
    currentUser,
    userType,
    setCurrentUser,
    setProfileImage,
    setLoading,
  });

  const tripActions = createTripDomainActions({ currentUser });
  const driverActions = createDriverDomainActions({ authFetch });

  const paymentActions = createPaymentDomainActions({
    currentUser,
    updateRequestStatus: tripActions.updateRequestStatus,
    getRequestById: tripActions.getRequestById,
    getDriverProfile: driverActions.getDriverProfile,
    calculateDriverEarnings: driverActions.calculateDriverEarnings,
    updateDriverEarnings: driverActions.updateDriverEarnings,
  });

  const messagingActions = createMessagingDomainActions();
  const termsActions = createTermsDomainActions({ currentUser });
  const storageActions = createStorageDomainActions();

  return {
    ...authActions,
    ...tripActions,
    ...profileActions,
    ...driverActions,
    ...paymentActions,
    ...messagingActions,
    ...termsActions,
    ...storageActions,
  };
};
