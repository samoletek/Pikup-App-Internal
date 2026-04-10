import { isDriverReadinessBypassEnabled } from '../../config/appConfig';
import { TRIP_STATUS, normalizeTripStatus } from '../../constants/tripStatus';

export const DEFAULT_REQUEST_TIMER_SECONDS = 180;

export const REQUEST_POOLS = Object.freeze({
  ASAP: 'asap',
  SCHEDULED: 'scheduled',
});

export const MIN_MOVE_METERS = 100;

export const resolveDriverOnboardingUiState = (user) => {
  const hasUser = Boolean(user && typeof user === 'object');
  if (!hasUser) {
    return {
      showOnboardingRequiredBanner: false,
    };
  }

  const draftVerificationStatus = String(
    user?.metadata?.onboardingDraft?.verificationStatus || ''
  ).toLowerCase();
  const metadataIdentityVerificationStatus = String(
    user?.metadata?.identityVerificationStatus || ''
  ).toLowerCase();
  const metadataOnboardingStatus = String(
    user?.metadata?.onboardingStatus || ''
  ).toLowerCase();
  const isIdentityVerificationDeclined = (
    draftVerificationStatus === 'failed' ||
    metadataIdentityVerificationStatus === 'failed'
  );
  const isOnboardingDeclined = (
    isIdentityVerificationDeclined ||
    metadataOnboardingStatus === 'failed' ||
    metadataOnboardingStatus === 'declined' ||
    metadataOnboardingStatus === 'rejected'
  );
  const rawCanReceivePayments =
    user?.can_receive_payments ??
    user?.canReceivePayments ??
    user?.metadata?.canReceivePayments;
  const hasExplicitPayoutCapability = rawCanReceivePayments === true || rawCanReceivePayments === false;
  const hasKnownOnboardingState = (
    hasExplicitPayoutCapability ||
    Boolean(draftVerificationStatus) ||
    Boolean(metadataIdentityVerificationStatus) ||
    Boolean(metadataOnboardingStatus)
  );

  if (!hasKnownOnboardingState) {
    return {
      showOnboardingRequiredBanner: false,
    };
  }

  const hasPayoutCapability = Boolean(rawCanReceivePayments);
  const requiresAttentionByStatus = (
    metadataOnboardingStatus === 'action_required' ||
    metadataOnboardingStatus === 'requires_input' ||
    metadataOnboardingStatus === 'under_review' ||
    metadataOnboardingStatus === 'pending' ||
    metadataOnboardingStatus === 'incomplete'
  );
  const isOnboardingApproved = hasExplicitPayoutCapability
    ? hasPayoutCapability
    : !requiresAttentionByStatus;

  return {
    showOnboardingRequiredBanner: !isOnboardingApproved || isOnboardingDeclined,
  };
};

export const resolveDriverGeoRestriction = ({
  hasResolvedDriverLocationState,
  driverLocationStateCode,
  supportedStateCodes,
  isSupportedStateCode,
}) => (
  hasResolvedDriverLocationState &&
  Boolean(driverLocationStateCode) &&
  !isSupportedStateCode(driverLocationStateCode, supportedStateCodes)
);

export const resolveDriverConnectAccountId = (user) => {
  const candidate =
    user?.connectAccountId ||
    user?.stripe_account_id ||
    user?.metadata?.connectAccountId ||
    null;
  return String(candidate || '').trim() || null;
};

export const resolveDriverOnboardingDestination = async ({
  currentUser,
  currentUserId,
  getDriverProfile,
}) => {
  const forcePaymentSetupStep = Boolean(
    currentUser?.metadata?.onboardingDebugForcePaymentSetupStep
  );
  let connectAccountId = resolveDriverConnectAccountId(currentUser);

  if (!connectAccountId && currentUserId) {
    try {
      const freshProfile = await getDriverProfile?.(currentUserId);
      connectAccountId = resolveDriverConnectAccountId(freshProfile);
    } catch (_error) {
      // If refresh fails, fallback to onboarding screen.
    }
  }

  return connectAccountId
    ? { screen: 'DriverOnboardingCompleteScreen', params: { connectAccountId } }
    : {
      screen: 'DriverOnboardingScreen',
      params: forcePaymentSetupStep ? { forcePaymentSetupStep: true } : undefined,
    };
};

export const shouldBypassDriverReadiness = (user) => {
  return isDriverReadinessBypassEnabled(user);
};

