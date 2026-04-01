import { Dimensions } from 'react-native';
import { colors } from '../../styles/theme';
import { createSignedTripPhotoUrl, getPhotoURL } from '../../services/StorageService';
import { logger } from '../../services/logger';
import { resolveDriverPayoutAmount } from '../../services/PricingService';

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

const PHOTO_URL_TTL_SECONDS = 60 * 60 * 6;
const REMOTE_URI_REGEX = /^https?:\/\//i;
const LOCAL_URI_REGEX = /^(file:\/\/|content:\/\/|ph:\/\/|asset:\/\/|data:image\/)/i;

const decodePathSegment = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return value;
  }
};

const extractTripPhotoPath = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const raw = value.trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith('trip_photos/')) {
    return decodePathSegment(raw.replace(/^trip_photos\//, ''));
  }

  if (raw.startsWith('/trip_photos/')) {
    return decodePathSegment(raw.replace(/^\/trip_photos\//, ''));
  }

  const storageMatch = raw.match(
    /\/storage\/v1\/object\/(?:public|sign)\/trip_photos\/([^?]+)/i
  );
  if (storageMatch?.[1]) {
    return decodePathSegment(storageMatch[1]);
  }

  const rawWithoutQuery = raw.split('?')[0] || raw;
  const normalizedRaw = rawWithoutQuery.replace(/^\/+/, '');
  if (normalizedRaw.startsWith('trip_photos/')) {
    return decodePathSegment(normalizedRaw.replace(/^trip_photos\//, ''));
  }

  if (raw.includes('/trip_photos/')) {
    const [, suffix = ''] = raw.split('/trip_photos/');
    if (suffix) {
      return decodePathSegment(suffix.split('?')[0] || suffix);
    }
  }

  return null;
};

export const resolvePhotoUri = (photo) => {
  if (!photo) {
    return null;
  }

  if (typeof photo === 'string') {
    const raw = photo.trim();
    if (!raw) {
      return null;
    }

    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        return resolvePhotoUri(JSON.parse(raw));
      } catch (_error) {
        return null;
      }
    }

    if (LOCAL_URI_REGEX.test(raw)) {
      return raw;
    }

    if (REMOTE_URI_REGEX.test(raw)) {
      return raw;
    }

    const extractedPath = extractTripPhotoPath(raw);
    if (extractedPath) {
      return getPhotoURL(extractedPath);
    }

    const normalizedPath = raw.replace(/^\/+/, '').replace(/^trip_photos\//, '');
    return normalizedPath ? getPhotoURL(normalizedPath) : null;
  }

  if (Array.isArray(photo)) {
    return resolvePhotoUri(photo[0]);
  }

  if (typeof photo === 'object') {
    const candidates = [
      photo.uri,
      photo.signedUrl,
      photo.signed_url,
      photo.secure_url,
      photo.photo,
      photo.url,
      photo.photo_url,
      photo.publicUrl,
      photo.public_url,
      photo.imageUrl,
      photo.image_url,
      photo.image,
      photo.imageUri,
      photo.image_uri,
      photo.photoUri,
      photo.photo_uri,
      photo.thumbnailUrl,
      photo.thumbnail_url,
      photo.previewUrl,
      photo.preview_url,
      photo.path,
      photo.storagePath,
      photo.storage_path,
      photo.filePath,
      photo.file_path,
      photo.source?.uri,
      photo.asset?.uri,
    ];

    for (const candidate of candidates) {
      const resolved = resolvePhotoUri(candidate);
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
};

export const resolvePhotoSource = (photo) => {
  const uri = resolvePhotoUri(photo);
  if (!uri) return null;
  return { uri };
};

const parseArrayLike = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed && typeof parsed === 'object') {
        return [parsed];
      }
    } catch (_error) {
      return [trimmed];
    }
  }

  if (value && typeof value === 'object') {
    const numericKeys = Object.keys(value).filter((key) => /^\d+$/.test(key));
    if (numericKeys.length > 0) {
      return numericKeys
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => value[key]);
    }

    return [value];
  }

  return [];
};

const getFirstNonEmptyArray = (...values) => {
  for (const value of values) {
    const parsed = parseArrayLike(value);
    if (parsed.length > 0) {
      return parsed;
    }
  }

  return [];
};

export const resolveItemPhotos = (item) => {
  return getFirstNonEmptyArray(
    item?.photos,
    item?.photo,
    item?.photoUrl,
    item?.photo_url,
    item?.photoUri,
    item?.photo_uri,
    item?.photoUrls,
    item?.photo_urls,
    item?.image,
    item?.imageUrl,
    item?.image_url,
    item?.imageUri,
    item?.image_uri,
    item?.itemPhotos,
    item?.item_photos,
    item?.images,
    item?.media,
    item?.mediaUrls,
    item?.media_urls,
    item?.gallery,
    item?.files,
    item?.attachments
  ).filter((photo) => Boolean(resolvePhotoUri(photo)));
};

const toSignedTripPhotoUri = async (uri) => {
  const path = extractTripPhotoPath(uri);
  if (!path) {
    return uri;
  }

  try {
    const signedUrl = await createSignedTripPhotoUrl(path, PHOTO_URL_TTL_SECONDS);
    if (signedUrl) {
      return signedUrl;
    }
  } catch (error) {
    logger.warn(
      'IncomingRequestModalUtils',
      'Unable to sign trip photo URL, using original URI fallback',
      error
    );
  }

  return uri;
};

export const resolvePhotoUrisAsync = async (photos = []) => {
  const resolved = getFirstNonEmptyArray(photos).map(resolvePhotoUri).filter(Boolean);
  if (resolved.length === 0) {
    return [];
  }

  const signed = await Promise.all(resolved.map((uri) => toSignedTripPhotoUri(uri)));
  return signed.filter(Boolean);
};

const toItemObject = (rawItem) => {
  if (!rawItem) {
    return {};
  }

  if (typeof rawItem === 'string') {
    const trimmed = rawItem.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch (_error) {
        // Fall through to text description fallback.
      }
    }

    return {
      description: rawItem,
    };
  }

  if (typeof rawItem === 'object') {
    return rawItem;
  }

  return {};
};

