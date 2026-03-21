import { logger } from "../../services/logger";
import {
  resolveCustomerIdFromRequest,
  resolveDisplayNameFromUser,
  resolveCustomerNameFromRequest,
  resolveDriverNameFromRequest,
} from "../../utils/participantIdentity";

const isGenericName = (value, fallback) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (normalized === String(fallback || "").trim().toLowerCase()) {
    return true;
  }

  return normalized === "not assigned";
};

const pickFirstNonEmptyString = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

const resolveDriverIdFromRequest = (requestLike) =>
  pickFirstNonEmptyString(
    requestLike?.assignedDriverId,
    requestLike?.assigned_driver_id,
    requestLike?.driverId,
    requestLike?.driver_id,
    requestLike?.assignedDriver?.id,
    requestLike?.assignedDriver?.uid,
    requestLike?.driver?.id,
    requestLike?.driver?.uid,
    requestLike?.originalData?.assignedDriverId,
    requestLike?.originalData?.assigned_driver_id,
    requestLike?.originalData?.driverId,
    requestLike?.originalData?.driver_id,
    requestLike?.originalData?.assignedDriver?.id,
    requestLike?.originalData?.assignedDriver?.uid,
    requestLike?.originalData?.driver?.id,
    requestLike?.originalData?.driver?.uid
  );

export const openDriverCustomerChat = async ({
  requestData,
  routeRequest,
  getRequestById,
  getUserProfile,
  currentUserId,
  customerIdHint,
  driverIdHint,
  customerNameHint,
  driverNameHint,
  createConversation,
  navigation,
}) => {
  const req = requestData || routeRequest || {};
  const requestId = req.id || req.requestId || req.originalData?.id;
  let latestRequest = null;
  let customerId = pickFirstNonEmptyString(
    customerIdHint,
    resolveCustomerIdFromRequest(req)
  );
  let driverId = pickFirstNonEmptyString(
    driverIdHint,
    resolveDriverIdFromRequest(req)
  );

  if (requestId && typeof getRequestById === "function") {
    try {
      latestRequest = await getRequestById(requestId);
      customerId = pickFirstNonEmptyString(
        customerId,
        resolveCustomerIdFromRequest(latestRequest)
      );
      driverId = pickFirstNonEmptyString(
        driverId,
        resolveDriverIdFromRequest(latestRequest)
      );
    } catch (fetchError) {
      logger.warn("NavigationChatUtils", "Failed to fetch latest request before opening chat", fetchError);
    }
  }

  const chatRequestContext = {
    ...req,
    ...(latestRequest || {}),
    customer: latestRequest?.customer || req.customer,
    driver: latestRequest?.driver || req.driver,
    originalData: latestRequest?.originalData || req.originalData,
  };
  const conversationCustomerId =
    customerId ||
    (driverId && driverId !== currentUserId ? currentUserId : null);
  const conversationDriverId =
    driverId ||
    (customerId && customerId !== currentUserId ? currentUserId : null);

  let customerName =
    pickFirstNonEmptyString(customerNameHint) ||
    resolveCustomerNameFromRequest(chatRequestContext, "Customer");
  let driverName =
    pickFirstNonEmptyString(driverNameHint) ||
    resolveDriverNameFromRequest(chatRequestContext, "Driver");

  if (typeof getUserProfile === "function") {
    try {
      const [customerProfile, driverProfile] = await Promise.all([
        conversationCustomerId && isGenericName(customerName, "Customer")
          ? getUserProfile(conversationCustomerId, {
            requestId: requestId || undefined,
          })
          : Promise.resolve(null),
        conversationDriverId && isGenericName(driverName, "Driver")
          ? getUserProfile(conversationDriverId, {
            requestId: requestId || undefined,
          })
          : Promise.resolve(null),
      ]);

      if (customerProfile) {
        customerName = resolveDisplayNameFromUser(customerProfile, customerName || "Customer");
      }

      if (driverProfile) {
        driverName = resolveDisplayNameFromUser(driverProfile, driverName || "Driver");
      }
    } catch (profileError) {
      logger.warn("NavigationChatUtils", "Failed to resolve chat participant names from profiles", profileError);
    }
  }

  const isCurrentUserCustomer = conversationCustomerId === currentUserId;
  const peerName = isCurrentUserCustomer ? driverName : customerName;
  const peerId = isCurrentUserCustomer ? conversationDriverId : conversationCustomerId;

  if (!requestId || !currentUserId) {
    logger.error("NavigationChatUtils", "Missing required data for chat", {
      requestId,
      customerId,
      currentUserId,
    });
    return false;
  }

  const conversationId = await createConversation(
    requestId,
    conversationCustomerId,
    conversationDriverId,
    customerName,
    driverName
  );

  if (!conversationId) {
    return false;
  }

  navigation.navigate("MessageScreen", {
    conversationId,
    requestId,
    peerId,
    peerName,
    driverName: peerName,
    customerName,
    customerId: conversationCustomerId,
    driverId: conversationDriverId,
  });

  return true;
};
