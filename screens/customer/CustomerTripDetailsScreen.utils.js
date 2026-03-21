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
import {
  firstNonEmptyString,
  resolveAvatarUrlFromUser,
  resolveDisplayNameFromUser,
  resolveDriverAvatarFromRequest,
  resolveDriverNameFromRequest,
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

const DREW_MOCK_EMAIL = 'drew@architeq.io';
const DREW_MOCK_DRIVER_NAME = 'Ethan Walker';
const DREW_MOCK_VEHICLE_LABEL = 'Toyota Camry';
const DREW_MOCK_PLATE = 'CA 7PKU482';

const asObject = (value) => (value && typeof value === 'object' ? value : {});

const getDriverVehicleMeta = (driverProfile) => {
  const profile = asObject(driverProfile);
  const metadata = asObject(profile.metadata);
  const vehicleData = asObject(metadata.vehicleData);
  const vehicleInfo = asObject(metadata.vehicleInfo);
  const vinData = asObject(metadata.vinData);

  return {
    profile,
    metadata,
    vehicleData,
    vehicleInfo,
    vinData,
  };
};

const resolveDriverVehicleDetails = (source, driverProfile) => {
  const sourceVehicle = asObject(source.vehicle);
  const {
    profile,
    metadata,
    vehicleData,
    vehicleInfo,
    vinData,
  } = getDriverVehicleMeta(driverProfile);

  const make = firstText(
    source.vehicleMake,
    source.vehicle_make,
    sourceVehicle.make,
    sourceVehicle.brand,
    sourceVehicle.manufacturer,
    profile.vehicleMake,
    profile.vehicle_make,
    profile.make,
    vehicleData.make,
    vehicleInfo.make,
    vinData.make
  );

  const model = firstText(
    source.vehicleModel,
    source.vehicle_model,
    sourceVehicle.model,
    sourceVehicle.trim,
    profile.vehicleModel,
    profile.vehicle_model,
    profile.model,
    vehicleData.model,
    vehicleInfo.model,
    vinData.model
  );

  const vehicleLabel = [make, model].filter(Boolean).join(' ').trim()
    || firstText(source.vehicleType, source.vehicle_type, sourceVehicle.type)
    || 'Vehicle not specified';

  const vehiclePlate = firstText(
    source.vehiclePlate,
    source.vehicle_plate,
    sourceVehicle.licensePlate,
    sourceVehicle.license_plate,
    sourceVehicle.plate,
    sourceVehicle.registrationNumber,
    profile.licensePlate,
    profile.license_plate,
    vehicleData.licensePlate,
    vehicleData.license_plate,
    vehicleInfo.licensePlate,
    vehicleInfo.license_plate,
    metadata.licensePlate,
    metadata.license_plate
  ) || 'Plate N/A';

  return {
    vehicleLabel,
    vehiclePlate,
  };
};

export const toDisplayTrip = (trip, fallback, options = {}) => {
  const source = trip || fallback || {};
  const currentUser = options?.currentUser || null;
  const driverProfile = options?.driverProfile || null;
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

  const driverNameFromRequest = resolveDriverNameFromRequest(source, "Not assigned");
  const resolvedDriverName = driverProfile
    ? resolveDisplayNameFromUser(driverProfile, driverNameFromRequest)
    : driverNameFromRequest;
  const { vehicleLabel, vehiclePlate } = resolveDriverVehicleDetails(source, driverProfile);
  const currentUserEmail = firstNonEmptyString(
    currentUser?.email,
    currentUser?.user?.email,
    currentUser?.profile?.email
  );
  const isDrewAccount =
    currentUserEmail.toLowerCase() === DREW_MOCK_EMAIL;
  const shouldUseMockDriverName =
    !resolvedDriverName || resolvedDriverName === 'Not assigned';
  const shouldUseMockVehicleLabel =
    !vehicleLabel || vehicleLabel === 'Vehicle not specified';
  const shouldUseMockPlate =
    !vehiclePlate || vehiclePlate === 'Plate N/A';

  const driverName = isDrewAccount && shouldUseMockDriverName
    ? DREW_MOCK_DRIVER_NAME
    : resolvedDriverName;
  const driverVehicleLabel = isDrewAccount && shouldUseMockVehicleLabel
    ? DREW_MOCK_VEHICLE_LABEL
    : vehicleLabel;
  const driverPlateLabel = isDrewAccount && shouldUseMockPlate
    ? DREW_MOCK_PLATE
    : vehiclePlate;
  const driverId = firstNonEmptyString(
    source.assignedDriverId,
    source.assigned_driver_id,
    source.driverId,
    source.driver_id,
    source.assignedDriver?.id,
    source.assignedDriver?.uid,
    source.driver?.id,
    source.driver?.uid
  ) || null;
  const driverAvatarUrl = firstNonEmptyString(
    resolveAvatarUrlFromUser(driverProfile),
    resolveDriverAvatarFromRequest(source),
    resolveDriverAvatarFromRequest(fallback)
  );

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
    driverVehicleLabel,
    driverPlateLabel,
    driverAvatarUrl,
    driverId,
    pickupPhotos,
    dropoffPhotos,
    progressIndex,
    progressStep,
    cancelledAt: source.cancelledAt || source.cancelled_at || null,
    cancellationReason: source.cancellationReason || source.cancellation_reason || null,
  };
};
