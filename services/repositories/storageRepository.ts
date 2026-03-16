import { supabase } from '../../config/supabase';

/**
 * Storage repository centralizes all Supabase Storage transport calls.
 */
export const uploadToStorageBucket = async (
  bucket: string,
  path: string,
  body: ArrayBuffer,
  options: Record<string, unknown>,
) => {
  return supabase.storage
    .from(bucket)
    .upload(path, body, options);
};

export const getStoragePublicUrl = (bucket: string, path: string) => {
  return supabase.storage
    .from(bucket)
    .getPublicUrl(path);
};

export const createStorageSignedUrl = async (
  bucket: string,
  path: string,
  expiresInSeconds: number,
) => {
  return supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
};

export const removeStoragePaths = async (bucket: string, paths: string[]) => {
  return supabase.storage
    .from(bucket)
    .remove(paths);
};
