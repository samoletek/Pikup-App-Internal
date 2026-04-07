import { TRIP_STATUS, normalizeTripStatus } from "../../constants/tripStatus";
import { typography } from "../../styles/theme";
import {
  STATUS_STEPS,
  firstText,
  formatAmount,
  formatDateTime,
  formatReason,
  formatScheduleLabel,
  getProgressIndex,
  getRatingLabel,
  normalizeBadgeIds,
  normalizeRating,
  statusMeta,
} from "../../utils/tripDetails/formatStatusUtils";
import {
  getDropoffPhotoCandidates,
  getPickupPhotoCandidates,
  resolvePhotoUrisAsync,
  toArray,
} from "../../utils/tripDetails/photoUtils";
import { resolveDriverDisplayFromRequest } from "../../utils/profileDisplay";
import {
  firstNonEmptyString as firstParticipantString,
  resolveAvatarUrlFromUser,
  resolveDisplayNameFromUser,
} from "../../utils/participantIdentity";

export const ICON_SIZE_SMALL = typography.fontSize.sm + 2;
export const ICON_SIZE_BASE = typography.fontSize.md;
export const STAR_SIZE = 32;
export const TRIP_DETAILS_AUTO_SYNC_INTERVAL_MS = 5000;

export {
  STATUS_STEPS,
  formatDateTime,
  formatReason,
  getRatingLabel,
  normalizeBadgeIds,
  normalizeRating,
  resolvePhotoUrisAsync,
};

export const isCustomerTripPreArrivalCancellable = (status) => {
  const normalizedStatus = normalizeTripStatus(status);
  return (
    normalizedStatus === TRIP_STATUS.PENDING ||
    normalizedStatus === TRIP_STATUS.ACCEPTED ||
    normalizedStatus === TRIP_STATUS.IN_PROGRESS
  );
};

export const buildCustomerTripInfoRows = (displayTrip) => ([
  {
    label: "Vehicle",
    value: `${displayTrip.driverVehicleLabel} • ${displayTrip.driverPlateLabel}`,
  },
  {
    label: "Items",
    value: `${displayTrip.itemsCount} item${displayTrip.itemsCount === 1 ? "" : "s"}`,
  },
  { label: "Scheduled", value: displayTrip.scheduleLabel },
  { label: "Driver", value: displayTrip.driverName },
]);

export const getDriverCancellationAlertState = ({
  displayTrip,
  previousStatus,
  lastAlertTripId,
}) => {
  const currentStatus = normalizeTripStatus(displayTrip?.status);
  const cancellationReason = String(displayTrip?.cancellationReason || "")
    .trim()
    .toLowerCase();
  const tripIdValue = String(displayTrip?.id || "").trim();
  const shouldShowDriverCancellationAlert = (
    currentStatus === "cancelled" &&
    previousStatus !== "cancelled" &&
    cancellationReason === "driver_request" &&
    tripIdValue &&
    lastAlertTripId !== tripIdValue
  );

  return {
    currentStatus,
    cancellationReason,
    tripIdValue,
    shouldShowDriverCancellationAlert,
  };
};

