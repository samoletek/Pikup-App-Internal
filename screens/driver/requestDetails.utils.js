import { createSignedTripPhotoUrl, getPhotoURL } from '../../services/StorageService';
import { logger } from '../../services/logger';

const PHOTO_URL_TTL_SECONDS = 60 * 60 * 6;

export const formatAmount = (value) => {
  if (typeof value === 'string' && value.includes('$')) {
    return value;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return '$0.00';
  }

  return `$${amount.toFixed(2)}`;
};

export const formatDateTime = (value) => {
  if (!value) {
    return 'ASAP';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'ASAP';
  }

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
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

    return [trimmed];
  }

  if (value && typeof value === 'object') {
    return [value];
  }

  return [];
};

export const firstText = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

export const formatWeight = (item = {}) => {
  const raw = Number(
    item.weightEstimate ?? item.weight ?? item.estimated_weight_lbs ?? item.weight_lbs
  );

  if (!Number.isFinite(raw) || raw <= 0) {
    return null;
  }

  return `${raw} lb`;
};

export const getItemRows = (request = {}) => {
  const list = toArray(request.items);
  if (list.length > 0) {
    return list;
  }

  if (request.item && typeof request.item === 'object') {
    return [request.item];
  }

  return [];
};

export const getPhotoRows = (request = {}) => {
  const directPhotos = toArray(request.photos);
  if (directPhotos.length > 0) {
    return directPhotos;
  }

  return getItemRows(request).flatMap((item) => toArray(item?.photos));
};

const resolvePhotoUri = (photo) => {
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

    if (/^(https?:\/\/|file:\/\/|content:\/\/|ph:\/\/|asset:\/\/|data:image\/)/i.test(raw)) {
      return raw;
    }

    const normalizedPath = raw.replace(/^\/+/, '').replace(/^trip_photos\//, '');
    return getPhotoURL(normalizedPath);
  }

  if (Array.isArray(photo)) {
    return resolvePhotoUri(photo[0]);
  }

  if (typeof photo === 'object') {
    const candidates = [
      photo.uri,
      photo.url,
      photo.photo_url,
      photo.publicUrl,
      photo.public_url,
      photo.imageUrl,
      photo.image_url,
      photo.secure_url,
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

const resolvePhotoUris = (photos = []) => toArray(photos).map(resolvePhotoUri).filter(Boolean);

const extractTripPhotoPath = (uri) => {
  if (typeof uri !== 'string') {
    return null;
  }

  const raw = uri.trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith('trip_photos/')) {
    return raw.replace(/^trip_photos\//, '');
  }

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    const match = raw.match(/\/storage\/v1\/object\/(?:public|sign)\/trip_photos\/([^?]+)/i);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
    return null;
  }

  if (raw.includes('/') && !raw.startsWith('file://') && !raw.startsWith('content://')) {
    return raw.replace(/^\/+/, '');
  }

  return null;
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
    logger.warn('DriverRequestDetailsUtils', 'Unable to sign trip photo URL, falling back to original URI', error);
  }

  return uri;
};

export const resolvePhotoUrisAsync = async (photos = []) => {
  const candidates = resolvePhotoUris(photos);
  if (candidates.length === 0) {
    return [];
  }

  const signedUris = await Promise.all(candidates.map((uri) => toSignedTripPhotoUri(uri)));
  return signedUris.filter(Boolean);
};

export const buildRequestDetails = (request) => {
  if (!request) {
    return null;
  }

  const pricing = request.pricing || request.originalData?.pricing || {};
  const payoutLabel = formatAmount(
    request.driverPayout ?? request.earnings ?? pricing.driverPayout ?? request.price
  );
  const totalLabel = formatAmount(pricing.total ?? request.price);
  const scheduleLabel = formatDateTime(request.scheduledTime || request.scheduled_time);
  const itemRows = getItemRows(request);
  const photoRows = getPhotoRows(request);
  const pickupDetails = request.pickup?.details || {};
  const dropoffDetails = request.dropoff?.details || {};

  return {
    id: String(request.id || 'unknown'),
    payoutLabel,
    totalLabel,
    scheduleLabel,
    vehicleType: firstText(request.vehicle?.type, request.vehicleType) || 'Standard',
    pickupAddress: firstText(request.pickup?.address) || 'Not specified',
    dropoffAddress: firstText(request.dropoff?.address) || 'Not specified',
    pickupNotes: firstText(pickupDetails.notes, pickupDetails.note),
    dropoffNotes: firstText(dropoffDetails.notes, dropoffDetails.note),
    itemRows,
    photoRows,
    timeDistance: [request.time, request.distance].filter(Boolean).join(' · '),
  };
};
