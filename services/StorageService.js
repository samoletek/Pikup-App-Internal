// services/StorageService.js
// Extracted from AuthContext.js - Storage utilities for Supabase

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'react-native';
import { decode } from 'base64-arraybuffer';
import { logger } from './logger';
import {
    getAuthenticatedSession,
    refreshAuthenticatedSession,
} from './repositories/authRepository';
import {
    createStorageSignedUrl,
    getStoragePublicUrl,
    removeStoragePaths,
    uploadToStorageBucket,
} from './repositories/storageRepository';
import { normalizeError } from './errorService';

const MAX_UPLOAD_RETRIES = 3;
const IMAGE_MAX_SIDE_PX = 1024;
const MIME_TYPE_MAP = Object.freeze({
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    gif: 'image/gif',
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getImageSize = (uri) =>
    new Promise((resolve, reject) => {
        Image.getSize(
            uri,
            (width, height) => resolve({ width, height }),
            reject
        );
    });

const ensureStorageSessionUserId = async () => {
    const { data: sessionData } = await getAuthenticatedSession();
    if (sessionData?.session?.access_token && sessionData.session?.user?.id) {
        return sessionData.session.user.id;
    }

    const { data: refreshedData, error: refreshError } = await refreshAuthenticatedSession();
    if (!refreshError && refreshedData?.session?.access_token && refreshedData.session?.user?.id) {
        return refreshedData.session.user.id;
    }

    return null;
};

const shouldRetryUpload = (error) => {
    const message = String(error?.message || '').toLowerCase();
    const status = Number(error?.status || 0);

    return (
        message.includes('network request failed') ||
        message.includes('failed to fetch') ||
        message.includes('network error') ||
        message.includes('load failed') ||
        status >= 500
    );
};

const getPathOrUriExtension = (value) => {
    const trimmed = String(value || '').split('?')[0].trim();
    if (!trimmed) {
        return '';
    }

    const segments = trimmed.split('.');
    if (segments.length < 2) {
        return '';
    }

    return String(segments[segments.length - 1] || '').toLowerCase();
};

const resolveUploadContentType = (uri, path) => {
    const extension = getPathOrUriExtension(path) || getPathOrUriExtension(uri);
    return MIME_TYPE_MAP[extension] || 'application/octet-stream';
};

const resolveUploadErrorCode = (error, normalizedCode) => {
    if (normalizedCode) {
        return normalizedCode;
    }

    const statusCode = Number(error?.statusCode || error?.status || 0);
    if (Number.isFinite(statusCode) && statusCode > 0) {
        return `storage_http_${statusCode}`;
    }

    const errorName = String(error?.name || '').toLowerCase();
    if (errorName.includes('storageapierror')) {
        return 'storage_api_error';
    }

    return null;
};

const readLocalFileAsArrayBuffer = async (uri) => {
    try {
        const base64Data = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64
        });
        return decode(base64Data);
    } catch (_fileSystemError) {
        // Fallback for URI formats that cannot be read directly by FileSystem.
        const response = await fetch(uri);
        if (!response.ok) {
            throw new Error(`Failed to read local file for upload: ${response.status}`);
        }
        const blob = await response.blob();
        return new Response(blob).arrayBuffer();
    }
};

/**
 * Compress and optimize image for upload
 * @param {string} uri - Image URI to compress
 * @returns {Promise<string>} Compressed image URI
 */
export const compressImage = async (uri) => {
    try {
        let actions = [];

        try {
            const { width, height } = await getImageSize(uri);
            const longestSide = Math.max(Number(width || 0), Number(height || 0));

            if (longestSide > IMAGE_MAX_SIDE_PX) {
                actions =
                    width >= height
                        ? [{ resize: { width: IMAGE_MAX_SIDE_PX } }]
                        : [{ resize: { height: IMAGE_MAX_SIDE_PX } }];
            }
        } catch (sizeError) {
            logger.warn(
                'StorageService',
                'Could not determine image dimensions before compression, compressing without resize',
                sizeError
            );
        }

        const manipulatedImage = await ImageManipulator.manipulateAsync(
            uri,
            actions,
            {
                compress: 0.8,
                format: ImageManipulator.SaveFormat.JPEG
            }
        );
        return manipulatedImage.uri;
    } catch (error) {
        logger.warn('StorageService', 'Image compression failed, using original', error);
        return uri;
    }
};

