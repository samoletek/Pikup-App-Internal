import { normalizeError } from './errorService';
import { failureResult, successResult } from './contracts/result';
import { compressImage } from './StorageService';

const REMOTE_URL_REGEX = /^https?:\/\//i;

const isRemoteUrl = (value) => typeof value === 'string' && REMOTE_URL_REGEX.test(value.trim());

const sanitizeUserId = (userId) => String(userId || '').trim();

const buildOrderItemMediaPath = (userId, orderTimestamp, suffix) =>
  `${sanitizeUserId(userId)}/order_items/${orderTimestamp}/${suffix}.jpg`;

const uploadOrderItemMedia = async ({
  uri,
  suffix,
  userId,
  orderTimestamp,
  uploadToSupabase,
  bucket = 'trip_photos',
}) => {
  const normalizedUri = String(uri || '').trim();
  if (!normalizedUri) {
    return successResult({ url: null });
  }
  if (isRemoteUrl(normalizedUri)) {
    return successResult({ url: normalizedUri });
  }

  if (!sanitizeUserId(userId)) {
    return failureResult('Session expired. Please sign in again.', 'session_expired');
  }

  try {
    const filename = buildOrderItemMediaPath(userId, orderTimestamp, suffix);
    const optimizedUri = await compressImage(normalizedUri);
    const uploadedUrl = await uploadToSupabase(optimizedUri, bucket, filename);
    if (!isRemoteUrl(uploadedUrl)) {
      return failureResult(
        'Could not upload item media. Please try again.',
        'invalid_uploaded_media_url'
      );
    }

    return successResult({ url: uploadedUrl });
  } catch (error) {
    const normalized = normalizeError(error, 'Could not upload item media. Please try again.');
    return failureResult(
      normalized.message,
      normalized.code || 'order_item_media_upload_failed'
    );
  }
};

export const uploadOrderItemsMedia = async ({
  items = [],
  userId,
  uploadToSupabase,
  orderTimestamp = Date.now(),
}) => {
  try {
    if (!sanitizeUserId(userId)) {
      return failureResult('Session expired. Please sign in again.', 'session_expired', {
        items: [],
        orderTimestamp,
      });
    }

    const sourceItems = Array.isArray(items) ? items : [];
    const uploadedItems = [];

    for (let i = 0; i < sourceItems.length; i += 1) {
      const item = sourceItems[i] || {};
      const uploadedPhotos = [];
      const sourcePhotos = Array.isArray(item.photos) ? item.photos : [];

      for (let j = 0; j < sourcePhotos.length; j += 1) {
        const uploadedPhotoResult = await uploadOrderItemMedia({
          uri: sourcePhotos[j],
          suffix: `item_${i}_photo_${j}`,
          userId,
          orderTimestamp,
          uploadToSupabase,
        });

        if (!uploadedPhotoResult.success) {
          return failureResult(
            uploadedPhotoResult.error || 'Could not upload item media.',
            uploadedPhotoResult.errorCode || 'order_item_media_upload_failed',
            {
              items: [],
              orderTimestamp,
            }
          );
        }

        if (uploadedPhotoResult.url) {
          uploadedPhotos.push(uploadedPhotoResult.url);
        }
      }

      const uploadedInvoiceResult = await uploadOrderItemMedia({
        uri: item.invoicePhoto,
        suffix: `item_${i}_invoice`,
        userId,
        orderTimestamp,
        uploadToSupabase,
      });
      if (!uploadedInvoiceResult.success) {
        return failureResult(
          uploadedInvoiceResult.error || 'Could not upload item media.',
          uploadedInvoiceResult.errorCode || 'order_item_media_upload_failed',
          {
            items: [],
            orderTimestamp,
          }
        );
      }

      uploadedItems.push({
        ...item,
        photos: uploadedPhotos,
        invoicePhoto: uploadedInvoiceResult.url,
      });
    }

    return successResult({
      items: uploadedItems,
      orderTimestamp,
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to upload order item media');
    return failureResult(
      normalized.message,
      normalized.code || 'order_item_media_upload_failed',
      {
        items: [],
        orderTimestamp,
      }
    );
  }
};
