import { logger } from "../../services/logger";

export const openDriverCustomerChat = async ({
  requestData,
  routeRequest,
  getRequestById,
  currentUserId,
  createConversation,
  navigation,
}) => {
  const req = requestData || routeRequest || {};
  const requestId = req.id || req.requestId || req.originalData?.id;
  let customerId =
    req.customerId ||
    req.customer_id ||
    req.originalData?.customerId ||
    req.originalData?.customer_id ||
    req.customerUid ||
    req.customer?.uid ||
    req.customer?.id ||
    req.userId;
  let customerEmail =
    req.customerEmail ||
    req.customer_email ||
    req.originalData?.customerEmail ||
    req.originalData?.customer_email ||
    req.customer?.email ||
    "";

  if (requestId && !customerId) {
    try {
      if (typeof getRequestById === "function") {
        const latestRequest = await getRequestById(requestId);
        customerId =
          latestRequest?.customerId ||
          latestRequest?.customer_id ||
          customerId;
        customerEmail =
          latestRequest?.customerEmail ||
          latestRequest?.customer_email ||
          customerEmail;
      }
    } catch (fetchError) {
      logger.warn("NavigationChatUtils", "Failed to fetch latest request before opening chat", fetchError);
    }
  }

  const customerName =
    req.customerName ||
    req.customer?.name ||
    req.customer?.displayName ||
    (customerEmail ? customerEmail.split("@")[0] : "Customer");

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
    customerId || null,
    currentUserId,
    customerName,
    req.assignedDriverName || ""
  );

  if (!conversationId) {
    return false;
  }

  navigation.navigate("MessageScreen", {
    conversationId,
    requestId,
    driverName: customerName,
  });

  return true;
};
