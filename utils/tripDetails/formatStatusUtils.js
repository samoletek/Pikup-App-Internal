import { TRIP_STATUS, normalizeTripStatus } from "../../constants/tripStatus";
import { colors } from "../../styles/theme";
import { toArray } from "./photoUtils";

export const STATUS_STEPS = Object.freeze([
  {
    key: TRIP_STATUS.ACCEPTED,
    label: "Delivery Confirmed",
    icon: "checkmark-circle",
    description: "Your driver accepted the trip request.",
  },
  {
    key: TRIP_STATUS.IN_PROGRESS,
    label: "On the way to you",
    icon: "car-sport",
    description: "Driver is heading to your pickup location.",
  },
  {
    key: TRIP_STATUS.ARRIVED_AT_PICKUP,
    label: "Driver arrived",
    icon: "location",
    description: "Driver is waiting at the pickup point.",
  },
  {
    key: TRIP_STATUS.PICKED_UP,
    label: "Package collected",
    icon: "cube",
    description: "Your items are loaded and secured.",
  },
  {
    key: TRIP_STATUS.EN_ROUTE_TO_DROPOFF,
    label: "On the way to destination",
    icon: "navigate",
    description: "Package is in transit to drop-off.",
  },
  {
    key: TRIP_STATUS.ARRIVED_AT_DROPOFF,
    label: "Arrived at destination",
    icon: "home",
    description: "Driver reached the delivery destination.",
  },
  {
    key: TRIP_STATUS.COMPLETED,
    label: "Delivered",
    icon: "checkmark-circle",
    description: "Delivery was completed successfully.",
  },
]);

const STEP_INDEX_BY_STATUS = Object.freeze(
  STATUS_STEPS.reduce((acc, step, index) => {
    acc[step.key] = index;
    return acc;
  }, {})
);

export const firstText = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

export const formatAmount = (value) => {
  if (typeof value === "string" && value.includes("$")) {
    return value;
  }

  const numeric = Number(value) || 0;
  return `$${numeric.toFixed(2)}`;
};

export const formatDateTime = (value) => {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const formatScheduleLabel = (value) => {
  if (!value) {
    return "ASAP";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Scheduled";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const formatReason = (value) => {
  const raw = firstText(value);
  if (!raw) {
    return "Not provided";
  }
  if (raw === "customer_request") {
    return "Cancelled by customer";
  }

  return raw
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
};

export const getRatingLabel = (rating) => {
  if (rating >= 5) return "Excellent";
  if (rating >= 4) return "Great";
  if (rating >= 3) return "Good";
  if (rating >= 2) return "Fair";
  return "Needs improvement";
};

export const normalizeRating = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(5, Math.max(0, Math.round(parsed)));
};

export const normalizeBadgeIds = (value) => {
  const parsed = toArray(value)
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return Array.from(new Set(parsed));
};

export const getProgressIndex = (status) => {
  const normalizedStatus = normalizeTripStatus(status);
  const index = STEP_INDEX_BY_STATUS[normalizedStatus];
  return Number.isInteger(index) ? index : -1;
};

export const getProgressStep = (status) => {
  const step = STATUS_STEPS.find((item) => item.key === normalizeTripStatus(status));
  return step || null;
};

export const statusMeta = (status) => {
  const normalized = normalizeTripStatus(status);
  const activeStep = getProgressStep(normalized);

  if (normalized === TRIP_STATUS.CANCELLED) {
    return {
      label: "Cancelled",
      icon: "close-circle",
      textColor: colors.error,
      chipBackground: colors.errorLight,
    };
  }

  if (activeStep) {
    return {
      label: activeStep.label,
      icon: activeStep.icon,
      textColor: normalized === TRIP_STATUS.COMPLETED ? colors.success : colors.primary,
      chipBackground: normalized === TRIP_STATUS.COMPLETED ? colors.successLight : colors.primaryLight,
    };
  }

  return {
    label: "Archived",
    icon: "time-outline",
    textColor: colors.text.tertiary,
    chipBackground: colors.background.elevated,
  };
};
