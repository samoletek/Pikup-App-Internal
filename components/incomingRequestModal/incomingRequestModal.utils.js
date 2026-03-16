import { Dimensions } from 'react-native';
import { colors } from '../../styles/theme';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export { SCREEN_HEIGHT, SCREEN_WIDTH };

export const FULL_HEIGHT = SCREEN_HEIGHT * 0.92;
export const HALF_HEIGHT = SCREEN_HEIGHT * 0.55;

export const SNAP_FULL = 0;
export const SNAP_HALF = FULL_HEIGHT - HALF_HEIGHT;
export const SNAP_HIDDEN = FULL_HEIGHT + 50;
export const SNAP_POINTS = [SNAP_FULL, SNAP_HALF];

export const formatOfferTimer = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(safeSeconds / 60)}:${(safeSeconds % 60).toString().padStart(2, '0')}`;
};

export const resolvePhotoUri = (photo) => {
  if (typeof photo === 'string') return photo;
  if (photo?.url) return photo.url;
  if (photo?.uri) return photo.uri;
  return null;
};

export const resolvePhotoSource = (photo) => {
  const uri = resolvePhotoUri(photo);
  if (!uri) return null;
  return { uri };
};

export const resolveIncomingRequestData = (request, timeRemaining = 0, timerTotal = 180) => {
  const allItems = Array.isArray(request?.items) && request.items.length > 0
    ? request.items
    : request?.item ? [request.item] : [];

  const allPhotos = allItems.flatMap((item) =>
    Array.isArray(item?.photos) ? item.photos : []
  );

  const displayPhotos = allPhotos.length > 0
    ? allPhotos
    : Array.isArray(request?.photos) ? request.photos : [];

  const pickupDetails = request?.pickup?.details || {};
  const dropoffDetails = request?.dropoff?.details || {};
  const pricing = request?.pricing || {};
  const earnings = request?.driverPayout || request?.earnings || request?.price || '$0.00';
  const vehicleType = request?.vehicle?.type || 'Standard';
  const scheduledTime = request?.scheduledTime;

  const needsHelp = pickupDetails.driverHelpsLoading || dropoffDetails.driverHelpsUnloading;
  const helpText = pickupDetails.driverHelpsLoading && dropoffDetails.driverHelpsUnloading
    ? 'Loading & Unloading'
    : pickupDetails.driverHelpsLoading ? 'Loading' : 'Unloading';

  const timerColor = timeRemaining <= 30 ? colors.error : colors.primary;
  const timerPercent = timerTotal > 0 ? (Math.max(0, timeRemaining) / timerTotal) * 100 : 0;

  return {
    allItems,
    allPhotos,
    displayPhotos,
    pickupDetails,
    dropoffDetails,
    pricing,
    earnings,
    vehicleType,
    scheduledTime,
    needsHelp,
    helpText,
    timerColor,
    timerPercent,
  };
};

export const getItemPhotoOffset = (items, index) =>
  items.slice(0, index).reduce(
    (sum, prev) => sum + (Array.isArray(prev?.photos) ? prev.photos.length : 0),
    0
  );
