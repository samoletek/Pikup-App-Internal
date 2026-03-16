const toNonEmptyString = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

export const resolveRequestId = ({ requestData, routeRequest } = {}) => {
  return (
    requestData?.id ||
    routeRequest?.id ||
    requestData?.requestId ||
    routeRequest?.requestId ||
    null
  );
};

export const resolveRequestCustomerId = ({ requestData, routeRequest } = {}) => {
  return toNonEmptyString(
    requestData?.customerId ||
    requestData?.customer_id ||
    requestData?.customer?.id ||
    requestData?.customer?.uid ||
    routeRequest?.customerId ||
    routeRequest?.customer_id ||
    routeRequest?.customer?.id ||
    routeRequest?.customer?.uid ||
    requestData?.originalData?.customerId ||
    requestData?.originalData?.customer_id ||
    routeRequest?.originalData?.customerId ||
    routeRequest?.originalData?.customer_id
  );
};

export const resolveRequestDriverId = ({ requestData, routeRequest } = {}) => {
  return toNonEmptyString(
    requestData?.assignedDriverId ||
    requestData?.driverId ||
    requestData?.driver_id ||
    routeRequest?.assignedDriverId ||
    routeRequest?.driverId ||
    routeRequest?.driver_id
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