export const ACTIVE_TRIP_STATUS_LABELS = Object.freeze({
  accepted: 'Driver confirmed',
  inProgress: 'On the way to pickup',
  arrivedAtPickup: 'Arrived at pickup',
  pickedUp: 'Package collected',
  enRouteToDropoff: 'On the way to destination',
  arrivedAtDropoff: 'Arrived at destination',
});

export const resolveRequestOfferExpiry = (request) => {
  const rawExpiry = request?.expiresAt || request?.dispatchOffer?.expiresAt;
  if (!rawExpiry) {
    return null;
  }

  const parsedExpiry = new Date(rawExpiry).getTime();
  return Number.isFinite(parsedExpiry) ? parsedExpiry : null;
};

const hasValidCoordinate = (coords) =>
  Number.isFinite(Number(coords?.longitude)) && Number.isFinite(Number(coords?.latitude));

export const fetchIncomingRouteData = async ({ request, mapboxToken, fetchImpl = fetch }) => {
  const pickupCoords = request?.pickup?.coordinates;
  const dropoffCoords = request?.dropoff?.coordinates;

  if (!hasValidCoordinate(pickupCoords) || !hasValidCoordinate(dropoffCoords) || !mapboxToken) {
    return null;
  }

  const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickupCoords.longitude},${pickupCoords.latitude};${dropoffCoords.longitude},${dropoffCoords.latitude}?geometries=geojson&overview=full&access_token=${mapboxToken}`;
  const response = await fetchImpl(directionsUrl);
  const payload = await response.json();

  if (!Array.isArray(payload?.routes) || payload.routes.length === 0 || !payload.routes[0]?.geometry) {
    return null;
  }

  return {
    route: {
      type: 'Feature',
      properties: {},
      geometry: payload.routes[0].geometry,
    },
    markers: {
      pickup: [pickupCoords.longitude, pickupCoords.latitude],
      dropoff: [dropoffCoords.longitude, dropoffCoords.latitude],
    },
  };
};

export const formatRequestTime = (seconds) => {
  const normalizedSeconds = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(normalizedSeconds / 60)}:${(normalizedSeconds % 60).toString().padStart(2, '0')}`;
};

export const isUnavailableAcceptError = (error) => {
  if (!error) return false;
  if (error?.code === 'REQUEST_UNAVAILABLE') return true;

  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('no longer pending') ||
    message.includes('no longer available') ||
    message.includes('already accepted') ||
    message.includes('accepted by another driver')
  );
};

