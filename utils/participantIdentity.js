const toTrimmedString = (value) => {
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

const asObject = (value) => {
  return value && typeof value === 'object' ? value : {};
};

const hasEntries = (value) => Object.keys(value).length > 0;

export const firstNonEmptyString = (...values) => {
  for (const value of values) {
    const normalized = toTrimmedString(value);
    if (normalized) {
      return normalized;
    }
  }

  return '';
};

export const getEmailLocalPart = (email) => {
  const normalized = toTrimmedString(email);
  if (!normalized) {
    return '';
  }

  const [localPart] = normalized.split('@');
  return toTrimmedString(localPart);
};

export const resolveDisplayNameFromFields = ({
  firstName,
  lastName,
  fullName,
  displayName,
  email,
  fallback = 'User',
} = {}) => {
  const normalizedFirstName = toTrimmedString(firstName);
  const normalizedLastName = toTrimmedString(lastName);
  const combinedName = [normalizedFirstName, normalizedLastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (combinedName) {
    return combinedName;
  }

  const explicitName = firstNonEmptyString(fullName, displayName);
  if (explicitName) {
    return explicitName;
  }

  const emailLocalPart = getEmailLocalPart(email);
  if (emailLocalPart) {
    return emailLocalPart;
  }

  return fallback;
};

export const resolveDisplayNameFromUser = (userLike, fallback = 'User') => {
  const user = asObject(userLike);

  return resolveDisplayNameFromFields({
    firstName: firstNonEmptyString(user.first_name, user.firstName),
    lastName: firstNonEmptyString(user.last_name, user.lastName),
    fullName: firstNonEmptyString(user.name, user.fullName),
    displayName: firstNonEmptyString(user.displayName),
    email: firstNonEmptyString(user.email),
    fallback,
  });
};

const resolveParticipantProfile = (requestLike, participantKey) => {
  const requestObject = asObject(requestLike);
  const originalData = asObject(requestObject.originalData);
  const profileAlias =
    participantKey === 'customer'
      ? ['customerProfile', 'customer_profile', 'user', 'requester']
      : ['driverProfile', 'driver_profile', 'assignedDriver', 'assigned_driver'];

  const directProfile = asObject(requestObject[participantKey]);
  for (const alias of profileAlias) {
    if (hasEntries(directProfile)) {
      break;
    }
    const aliasValue = asObject(requestObject[alias]);
    if (hasEntries(aliasValue)) {
      return aliasValue;
    }
  }

  if (hasEntries(directProfile)) {
    return directProfile;
  }

  const originalProfile = asObject(originalData[participantKey]);
  if (hasEntries(originalProfile)) {
    return originalProfile;
  }

  for (const alias of profileAlias) {
    const aliasValue = asObject(originalData[alias]);
    if (hasEntries(aliasValue)) {
      return aliasValue;
    }
  }

  return {};
};

const resolveParticipantIdFromRequest = (requestLike, participantKey) => {
  const requestObject = asObject(requestLike);
  const originalData = asObject(requestObject.originalData);
  const participant = resolveParticipantProfile(requestObject, participantKey);

  const idCandidates =
    participantKey === 'customer'
      ? [
          requestObject.customerId,
          requestObject.customer_id,
          requestObject.customerUid,
          requestObject.userId,
          requestObject.user_id,
          requestObject.requesterId,
          requestObject.requester_id,
          requestObject.user?.id,
          requestObject.user?.uid,
          participant.id,
          participant.uid,
          originalData.customerId,
          originalData.customer_id,
          originalData.userId,
          originalData.user_id,
          originalData.requesterId,
          originalData.requester_id,
          originalData.user?.id,
          originalData.user?.uid,
        ]
      : [
          requestObject.assignedDriverId,
          requestObject.assigned_driver_id,
          requestObject.driverId,
          requestObject.driver_id,
          participant.id,
          participant.uid,
          originalData.assignedDriverId,
          originalData.assigned_driver_id,
          originalData.driverId,
          originalData.driver_id,
        ];

  return firstNonEmptyString(...idCandidates);
};

export const resolveCustomerIdFromRequest = (requestLike) =>
  resolveParticipantIdFromRequest(requestLike, 'customer');

export const resolveCustomerNameFromRequest = (requestLike, fallback = 'Customer') => {
  const requestObject = asObject(requestLike);
  const originalData = asObject(requestObject.originalData);
  const customer = resolveParticipantProfile(requestObject, 'customer');
  const requester = asObject(requestObject.requester);
  const user = asObject(requestObject.user);
  const originalUser = asObject(originalData.user);
  const originalRequester = asObject(originalData.requester);

  return resolveDisplayNameFromFields({
    firstName: firstNonEmptyString(
      requestObject.customerFirstName,
      requestObject.customer_first_name,
      requestObject.userFirstName,
      requestObject.user_first_name,
      requestObject.first_name,
      requestObject.firstName,
      customer.first_name,
      customer.firstName,
      requester.first_name,
      requester.firstName,
      user.first_name,
      user.firstName,
      originalData.customerFirstName,
      originalData.customer_first_name,
      originalData.userFirstName,
      originalData.user_first_name,
      originalData.first_name,
      originalData.firstName,
      originalRequester.first_name,
      originalRequester.firstName,
      originalUser.first_name,
      originalUser.firstName
    ),
    lastName: firstNonEmptyString(
      requestObject.customerLastName,
      requestObject.customer_last_name,
      requestObject.userLastName,
      requestObject.user_last_name,
      requestObject.last_name,
      requestObject.lastName,
      customer.last_name,
      customer.lastName,
      requester.last_name,
      requester.lastName,
      user.last_name,
      user.lastName,
      originalData.customerLastName,
      originalData.customer_last_name,
      originalData.userLastName,
      originalData.user_last_name,
      originalData.last_name,
      originalData.lastName,
      originalRequester.last_name,
      originalRequester.lastName,
      originalUser.last_name,
      originalUser.lastName
    ),
    fullName: firstNonEmptyString(
      requestObject.customerName,
      requestObject.customer_name,
      requestObject.userName,
      requestObject.user_name,
      requestObject.name,
      requestObject.fullName,
      requestObject.full_name,
      customer.name,
      requester.name,
      user.name,
      user.fullName,
      user.full_name,
      originalData.customerName,
      originalData.customer_name,
      originalData.userName,
      originalData.user_name,
      originalData.name,
      originalData.fullName,
      originalData.full_name,
      originalRequester.name,
      originalUser.name,
      originalUser.fullName,
      originalUser.full_name
    ),
    displayName: firstNonEmptyString(
      requestObject.customerDisplayName,
      requestObject.customer_display_name,
      requestObject.displayName,
      requestObject.display_name,
      customer.displayName,
      requester.displayName,
      user.displayName,
      originalData.customerDisplayName,
      originalData.customer_display_name,
      originalData.displayName,
      originalData.display_name,
      originalRequester.displayName,
      originalUser.displayName
    ),
    email: firstNonEmptyString(
      requestObject.customerEmail,
      requestObject.customer_email,
      requestObject.userEmail,
      requestObject.user_email,
      requestObject.email,
      customer.email,
      requester.email,
      user.email,
      originalData.customerEmail,
      originalData.customer_email,
      originalData.userEmail,
      originalData.user_email,
      originalData.email,
      originalRequester.email,
      originalUser.email
    ),
    fallback,
  });
};

export const resolveDriverNameFromRequest = (requestLike, fallback = 'Driver') => {
  const requestObject = asObject(requestLike);
  const originalData = asObject(requestObject.originalData);
  const driver = resolveParticipantProfile(requestObject, 'driver');
  const assignedDriver = asObject(requestObject.assignedDriver);
  const originalAssignedDriver = asObject(originalData.assignedDriver);

  return resolveDisplayNameFromFields({
    firstName: firstNonEmptyString(
      requestObject.assignedDriverFirstName,
      requestObject.assigned_driver_first_name,
      requestObject.driverFirstName,
      requestObject.driver_first_name,
      driver.first_name,
      driver.firstName,
      assignedDriver.first_name,
      assignedDriver.firstName,
      originalData.assignedDriverFirstName,
      originalData.assigned_driver_first_name,
      originalData.driverFirstName,
      originalData.driver_first_name,
      originalAssignedDriver.first_name,
      originalAssignedDriver.firstName
    ),
    lastName: firstNonEmptyString(
      requestObject.assignedDriverLastName,
      requestObject.assigned_driver_last_name,
      requestObject.driverLastName,
      requestObject.driver_last_name,
      driver.last_name,
      driver.lastName,
      assignedDriver.last_name,
      assignedDriver.lastName,
      originalData.assignedDriverLastName,
      originalData.assigned_driver_last_name,
      originalData.driverLastName,
      originalData.driver_last_name,
      originalAssignedDriver.last_name,
      originalAssignedDriver.lastName
    ),
    fullName: firstNonEmptyString(
      requestObject.assignedDriverName,
      requestObject.assigned_driver_name,
      requestObject.driverName,
      requestObject.driver_name,
      driver.name,
      assignedDriver.name,
      originalData.assignedDriverName,
      originalData.assigned_driver_name,
      originalData.driverName,
      originalData.driver_name,
      originalAssignedDriver.name,
      originalData.driver
    ),
    displayName: firstNonEmptyString(
      requestObject.assignedDriverDisplayName,
      requestObject.assigned_driver_display_name,
      requestObject.driverDisplayName,
      requestObject.driver_display_name,
      driver.displayName,
      assignedDriver.displayName,
      originalData.assignedDriverDisplayName,
      originalData.assigned_driver_display_name,
      originalData.driverDisplayName,
      originalData.driver_display_name,
      originalAssignedDriver.displayName
    ),
    email: firstNonEmptyString(
      requestObject.assignedDriverEmail,
      requestObject.assigned_driver_email,
      requestObject.driverEmail,
      requestObject.driver_email,
      driver.email,
      assignedDriver.email,
      originalData.assignedDriverEmail,
      originalData.assigned_driver_email,
      originalData.driverEmail,
      originalData.driver_email,
      originalAssignedDriver.email
    ),
    fallback,
  });
};

export const resolveAvatarUrlFromUser = (userLike) => {
  const user = asObject(userLike);

  return firstNonEmptyString(
    user.profileImageUrl,
    user.profile_image_url,
    user.avatarUrl,
    user.avatar_url,
    user.photo,
    user.photo_url,
    user.imageUrl,
    user.image_url
  );
};

export const resolveDriverAvatarFromRequest = (requestLike) => {
  const requestObject = asObject(requestLike);
  const originalData = asObject(requestObject.originalData);
  const driver = resolveParticipantProfile(requestObject, 'driver');
  const originalDriver = resolveParticipantProfile(originalData, 'driver');

  return firstNonEmptyString(
    requestObject.driverPhoto,
    requestObject.assignedDriverPhoto,
    requestObject.driverAvatarUrl,
    requestObject.driver_avatar_url,
    requestObject.assignedDriverAvatarUrl,
    requestObject.assigned_driver_avatar_url,
    resolveAvatarUrlFromUser(driver),
    resolveAvatarUrlFromUser(originalDriver)
  );
};

export const resolveCustomerAvatarFromRequest = (requestLike) => {
  const requestObject = asObject(requestLike);
  const originalData = asObject(requestObject.originalData);
  const customer = resolveParticipantProfile(requestObject, 'customer');
  const originalCustomer = resolveParticipantProfile(originalData, 'customer');

  return firstNonEmptyString(
    requestObject.customerPhoto,
    requestObject.customerAvatarUrl,
    requestObject.customer_avatar_url,
    requestObject.customerProfileImageUrl,
    requestObject.customer_profile_image_url,
    resolveAvatarUrlFromUser(customer),
    resolveAvatarUrlFromUser(originalCustomer)
  );
};

const resolveNumericRating = (...values) => {
  for (const value of values) {
    const normalizedValue =
      typeof value === 'string' ? value.replace(',', '.').trim() : value;
    const directNumeric = Number(normalizedValue);
    const fallbackMatch =
      typeof normalizedValue === 'string'
        ? normalizedValue.match(/-?\d+(?:\.\d+)?/)
        : null;
    const fallbackNumeric = fallbackMatch?.[0] ? Number(fallbackMatch[0]) : Number.NaN;
    const numeric = Number.isFinite(directNumeric) ? directNumeric : fallbackNumeric;
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.max(0, Math.min(numeric, 5));
    }
  }

  return null;
};

export const resolveCustomerRatingFromRequest = (requestLike) => {
  const requestObject = asObject(requestLike);
  const originalData = asObject(requestObject.originalData);
  const customer = resolveParticipantProfile(requestObject, 'customer');
  const originalCustomer = resolveParticipantProfile(originalData, 'customer');
  const customerMetadata = asObject(customer.metadata);
  const originalCustomerMetadata = asObject(originalCustomer.metadata);

  return resolveNumericRating(
    requestObject.customerRating,
    requestObject.customer_rating,
    requestObject.customerAverageRating,
    requestObject.customer_average_rating,
    requestObject.avgCustomerRating,
    requestObject.avg_customer_rating,
    customer.rating,
    customer.userRating,
    customer.customer_rating,
    customer.averageRating,
    customer.average_rating,
    customer.avgRating,
    customer.avg_rating,
    customerMetadata.rating,
    customerMetadata.averageRating,
    customerMetadata.average_rating,
    customerMetadata.avgRating,
    customerMetadata.avg_rating,
    originalData.customerRating,
    originalData.customer_rating,
    originalData.customerAverageRating,
    originalData.customer_average_rating,
    originalData.avgCustomerRating,
    originalData.avg_customer_rating,
    originalCustomer.rating,
    originalCustomer.userRating,
    originalCustomer.customer_rating,
    originalCustomer.averageRating,
    originalCustomer.average_rating,
    originalCustomer.avgRating,
    originalCustomer.avg_rating,
    originalCustomerMetadata.rating,
    originalCustomerMetadata.averageRating,
    originalCustomerMetadata.average_rating,
    originalCustomerMetadata.avgRating,
    originalCustomerMetadata.avg_rating
  );
};
