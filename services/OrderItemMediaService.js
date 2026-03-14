import { normalizeError } from './errorService';

const REMOTE_URL_REGEX = /^https?:\/\//i;

const isRemoteUrl = (value) => typeof value === 'string' && REMOTE_URL_REGEX.test(value.trim());

const sanitizeUserId = (userId) => String(userId || '').trim();

const buildOrderItemMediaPath = (userId, orderTimestamp, suffix) =>
  `${sanitizeUserId(userId)}/order_items/${orderTimestamp}/${suffix}.jpg`;

export const uploadOrderItemMedia = async ({
  uri,
  suffix,
  userId,
  orderTimestamp,
  uploadToSupabase,
  bucket = 'trip_photos',
}) => {
  const normalizedUri = String(uri || '').trim();
  if (!normalizedUri) return null;
  if (isRemoteUrl(normalizedUri)) return normalizedUri;

  if (!sanitizeUserId(userId)) {
    throw new Error('Session expired. Please sign in again.');
  }

  const filename = buildOrderItemMediaPath(userId, orderTimestamp, suffix);
  const uploadedUrl = await uploadToSupabase(normalizedUri, bucket, filename);
  if (!isRemoteUrl(uploadedUrl)) {
    throw new Error('Could not upload item media. Please try again.');
  }

  return uploadedUrl;
};

export const uploadOrderItemsMedia = async ({
  items = [],
  userId,
  uploadToSupabase,
  orderTimestamp = Date.now(),
}) => {
  try {
    if (!sanitizeUserId(userId)) {
      throw new Error('Session expired. Please sign in again.');
    }

    const sourceItems = Array.isArray(items) ? items : [];
    const uploadedItems = [];

    for (let i = 0; i < sourceItems.length; i += 1) {
      const item = sourceItems[i] || {};
      const uploadedPhotos = [];
      const sourcePhotos = Array.isArray(item.photos) ? item.photos : [];

      for (let j = 0; j < sourcePhotos.length; j += 1) {
        const uploadedPhotoUrl = await uploadOrderItemMedia({
          uri: sourcePhotos[j],
          suffix: `item_${i}_photo_${j}`,
          userId,
          orderTimestamp,
          uploadToSupabase,
        });

        if (uploadedPhotoUrl) {
          uploadedPhotos.push(uploadedPhotoUrl);
        }
      }

      const uploadedInvoicePhoto = await uploadOrderItemMedia({
        uri: item.invoicePhoto,
        suffix: `item_${i}_invoice`,
        userId,
        orderTimestamp,
        uploadToSupabase,
      });

      uploadedItems.push({
        ...item,
        photos: uploadedPhotos,
        invoicePhoto: uploadedInvoicePhoto,
      });
    }

    return {
      success: true,
      items: uploadedItems,
      orderTimestamp,
    };
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to upload order item media');
    return {
      success: false,
      error: normalized.message,
      items: [],
      orderTimestamp,
    };
  }
};
