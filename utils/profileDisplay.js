const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export const firstNonEmptyString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const normalizeAvatarCandidate = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!isObject(value)) {
    return null;
  }

  const nestedCandidate = firstAvatarUrl(
    value.uri,
    value.url,
    value.profileImageUrl,
    value.profile_image_url,
    value.avatarUrl,
    value.avatar_url,
    value.photoUrl,
    value.photo_url,
    value.picture,
    value.imageUrl,
    value.image_url,
    value.source
  );

  if (nestedCandidate) {
    return nestedCandidate;
  }

  return null;
};

export const firstAvatarUrl = (...values) => {
  for (const value of values) {
    const candidate = normalizeAvatarCandidate(value);
    if (candidate) {
      return candidate;
    }
  }
  return null;
};

const getEmailLocalPart = (email) => {
  const emailString = firstNonEmptyString(email);
  if (!emailString) {
    return null;
  }

  const [localPart] = emailString.split('@');
  return firstNonEmptyString(localPart);
};

export const getDisplayNameFromProfile = (
  profile,
  fallbackName = 'User',
  fallbackEmail = null
) => {
  if (!isObject(profile)) {
    return getEmailLocalPart(fallbackEmail) || fallbackName;
  }

  const firstName = firstNonEmptyString(
    profile.first_name,
    profile.firstName,
    profile.given_name,
    profile.givenName
  );
  const lastName = firstNonEmptyString(
    profile.last_name,
    profile.lastName,
    profile.family_name,
    profile.familyName
  );

  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(' ').trim();
  }

  const directName = firstNonEmptyString(
    profile.name,
    profile.displayName,
    profile.full_name,
    profile.fullName,
    profile.username
  );
  if (directName) {
    return directName;
  }

  const emailName = getEmailLocalPart(profile.email || fallbackEmail);
  if (emailName) {
    return emailName;
  }

  return fallbackName;
};

export const getAvatarUrlFromProfile = (profile) => {
  if (!isObject(profile)) {
    return null;
  }

  return firstAvatarUrl(
    profile.profileImageUrl,
    profile.profile_image_url,
    profile.avatarUrl,
    profile.avatar_url,
    profile.photoUrl,
    profile.photo_url,
    profile.photo,
    profile.picture,
    profile.imageUrl,
    profile.image_url
  );
};

export const getInitialsFromName = (displayName, fallback = '?') => {
  const rawName = firstNonEmptyString(displayName);
  if (!rawName) {
    return fallback;
  }

  const emailLocalPart = rawName.includes('@') ? rawName.split('@')[0] : rawName;
  const cleaned = emailLocalPart.replace(/[_\-.]+/g, ' ').trim();
  if (!cleaned) {
    return fallback;
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const firstInitial = tokens[0].charAt(0).toUpperCase();
    const lastInitial = tokens[tokens.length - 1].charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
  }

  const [singleToken = ''] = tokens;
  return singleToken.charAt(0).toUpperCase() || fallback;
};

export const resolveDisplayFromProfile = (
  profile,
  { fallbackName = 'User', fallbackEmail = null } = {}
) => {
  const name = getDisplayNameFromProfile(profile, fallbackName, fallbackEmail);
  const avatarUrl = getAvatarUrlFromProfile(profile);
  const initials = getInitialsFromName(name, '?');

  return {
    name,
    avatarUrl,
    initials,
  };
};

const toObject = (value) => (isObject(value) ? value : {});