const toScheduledTimestamp = (value) => {
  if (!value) {
    return Number.NaN;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
};

const CHECKIN_STATUS_FINAL = new Set(['confirmed', 'declined', 'expired', 'not_required']);
const CHECKIN_SHORT_NOTICE_HOURS = 12;
const CHECKIN_STANDARD_HOURS = 24;

export const getScheduledTimeMs = (request) => {
  if (!request || typeof request !== 'object') {
    return Number.NaN;
  }

  const candidates = [
    request.scheduledTime,
    request.scheduled_time,
    request.dispatchRequirements?.scheduledTime,
    request.dispatch_requirements?.scheduledTime,
    request.originalData?.scheduledTime,
    request.originalData?.scheduled_time,
    request.originalData?.dispatchRequirements?.scheduledTime,
    request.originalData?.dispatch_requirements?.scheduledTime,
  ];

  for (const candidate of candidates) {
    const parsed = toScheduledTimestamp(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Number.NaN;
};

export const getAcceptedTimeMs = (request) => {
  if (!request || typeof request !== 'object') {
    return Number.NaN;
  }

  const candidates = [
    request.acceptedAt,
    request.accepted_at,
    request.originalData?.acceptedAt,
    request.originalData?.accepted_at,
    request.updatedAt,
    request.updated_at,
    request.originalData?.updatedAt,
    request.originalData?.updated_at,
    request.createdAt,
    request.created_at,
    request.originalData?.createdAt,
    request.originalData?.created_at,
  ];

  for (const candidate of candidates) {
    const parsed = toScheduledTimestamp(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Number.NaN;
};

export const resolveDriverCheckinState = (request, nowMs = Date.now()) => {
  const scheduledTimeMs = getScheduledTimeMs(request);
  const acceptedTimeMs = getAcceptedTimeMs(request);
  const explicitStatus = String(
    request?.driverCheckinStatus ||
    request?.driver_checkin_status ||
    request?.originalData?.driverCheckinStatus ||
    request?.originalData?.driver_checkin_status ||
    ''
  ).trim().toLowerCase();
  const requiredAtMs = toScheduledTimestamp(
    request?.driverCheckinRequiredAt ||
    request?.driver_checkin_required_at ||
    request?.originalData?.driverCheckinRequiredAt ||
    request?.originalData?.driver_checkin_required_at
  );
  const deadlineAtMs = toScheduledTimestamp(
    request?.driverCheckinDeadlineAt ||
    request?.driver_checkin_deadline_at ||
    request?.originalData?.driverCheckinDeadlineAt ||
    request?.originalData?.driver_checkin_deadline_at
  );

  const hasExplicitNotRequired = explicitStatus === 'not_required';
  const hasValidSchedule = Number.isFinite(scheduledTimeMs);
  const hasValidAcceptedAt = Number.isFinite(acceptedTimeMs);
  const requiresCheckin = hasValidSchedule && !hasExplicitNotRequired;

  if (!requiresCheckin) {
    return {
      requiresCheckin: false,
      status: hasExplicitNotRequired ? 'not_required' : null,
      requiredAtMs: Number.NaN,
      deadlineAtMs: Number.NaN,
      isConfirmed: false,
      isDue: false,
      isOverdue: false,
      shouldPrompt: false,
    };
  }

  let computedRequiredAtMs = requiredAtMs;
  if (!Number.isFinite(computedRequiredAtMs)) {
    const leadHours = hasValidAcceptedAt
      ? (scheduledTimeMs - acceptedTimeMs) / (60 * 60 * 1000)
      : Number.NaN;
    const reminderHours = Number.isFinite(leadHours) && leadHours < CHECKIN_STANDARD_HOURS
      ? CHECKIN_SHORT_NOTICE_HOURS
      : CHECKIN_STANDARD_HOURS;
    const targetReminderMs = scheduledTimeMs - reminderHours * 60 * 60 * 1000;
    computedRequiredAtMs = hasValidAcceptedAt
      ? Math.max(targetReminderMs, acceptedTimeMs)
      : targetReminderMs;
  }

  const computedDeadlineAtMs = Number.isFinite(deadlineAtMs)
    ? deadlineAtMs
    : computedRequiredAtMs;
  const effectiveStatus = explicitStatus || 'pending';
  const isConfirmed = effectiveStatus === 'confirmed';
  const isFinal = CHECKIN_STATUS_FINAL.has(effectiveStatus);
  const isPending = !isFinal || effectiveStatus === 'pending';
  const isDue = Number.isFinite(computedRequiredAtMs) && nowMs >= computedRequiredAtMs;
  const isOverdue = Number.isFinite(computedDeadlineAtMs) && nowMs >= computedDeadlineAtMs;

  return {
    requiresCheckin: true,
    status: effectiveStatus,
    requiredAtMs: computedRequiredAtMs,
    deadlineAtMs: computedDeadlineAtMs,
    isConfirmed,
    isDue,
    isOverdue,
    shouldPrompt: isPending && isDue,
  };
};

export const isScheduledRequestFuture = (request, nowMs = Date.now()) => {
  const scheduledTimeMs = getScheduledTimeMs(request);
  return Number.isFinite(scheduledTimeMs) && scheduledTimeMs > nowMs;
};

export const isScheduledRequestDue = (request, nowMs = Date.now()) => {
  const scheduledTimeMs = getScheduledTimeMs(request);
  return Number.isFinite(scheduledTimeMs) && scheduledTimeMs <= nowMs;
};

export const isAcceptedTrip = (request) =>
  normalizeTripStatus(request?.status) === TRIP_STATUS.ACCEPTED;

export const isAcceptedScheduledRequest = (request) => {
  return isAcceptedTrip(request) && Number.isFinite(getScheduledTimeMs(request));
};

const calculateDistanceMiles = (lat1, lon1, lat2, lon2) => {
  const earthRadiusMiles = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
};

export const movedEnough = (prev, next, minMoveMeters = MIN_MOVE_METERS) => {
  if (!prev) return true;
  const distanceMiles = calculateDistanceMiles(prev.latitude, prev.longitude, next.latitude, next.longitude);
  const distanceMeters = distanceMiles * 1609.34;
  return distanceMeters >= minMoveMeters;
};
