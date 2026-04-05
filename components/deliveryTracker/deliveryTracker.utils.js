import { TRIP_STATUS, getTripScheduledAtMs } from '../../constants/tripStatus';

export const DELIVERY_STATUS_STEPS = [
  {
    key: TRIP_STATUS.ACCEPTED,
    label: 'Driver Confirmed',
    icon: 'checkmark-circle',
    description: 'Driver is preparing for your pickup',
  },
  {
    key: TRIP_STATUS.IN_PROGRESS,
    label: 'On the way to you',
    icon: 'car-sport',
    description: 'Driver is heading to your location',
  },
  {
    key: TRIP_STATUS.ARRIVED_AT_PICKUP,
    label: 'Driver arrived',
    icon: 'location',
    description: 'Driver has arrived at pickup location',
  },
  {
    key: TRIP_STATUS.PICKED_UP,
    label: 'Package collected',
    icon: 'cube',
    description: 'Your items are secured for transport',
  },
  {
    key: TRIP_STATUS.EN_ROUTE_TO_DROPOFF,
    label: 'On the way to destination',
    icon: 'navigate',
    description: 'Your package is in transit',
  },
  {
    key: TRIP_STATUS.ARRIVED_AT_DROPOFF,
    label: 'Arrived at destination',
    icon: 'home',
    description: 'Driver has arrived at delivery location',
  },
  {
    key: TRIP_STATUS.COMPLETED,
    label: 'Delivered',
    icon: 'checkmark-circle',
    description: 'Your delivery is complete',
  },
];

const ETA_BY_STATUS_INDEX = Object.freeze({
  0: '10-15 min',
  1: '5-10 min',
  2: 'Arrived',
  3: '15-20 min',
  4: '5-10 min',
  5: 'Arrived',
});

export const getCurrentStatusIndex = (requestData) => {
  if (!requestData?.status) return 0;

  const index = DELIVERY_STATUS_STEPS.findIndex((step) => step.key === requestData.status);
  return index >= 0 ? index : 0;
};

export const formatDeliveryEta = (statusIndex) => {
  if (statusIndex >= DELIVERY_STATUS_STEPS.length - 1) {
    return 'Delivered';
  }

  return ETA_BY_STATUS_INDEX[statusIndex] || '-- min';
};

export const isScheduledDeliveryRequest = (requestData) =>
  Number.isFinite(getTripScheduledAtMs(requestData)) ||
  requestData?.scheduleType === 'scheduled' ||
  requestData?.dispatchRequirements?.scheduleType === 'scheduled' ||
  requestData?.dispatch_requirements?.scheduleType === 'scheduled' ||
  requestData?.originalData?.dispatchRequirements?.scheduleType === 'scheduled' ||
  requestData?.originalData?.dispatch_requirements?.scheduleType === 'scheduled';
