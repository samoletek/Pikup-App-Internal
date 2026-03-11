import { TRIP_STATUS, normalizeTripStatus } from './tripStatus';

export const CUSTOMER_TRIP_PROGRESS_STEPS = Object.freeze([
  {
    key: TRIP_STATUS.ACCEPTED,
    label: 'Delivery Confirmed',
    icon: 'checkmark-circle',
    description: 'Your driver accepted the trip request.',
  },
  {
    key: TRIP_STATUS.IN_PROGRESS,
    label: 'On the way to you',
    icon: 'car-sport',
    description: 'Driver is heading to your pickup location.',
  },
  {
    key: TRIP_STATUS.ARRIVED_AT_PICKUP,
    label: 'Driver arrived',
    icon: 'location',
    description: 'Driver is waiting at the pickup point.',
  },
  {
    key: TRIP_STATUS.PICKED_UP,
    label: 'Package collected',
    icon: 'cube',
    description: 'Your items are loaded and secured.',
  },
  {
    key: TRIP_STATUS.EN_ROUTE_TO_DROPOFF,
    label: 'On the way to destination',
    icon: 'navigate',
    description: 'Package is in transit to drop-off.',
  },
  {
    key: TRIP_STATUS.ARRIVED_AT_DROPOFF,
    label: 'Arrived at destination',
    icon: 'home',
    description: 'Driver reached the delivery destination.',
  },
  {
    key: TRIP_STATUS.COMPLETED,
    label: 'Delivered',
    icon: 'checkmark-circle',
    description: 'Delivery was completed successfully.',
  },
]);

const STEP_INDEX_BY_STATUS = Object.freeze(
  CUSTOMER_TRIP_PROGRESS_STEPS.reduce((acc, step, index) => {
    acc[step.key] = index;
    return acc;
  }, {})
);

export const getCustomerTripProgressIndex = (status) => {
  const normalizedStatus = normalizeTripStatus(status);
  const index = STEP_INDEX_BY_STATUS[normalizedStatus];
  return Number.isInteger(index) ? index : -1;
};

export const getCustomerTripProgressStep = (status) => {
  const index = getCustomerTripProgressIndex(status);
  if (index < 0) {
    return null;
  }

  return CUSTOMER_TRIP_PROGRESS_STEPS[index];
};
