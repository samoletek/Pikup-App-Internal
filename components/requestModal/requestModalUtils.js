import { Dimensions } from 'react-native';
import { getTripScheduledAtMs } from '../../constants/tripStatus';

const { width, height } = Dimensions.get('window');

export const SCREEN_HEIGHT = height;
export const CARD_WIDTH = width * 0.9;
export const MODAL_DISMISS_DRAG_THRESHOLD = 80;

export const isScheduledRequest = (request = {}) =>
  Number.isFinite(getTripScheduledAtMs(request)) ||
  request?.dispatchRequirements?.scheduleType === 'scheduled' ||
  request?.dispatch_requirements?.scheduleType === 'scheduled' ||
  request?.originalData?.dispatchRequirements?.scheduleType === 'scheduled' ||
  request?.originalData?.dispatch_requirements?.scheduleType === 'scheduled';

export const shouldRenderRequestTimer = (request = {}) =>
  !isScheduledRequest(request) && Boolean(request?.expiresAt);

export const getDisplayPhotos = (requestItem) => {
  if (Array.isArray(requestItem?.photos)) {
    return requestItem.photos;
  }
  if (Array.isArray(requestItem?.item?.photos)) {
    return requestItem.item.photos;
  }
  return [];
};

export const getScheduledLabel = (scheduledTime) => {
  if (!scheduledTime) {
    return null;
  }
  return new Date(scheduledTime).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const buildFallbackRouteFeature = (pickupPoint, dropoffPoint) => ({
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates: [pickupPoint, dropoffPoint],
  },
});