const resolveNumericRating = (...values) => {
  for (const value of values) {
    const normalizedValue = typeof value === "string" ? value.replace(",", ".").trim() : value;
    const directNumeric = Number(normalizedValue);
    const fallbackMatch =
      typeof normalizedValue === "string"
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

const resolveDriverRatingValue = (source = {}, driverProfile = null) => {
  const sourceDriver =
    source.driver && typeof source.driver === "object" && !Array.isArray(source.driver)
      ? source.driver
      : {};
  const sourceAssignedDriver =
    source.assignedDriver &&
    typeof source.assignedDriver === "object" &&
    !Array.isArray(source.assignedDriver)
      ? source.assignedDriver
      : {};
  const originalData =
    source.originalData && typeof source.originalData === "object" && !Array.isArray(source.originalData)
      ? source.originalData
      : {};
  const originalDriver =
    originalData.driver &&
    typeof originalData.driver === "object" &&
    !Array.isArray(originalData.driver)
      ? originalData.driver
      : {};
  const profile =
    driverProfile && typeof driverProfile === "object" && !Array.isArray(driverProfile)
      ? driverProfile
      : {};
  const profileMetadata =
    profile.metadata && typeof profile.metadata === "object" && !Array.isArray(profile.metadata)
      ? profile.metadata
      : {};

  return resolveNumericRating(
    source.driverRating,
    source.driver_rating,
    source.driverAverageRating,
    source.driver_average_rating,
    source.avgDriverRating,
    source.avg_driver_rating,
    sourceDriver.rating,
    sourceDriver.userRating,
    sourceDriver.driver_rating,
    sourceDriver.averageRating,
    sourceDriver.average_rating,
    sourceDriver.avgRating,
    sourceDriver.avg_rating,
    sourceAssignedDriver.rating,
    sourceAssignedDriver.userRating,
    sourceAssignedDriver.driver_rating,
    sourceAssignedDriver.averageRating,
    sourceAssignedDriver.average_rating,
    sourceAssignedDriver.avgRating,
    sourceAssignedDriver.avg_rating,
    originalData.driverRating,
    originalData.driver_rating,
    originalData.driverAverageRating,
    originalData.driver_average_rating,
    originalData.avgDriverRating,
    originalData.avg_driver_rating,
    originalDriver.rating,
    originalDriver.userRating,
    originalDriver.driver_rating,
    originalDriver.averageRating,
    originalDriver.average_rating,
    originalDriver.avgRating,
    originalDriver.avg_rating,
    profile.rating,
    profile.userRating,
    profile.driver_rating,
    profile.averageRating,
    profile.average_rating,
    profile.avgRating,
    profile.avg_rating,
    profileMetadata.rating,
    profileMetadata.driverRating,
    profileMetadata.driver_rating,
    profileMetadata.averageRating,
    profileMetadata.average_rating,
    profileMetadata.avgRating,
    profileMetadata.avg_rating
  );
};

export const toDisplayTrip = (trip, fallback, options = {}) => {
  const { driverProfile = null } = options;
  const source = trip || fallback || {};
  const pricingTotal = source.pricing?.total ?? source.price;
  const insurancePremium = source.insurance?.premium ?? source.insurance_premium ?? 0;
  const priceWithoutInsurance = Math.max(0, (pricingTotal || 0) - (insurancePremium || 0));

  const itemsFromArray = Array.isArray(source.items) ? source.items : [];
  const normalizedItem =
    typeof source.item === "string"
      ? { description: source.item }
      : source.item || null;
  const hasSingleItem = Boolean(normalizedItem);
  const itemsCount = itemsFromArray.length || (hasSingleItem ? 1 : 0);

  const primaryItem =
    normalizedItem?.description ||
    itemsFromArray[0]?.description ||
    firstText(source.item, source.tripItem) ||
    "Package";

  const pickupAddress = firstText(
    source.pickup?.address,
    source.pickupAddress,
    source.pickup
  ) || "Unknown pickup";

  const dropoffAddress = firstText(
    source.dropoff?.address,
    source.dropoffAddress,
    source.dropoff
  ) || "Unknown drop-off";

  const createdAt =
    source.createdAt || source.created_at || source.timestamp || source.date || null;

  const status = normalizeTripStatus(source.status);
  const scheduledTime = source.scheduledTime || source.scheduled_time || null;
  const scheduledAtMs = new Date(scheduledTime || '').getTime();
  const isScheduledFuture = (
    Number.isFinite(scheduledAtMs) &&
    scheduledAtMs > Date.now() &&
    (status === 'accepted' || status === 'pending')
  );
  const meta = statusMeta(status, { isScheduledFuture });
  const id = String(source.id || fallback?.id || "Unknown");

  const driverDisplay = resolveDriverDisplayFromRequest(source, {
    fallbackName: "Not assigned",
  });
  const profileDriverName = resolveDisplayNameFromUser(driverProfile, "");
  const driverName =
    firstParticipantString(
      profileDriverName.toLowerCase() === "user" ? "" : profileDriverName,
      driverDisplay.name
    ) || "Not assigned";
  const driverAvatarUrl =
    firstParticipantString(resolveAvatarUrlFromUser(driverProfile), driverDisplay.avatarUrl) || null;
  const driverRatingValue = resolveDriverRatingValue(source, driverProfile);
  const driverRatingStars = Number.isFinite(driverRatingValue)
    ? Math.max(0, Math.min(5, Math.round(driverRatingValue)))
    : 0;
  const driverRatingLabel = Number.isFinite(driverRatingValue)
    ? driverRatingValue.toFixed(1)
    : null;
  const driverId =
    source.assignedDriverId ||
    source.driverId ||
    source.driver_id ||
    source.assigned_driver_id ||
    null;
  const originalData =
    source.originalData && typeof source.originalData === "object" && !Array.isArray(source.originalData)
      ? source.originalData
      : {};
  const sourceDriver =
    source.driver && typeof source.driver === "object" && !Array.isArray(source.driver)
      ? source.driver
      : {};
  const sourceAssignedDriver =
    source.assignedDriver &&
    typeof source.assignedDriver === "object" &&
    !Array.isArray(source.assignedDriver)
      ? source.assignedDriver
      : {};
  const originalDriver =
    originalData.driver && typeof originalData.driver === "object" && !Array.isArray(originalData.driver)
      ? originalData.driver
      : {};
  const originalAssignedDriver =
    originalData.assignedDriver &&
    typeof originalData.assignedDriver === "object" &&
    !Array.isArray(originalData.assignedDriver)
      ? originalData.assignedDriver
      : {};
  const driverVehicleLabel =
    firstText(
      source.driverVehicleLabel,
      source.driverVehicleType,
      source.assignedDriverVehicleType,
      source.assigned_driver_vehicle_type,
      source.vehicleType,
      source.vehicle?.type,
      sourceDriver.vehicleType,
      sourceDriver.vehicle_type,
      sourceAssignedDriver.vehicleType,
      sourceAssignedDriver.vehicle_type,
      originalData.driverVehicleLabel,
      originalData.driverVehicleType,
      originalData.assignedDriverVehicleType,
      originalData.assigned_driver_vehicle_type,
      originalData.vehicleType,
      originalData.vehicle?.type,
      originalDriver.vehicleType,
      originalDriver.vehicle_type,
      originalAssignedDriver.vehicleType,
      originalAssignedDriver.vehicle_type
    ) || "Vehicle";
  const driverPlateLabel =
    firstText(
      source.driverPlateLabel,
      source.driverPlate,
      source.driver_plate,
      source.vehiclePlate,
      source.vehicle_plate,
      source.licensePlate,
      source.license_plate,
      source.vehicle?.plate,
      source.vehicle?.licensePlate,
      source.vehicle?.license_plate,
      sourceDriver.plate,
      sourceDriver.licensePlate,
      sourceDriver.license_plate,
      sourceAssignedDriver.plate,
      sourceAssignedDriver.licensePlate,
      sourceAssignedDriver.license_plate,
      originalData.driverPlateLabel,
      originalData.driverPlate,
      originalData.driver_plate,
      originalData.vehiclePlate,
      originalData.vehicle_plate,
      originalData.licensePlate,
      originalData.license_plate,
      originalData.vehicle?.plate,
      originalData.vehicle?.licensePlate,
      originalData.vehicle?.license_plate,
      originalDriver.plate,
      originalDriver.licensePlate,
      originalDriver.license_plate,
      originalAssignedDriver.plate,
      originalAssignedDriver.licensePlate,
      originalAssignedDriver.license_plate
    ) || "";

  const pickupPhotos = toArray(getPickupPhotoCandidates(source));
  const dropoffPhotos = toArray(getDropoffPhotoCandidates(source));
  const progressIndex = getProgressIndex(status);
  const progressStep = progressIndex >= 0 ? STATUS_STEPS[progressIndex] : null;

  return {
    id,
    idShort: id.slice(0, 8).toUpperCase(),
    status,
    statusLabel: meta.label,
    statusIcon: meta.icon,
    statusTextColor: meta.textColor,
    statusChipBackground: meta.chipBackground,
    amountLabel: formatAmount(source.amount ?? pricingTotal),
    createdLabel: formatDateTime(createdAt),
    pickupAddress,
    dropoffAddress,
    vehicleType: firstText(source.vehicleType, source.vehicle?.type) || "Vehicle",
    scheduleLabel: formatScheduleLabel(scheduledTime),
    itemsCount,
    itemDescription: primaryItem,
    driverName,
    driverAvatarUrl,
    driverRatingValue,
    driverRatingStars,
    driverRatingLabel,
    driverVehicleLabel,
    driverPlateLabel,
    driverId,
    pickupPhotos,
    dropoffPhotos,
    progressIndex,
    progressStep,
    cancelledAt: source.cancelledAt || source.cancelled_at || null,
    cancellationReason: source.cancellationReason || source.cancellation_reason || null,
    priceWithoutInsurance,
  };
};
