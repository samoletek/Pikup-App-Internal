import { normalizeTripStatus } from "../../constants/tripStatus";
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

export const toDisplayTrip = (trip, fallback) => {
  const source = trip || fallback || {};
  const pricingTotal = source.pricing?.total ?? source.price;

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
  const meta = statusMeta(status);
  const id = String(source.id || fallback?.id || "Unknown");

  const driverNameRaw = firstText(
    source.driver,
    source.assignedDriverEmail,
    source.driverEmail,
    source.driver_email
  );
  const driverName = driverNameRaw
    ? (driverNameRaw.includes("@") ? driverNameRaw.split("@")[0] : driverNameRaw)
    : "Not assigned";
  const driverId =
    source.assignedDriverId ||
    source.driverId ||
    source.driver_id ||
    source.assigned_driver_id ||
    null;

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
    scheduleLabel: formatScheduleLabel(source.scheduledTime || source.scheduled_time),
    itemsCount,
    itemDescription: primaryItem,
    driverName,
    driverId,
    pickupPhotos,
    dropoffPhotos,
    progressIndex,
    progressStep,
    cancelledAt: source.cancelledAt || source.cancelled_at || null,
    cancellationReason: source.cancellationReason || source.cancellation_reason || null,
  };
};
