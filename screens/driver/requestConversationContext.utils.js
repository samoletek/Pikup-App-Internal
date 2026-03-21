const toNonEmptyString = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value).trim();
  }

  return '';
};

const pickFirstNonEmptyString = (...values) => {
  for (const value of values) {
    const normalized = toNonEmptyString(value);
    if (normalized) {
      return normalized;
    }
  }

  return '';
};

export const resolveRequestId = ({ requestData, routeRequest } = {}) => {
  return pickFirstNonEmptyString(
    requestData?.id ||
    routeRequest?.id ||
    requestData?.requestId ||
    routeRequest?.requestId ||
    requestData?.originalData?.id ||
    routeRequest?.originalData?.id ||
    null
  );
};

export const resolveRequestCustomerId = ({ requestData, routeRequest } = {}) => {
  return pickFirstNonEmptyString(
    requestData?.customerId ||
    requestData?.customer_id ||
    requestData?.userId ||
    requestData?.user_id ||
    requestData?.requesterId ||
    requestData?.requester_id ||
    requestData?.customer?.id ||
    requestData?.customer?.uid ||
    requestData?.user?.id ||
    requestData?.user?.uid ||
    requestData?.requester?.id ||
    requestData?.requester?.uid ||
    routeRequest?.customerId ||
    routeRequest?.customer_id ||
    routeRequest?.userId ||
    routeRequest?.user_id ||
    routeRequest?.requesterId ||
    routeRequest?.requester_id ||
    routeRequest?.customer?.id ||
    routeRequest?.customer?.uid ||
    routeRequest?.user?.id ||
    routeRequest?.user?.uid ||
    routeRequest?.requester?.id ||
    routeRequest?.requester?.uid ||
    requestData?.originalData?.customerId ||
    requestData?.originalData?.customer_id ||
    requestData?.originalData?.userId ||
    requestData?.originalData?.user_id ||
    requestData?.originalData?.requesterId ||
    requestData?.originalData?.requester_id ||
    requestData?.originalData?.customer?.id ||
    requestData?.originalData?.customer?.uid ||
    requestData?.originalData?.user?.id ||
    requestData?.originalData?.user?.uid ||
    requestData?.originalData?.requester?.id ||
    requestData?.originalData?.requester?.uid ||
    routeRequest?.originalData?.customerId ||
    routeRequest?.originalData?.customer_id ||
    routeRequest?.originalData?.userId ||
    routeRequest?.originalData?.user_id ||
    routeRequest?.originalData?.requesterId ||
    routeRequest?.originalData?.requester_id ||
    routeRequest?.originalData?.customer?.id ||
    routeRequest?.originalData?.customer?.uid ||
    routeRequest?.originalData?.user?.id ||
    routeRequest?.originalData?.user?.uid ||
    routeRequest?.originalData?.requester?.id ||
    routeRequest?.originalData?.requester?.uid
  );
};

export const resolveRequestDriverId = ({ requestData, routeRequest } = {}) => {
  return pickFirstNonEmptyString(
    requestData?.assignedDriverId ||
    requestData?.assigned_driver_id ||
    requestData?.driverId ||
    requestData?.driver_id ||
    requestData?.assignedDriver?.id ||
    requestData?.assignedDriver?.uid ||
    requestData?.driver?.id ||
    requestData?.driver?.uid ||
    routeRequest?.assignedDriverId ||
    routeRequest?.assigned_driver_id ||
    routeRequest?.driverId ||
    routeRequest?.driver_id ||
    routeRequest?.assignedDriver?.id ||
    routeRequest?.assignedDriver?.uid ||
    routeRequest?.driver?.id ||
    routeRequest?.driver?.uid ||
    requestData?.originalData?.assignedDriverId ||
    requestData?.originalData?.assigned_driver_id ||
    requestData?.originalData?.driverId ||
    requestData?.originalData?.driver_id ||
    requestData?.originalData?.assignedDriver?.id ||
    requestData?.originalData?.assignedDriver?.uid ||
    requestData?.originalData?.driver?.id ||
    requestData?.originalData?.driver?.uid ||
    routeRequest?.originalData?.assignedDriverId ||
    routeRequest?.originalData?.assigned_driver_id ||
    routeRequest?.originalData?.driverId ||
    routeRequest?.originalData?.driver_id ||
    routeRequest?.originalData?.assignedDriver?.id ||
    routeRequest?.originalData?.assignedDriver?.uid ||
    routeRequest?.originalData?.driver?.id ||
    routeRequest?.originalData?.driver?.uid
  );
};

export const resolveConversationUserType = ({ userType, isCustomerView = false } = {}) => {
  return userType === 'customer' || isCustomerView ? 'customer' : 'driver';
};

export const resolveRequestConversationContext = ({
  requestData,
  routeRequest,
  userType,
  isCustomerView = false,
} = {}) => {
  return {
    activeRequestId: resolveRequestId({ requestData, routeRequest }),
    activeRequestCustomerId: resolveRequestCustomerId({ requestData, routeRequest }),
    activeRequestDriverId: resolveRequestDriverId({ requestData, routeRequest }),
    conversationUserType: resolveConversationUserType({ userType, isCustomerView }),
  };
};
