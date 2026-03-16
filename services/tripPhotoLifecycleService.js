import { compressImage, uploadToSupabase } from './StorageService';
import { getMissingColumnFromError } from './tripErrorUtils';
import { ensureAuthenticatedUserId } from './tripAuthUtils';
import { logger } from './logger';
import { fetchTripColumnsById, updateTripById } from './repositories/tripRepository';

const PHOTO_BUCKET = 'trip_photos';

const resolvePhotoColumn = (photoType) => {
  if (photoType === 'dropoff' || photoType === 'delivery') {
    return 'dropoff_photos';
  }
  return 'pickup_photos';
};

const uploadPhotoBatch = async ({
  authUserId,
  requestId,
  photos,
  photoType,
}) => {
  const uploadedUrls = [];

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    const uri = photo?.uri || photo;
    const compressedUri = await compressImage(uri);
    const filename = `${authUserId}/${requestId}/${photoType}_${Date.now()}_${index}.jpg`;
    const url = await uploadToSupabase(compressedUri, PHOTO_BUCKET, filename);
    uploadedUrls.push(url);
  }

  return uploadedUrls;
};

export const uploadRequestPhotosForTrip = async ({
  requestId,
  photos,
  photoType = 'pickup',
}) => {
  if (!Array.isArray(photos) || photos.length === 0) {
    return null;
  }

  const authUserId = await ensureAuthenticatedUserId();
  if (!authUserId) {
    throw new Error('Session expired. Please sign in again.');
  }

  logger.info('TripPhotoLifecycle', 'Uploading trip photos', {
    requestId,
    photoType,
    count: photos.length,
  });

  const uploadedUrls = await uploadPhotoBatch({
    authUserId,
    requestId,
    photos,
    photoType,
  });

  const column = resolvePhotoColumn(photoType);
  let existing = [];
  let canPersistToTrip = true;

  const { data: trip, error: selectError } = await fetchTripColumnsById(requestId, column);

  if (selectError) {
    const missingColumn = getMissingColumnFromError(selectError);
    if (missingColumn === column) {
      canPersistToTrip = false;
      logger.warn('TripPhotoLifecycle', `Trips table is missing "${column}". Skipping photo URL persistence.`);
    } else {
      throw selectError;
    }
  } else {
    existing = trip?.[column] || [];
  }

  if (canPersistToTrip) {
    const newPhotos = [...existing, ...uploadedUrls];
    const { error: updateError } = await updateTripById(requestId, {
      [column]: newPhotos,
      updated_at: new Date().toISOString(),
    });

    if (updateError) {
      const missingColumn = getMissingColumnFromError(updateError);
      if (missingColumn === column) {
        canPersistToTrip = false;
        logger.warn(
          'TripPhotoLifecycle',
          `Trips table is missing "${column}" during update. Uploaded files were kept in storage.`
        );
      } else {
        throw updateError;
      }
    }
  }

  return {
    uploadedPhotos: uploadedUrls,
    persistedToTrip: canPersistToTrip,
  };
};