export const resolveCustomerDisplayFromRequest = (
  requestLike,
  { fallbackName = 'Customer' } = {}
) => {
  const request = toObject(requestLike);
  const directCustomerString = typeof request.customer === 'string' ? request.customer : null;
  const originalData = toObject(request.originalData);
  const customer = toObject(request.customer || request.customerProfile || request.customer_profile);
  const originalCustomer = toObject(
    originalData.customer || originalData.customerProfile || originalData.customer_profile
  );

  const profile = {
    ...originalCustomer,
    ...customer,
    first_name: firstNonEmptyString(
      request.customerFirstName,
      request.customer_first_name,
      customer.first_name,
      customer.firstName,
      originalCustomer.first_name,
      originalCustomer.firstName
    ),
    last_name: firstNonEmptyString(
      request.customerLastName,
      request.customer_last_name,
      customer.last_name,
      customer.lastName,
      originalCustomer.last_name,
      originalCustomer.lastName
    ),
    name: firstNonEmptyString(
      directCustomerString,
      request.customerName,
      request.customer_name,
      request.customerDisplayName,
      customer.name,
      customer.displayName,
      originalData.customerName,
      originalData.customer_name,
      originalCustomer.name,
      originalCustomer.displayName
    ),
    email: firstNonEmptyString(
      request.customerEmail,
      request.customer_email,
      directCustomerString && directCustomerString.includes('@') ? directCustomerString : null,
      customer.email,
      originalData.customerEmail,
      originalData.customer_email,
      originalCustomer.email
    ),
    profileImageUrl: firstAvatarUrl(
      request.customerAvatarUrl,
      request.customer_avatar_url,
      request.customerProfileImageUrl,
      request.customer_profile_image_url,
      request.customerPhoto,
      customer.profileImageUrl,
      customer.profile_image_url,
      customer.avatarUrl,
      customer.avatar_url,
      customer.photo,
      customer.photoUrl,
      customer.photo_url,
      originalData.customerAvatarUrl,
      originalData.customer_avatar_url,
      originalData.customerProfileImageUrl,
      originalData.customer_profile_image_url,
      originalCustomer.profileImageUrl,
      originalCustomer.profile_image_url,
      originalCustomer.avatarUrl,
      originalCustomer.avatar_url,
      originalCustomer.photo
    ),
  };

  return resolveDisplayFromProfile(profile, {
    fallbackName,
    fallbackEmail: profile.email,
  });
};

export const resolveDriverDisplayFromRequest = (
  requestLike,
  { fallbackName = 'Driver' } = {}
) => {
  const request = toObject(requestLike);
  const directDriverString = typeof request.driver === 'string' ? request.driver : null;
  const originalData = toObject(request.originalData);
  const driver = toObject(
    request.driver ||
      request.assignedDriver ||
      request.driverProfile ||
      request.driver_profile
  );
  const originalDriver = toObject(
    originalData.driver ||
      originalData.assignedDriver ||
      originalData.driverProfile ||
      originalData.driver_profile
  );

  const profile = {
    ...originalDriver,
    ...driver,
    first_name: firstNonEmptyString(
      request.driverFirstName,
      request.driver_first_name,
      request.assignedDriverFirstName,
      request.assigned_driver_first_name,
      driver.first_name,
      driver.firstName,
      originalDriver.first_name,
      originalDriver.firstName
    ),
    last_name: firstNonEmptyString(
      request.driverLastName,
      request.driver_last_name,
      request.assignedDriverLastName,
      request.assigned_driver_last_name,
      driver.last_name,
      driver.lastName,
      originalDriver.last_name,
      originalDriver.lastName
    ),
    name: firstNonEmptyString(
      directDriverString,
      request.driverName,
      request.driver_name,
      request.assignedDriverName,
      request.assigned_driver_name,
      request.driverDisplayName,
      driver.name,
      driver.displayName,
      originalData.driverName,
      originalData.driver_name,
      originalData.assignedDriverName,
      originalData.assigned_driver_name,
      originalDriver.name,
      originalDriver.displayName
    ),
    email: firstNonEmptyString(
      request.driverEmail,
      request.driver_email,
      directDriverString && directDriverString.includes('@') ? directDriverString : null,
      request.assignedDriverEmail,
      request.assigned_driver_email,
      driver.email,
      originalData.driverEmail,
      originalData.driver_email,
      originalData.assignedDriverEmail,
      originalData.assigned_driver_email,
      originalDriver.email
    ),
    profileImageUrl: firstAvatarUrl(
      request.driverAvatarUrl,
      request.driver_avatar_url,
      request.driverProfileImageUrl,
      request.driver_profile_image_url,
      request.assignedDriverAvatarUrl,
      request.assigned_driver_avatar_url,
      request.assignedDriverProfileImageUrl,
      request.assigned_driver_profile_image_url,
      request.driverPhoto,
      request.assignedDriverPhoto,
      driver.profileImageUrl,
      driver.profile_image_url,
      driver.avatarUrl,
      driver.avatar_url,
      driver.photo,
      driver.photoUrl,
      driver.photo_url,
      originalData.driverAvatarUrl,
      originalData.driver_avatar_url,
      originalData.driverProfileImageUrl,
      originalData.driver_profile_image_url,
      originalData.assignedDriverAvatarUrl,
      originalData.assigned_driver_avatar_url,
      originalDriver.profileImageUrl,
      originalDriver.profile_image_url,
      originalDriver.avatarUrl,
      originalDriver.avatar_url,
      originalDriver.photo
    ),
  };

  return resolveDisplayFromProfile(profile, {
    fallbackName,
    fallbackEmail: profile.email,
  });
};