const toMoneyLabel = (value) => {
  if (typeof value === 'string' && value.includes('$')) {
    return value;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return '$0.00';
  }

  return `$${amount.toFixed(2)}`;
};

export const resolveIncomingRequestData = (request, timeRemaining = 0, timerTotal = 180) => {
  const sourceItems = getFirstNonEmptyArray(request?.items);
  const rawItems = sourceItems.length > 0
    ? sourceItems
    : request?.item
      ? [request.item]
      : [];
  const mappedItems = rawItems.map((rawItem, index) => {
    const item = toItemObject(rawItem);
    return {
      ...item,
      id: item?.id || `item-${index}`,
      photos: resolveItemPhotos(item),
    };
  });
  const requestLevelPhotos = getFirstNonEmptyArray(
    request?.photos,
    request?.pickupPhotos,
    request?.pickup_photos,
    request?.itemPhotos,
    request?.item_photos
  );
  const allItems = mappedItems.map((item, index) => {
    if (item.photos.length > 0) {
      return item;
    }

    if (index === 0 && requestLevelPhotos.length > 0) {
      return {
        ...item,
        photos: requestLevelPhotos,
      };
    }

    return item;
  });
  const allPhotos = allItems.flatMap((item) => item.photos);
  const displayPhotos = allPhotos.length > 0
    ? allPhotos
    : requestLevelPhotos;

  const pickupDetails = request?.pickup?.details || {};
  const dropoffDetails = request?.dropoff?.details || {};
  const pricing = request?.pricing || {};
  const earnings = toMoneyLabel(resolveDriverPayoutAmount(request));
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
    (sum, prev) => sum + resolveItemPhotos(prev).length,
    0
  );