/**
 * Upload file to Supabase Storage
 * @param {string} uri - File URI to upload
 * @param {string} bucket - Storage bucket name
 * @param {string} path - Path within bucket
 * @returns {Promise<string>} Public URL of uploaded file
 */
export const uploadToSupabase = async (uri, bucket, path) => {
    let contentType = 'application/octet-stream';
    try {
        const sessionUserId = await ensureStorageSessionUserId();
        if (!sessionUserId) {
            throw new Error('No authenticated session available for storage upload');
        }

        const arrayBuffer = await readLocalFileAsArrayBuffer(uri);
        contentType = resolveUploadContentType(uri, path);
        let lastError = null;

        for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
            const body = arrayBuffer.slice(0);
            const { error } = await uploadToStorageBucket(bucket, path, body, {
                    contentType,
                    upsert: true
                });

            if (!error) {
                const { data: { publicUrl } } = getStoragePublicUrl(bucket, path);

                return publicUrl;
            }

            lastError = error;
            if (attempt < MAX_UPLOAD_RETRIES && shouldRetryUpload(error)) {
                logger.warn(
                    'StorageService',
                    `Retrying Supabase upload (${attempt}/${MAX_UPLOAD_RETRIES}) for ${bucket}/${path}:`,
                    error?.message || error
                );
                await sleep(500 * attempt);
                continue;
            }

            throw error;
        }

        throw lastError || new Error('Upload failed');
    } catch (error) {
        const normalized = normalizeError(error, 'File upload failed');
        const resolvedCode = resolveUploadErrorCode(error, normalized.code);
        logger.error(
            'StorageService',
            'Supabase upload error',
            {
                ...normalized,
                code: resolvedCode,
                bucket,
                path,
                contentType,
            },
            error
        );
        const uploadError = new Error(normalized.message);
        if (resolvedCode) {
            uploadError.code = resolvedCode;
        }
        throw uploadError;
    }
};

/**
 * Upload multiple photos to Supabase Storage
 * @param {Array} photos - Array of photo objects or URIs
 * @param {string} path - Base path for uploads
 * @returns {Promise<Array>} Array of uploaded photo info
 */
export const uploadMultiplePhotos = async (photos, path) => {
    if (!photos || photos.length === 0) return [];

    const urls = [];
    const bucket = 'trip_photos';

    for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const uri = photo.uri || photo;
        const filename = `${path || 'uploads'}/${Date.now()}_${i}.jpg`;
        try {
            const url = await uploadToSupabase(uri, bucket, filename);
            urls.push({ url, storagePath: filename, id: filename });
        } catch (e) {
            logger.error('StorageService', 'Failed to upload photo', { filename, error: e });
        }
    }
    return urls;
};

/**
 * Get public URL for a stored photo
 * @param {string} path - Storage path
 * @returns {string|null} Public URL or null
 */
export const getPhotoURL = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const { data } = getStoragePublicUrl('trip_photos', path);
    return data.publicUrl;
};

export const createSignedTripPhotoUrl = async (path, expiresInSeconds) => {
    if (!path) {
        return null;
    }

    const { data, error } = await createStorageSignedUrl('trip_photos', path, expiresInSeconds);

    if (error || !data?.signedUrl) {
        return null;
    }

    return data.signedUrl;
};

/**
 * Delete photo from Supabase Storage
 * @param {string} path - Storage path to delete
 */
export const deletePhotoFromStorage = async (path) => {
    try {
        await removeStoragePaths('trip_photos', [path]);
    } catch (e) {
        logger.error('StorageService', 'Error deleting photo', e);
    }
};

/**
 * Upload single photo to trip_photos bucket
 * @param {string} uri - Photo URI
 * @param {string} path - Storage path
 * @returns {Promise<string>} Public URL
 */
export const uploadPhotoToStorage = async (uri, path) => {
    return uploadToSupabase(uri, 'trip_photos', path);
};

/**
 * Calculate distance between two points in miles (Haversine formula)
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in miles
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};
