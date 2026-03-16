import { supabase } from "../../config/supabase";
import { logger } from "../../services/logger";

const PHOTO_URL_TTL_SECONDS = 60 * 60 * 6;

export const toArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed;
        }
        if (parsed && typeof parsed === "object") {
          return [parsed];
        }
      } catch (_) {
        return [trimmed];
      }
    }

    return [trimmed];
  }

  if (value && typeof value === "object") {
    return [value];
  }

  return [];
};

export const getPickupPhotoCandidates = (source) => {
  return (
    source.pickupPhotos ||
    source.pickup_photos ||
    source.photos ||
    source.pickup?.photos ||
    source.pickup?.details?.photos ||
    []
  );
};

export const getDropoffPhotoCandidates = (source) => {
  return (
    source.dropoffPhotos ||
    source.dropoff_photos ||
    source.deliveryPhotos ||
    source.delivery_photos ||
    source.dropoff?.photos ||
    source.dropoff?.details?.photos ||
    []
  );
};

const resolvePhotoUri = (photo) => {
  if (!photo) {
    return null;
  }

  if (typeof photo === "string") {
    const raw = photo.trim();
    if (!raw) {
      return null;
    }

    if (raw.startsWith("{") || raw.startsWith("[")) {
      try {
        return resolvePhotoUri(JSON.parse(raw));
      } catch (_) {
        return null;
      }
    }

    if (/^(https?:\/\/|file:\/\/|content:\/\/|ph:\/\/|asset:\/\/|data:image\/)/i.test(raw)) {
      return raw;
    }

    const normalizedPath = raw.replace(/^\/+/, "").replace(/^trip_photos\//, "");
    const { data } = supabase.storage.from("trip_photos").getPublicUrl(normalizedPath);
    return data?.publicUrl || null;
  }

  if (Array.isArray(photo)) {
    return resolvePhotoUri(photo[0]);
  }

  if (typeof photo === "object") {
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

const resolvePhotoUris = (photos = []) => {
  return toArray(photos).map(resolvePhotoUri).filter(Boolean);
};

const extractTripPhotoPath = (uri) => {
  if (typeof uri !== "string") {
    return null;
  }

  const raw = uri.trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith("trip_photos/")) {
    return raw.replace(/^trip_photos\//, "");
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    const match = raw.match(/\/storage\/v1\/object\/(?:public|sign)\/trip_photos\/([^?]+)/i);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
    return null;
  }

  if (raw.includes("/") && !raw.startsWith("file://") && !raw.startsWith("content://")) {
    return raw.replace(/^\/+/, "");
  }

  return null;
};

const toSignedTripPhotoUri = async (uri) => {
  const path = extractTripPhotoPath(uri);
  if (!path) {
    return uri;
  }

  try {
    const { data, error } = await supabase.storage
      .from("trip_photos")
      .createSignedUrl(path, PHOTO_URL_TTL_SECONDS);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (error) {
    logger.warn("TripPhotoUtils", "Unable to sign trip photo URL, falling back to original URI", error);
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
