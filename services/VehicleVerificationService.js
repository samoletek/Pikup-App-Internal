import { compressImage, uploadToSupabase } from './StorageService';
import { normalizeError } from './errorService';
import { refreshAuthenticatedSession } from './repositories/authRepository';
import {
    fetchDriverRowById,
    invokeVerifyVehicle,
    updateDriverRowById,
} from './repositories/paymentRepository';

const VEHICLE_PHOTOS_BUCKET = 'vehicle-photos';

/**
 * Upload VIN plate and car photos to Supabase Storage.
 * @param {string} driverId
 * @param {string} vinPhotoUri - Local URI of the VIN plate photo
 * @param {string[]} carPhotoUris - Local URIs of car photos (front, side, rear)
 * @returns {Promise<{vinPhotoUrl: string, carPhotoUrls: string[]}>}
 */
export const uploadVehiclePhotos = async (driverId, vinPhotoUri, carPhotoUris) => {
    const timestamp = Date.now();
    const vinPath = `${driverId}/vin_${timestamp}.jpg`;

    const validCarUris = carPhotoUris.filter(Boolean);

    const [compressedVin, ...compressedCars] = await Promise.all([
        compressImage(vinPhotoUri),
        ...validCarUris.map(uri => compressImage(uri)),
    ]);

    const carPaths = validCarUris.map((_, i) => `${driverId}/car_${i}_${timestamp}.jpg`);

    const [vinPhotoUrl, ...carPhotoUrls] = await Promise.all([
        uploadToSupabase(compressedVin, VEHICLE_PHOTOS_BUCKET, vinPath),
        ...compressedCars.map((compressed, i) => uploadToSupabase(compressed, VEHICLE_PHOTOS_BUCKET, carPaths[i])),
    ]);

    return { vinPhotoUrl, carPhotoUrls };
};

/**
 * Call the verify-vehicle edge function.
 * @param {string} vinPhotoUrl - Public URL of VIN photo in Storage
 * @param {string[]} carPhotoUrls - Public URLs of car photos in Storage
 * @returns {Promise<Object>} Verification result
 */
export const verifyVehicle = async (vinPhotoUrl, carPhotoUrls) => {
    const { data, error } = await invokeVerifyVehicle({ vinPhotoUrl, carPhotoUrls });

    if (error) {
        let detail = error.message;
        try {
            // error.context is a Response object — body may not be consumed yet
            if (error.context && typeof error.context.text === 'function') {
                const raw = await error.context.text();
                try {
                    const parsed = JSON.parse(raw);
                    detail = parsed?.error || parsed?.msg || parsed?.message || raw;
                } catch (parseRawError) {
                    const normalizedRaw = normalizeError(parseRawError, raw || detail);
                    detail = normalizedRaw.message || raw || detail;
                }
            }
        } catch (contextReadError) {
            const normalizedContext = normalizeError(contextReadError, detail);
            detail = normalizedContext.message || detail;
        }
        throw new Error(detail);
    }

    if (data?.error) throw new Error(data.error);

    return data;
};

export const refreshVehicleVerificationSession = async () => {
    await refreshAuthenticatedSession();
};

/**
 * Save user-editable vehicle fields (color, licensePlate) to the driver's profile.
 * NOTE: vehicle_verified is set ONLY by the verify-vehicle Edge Function (server-side).
 * The client cannot write vehicle_verified — RLS blocks it.
 * @param {string} driverId
 * @param {Object} vehicleData - Vehicle info to persist (color, licensePlate, etc.)
 * @returns {Promise<Object>}
 */
export const saveVehicleData = async (driverId, vehicleData) => {
    const { data: profile } = await fetchDriverRowById(driverId, 'metadata', true);

    const currentMeta = profile?.metadata || {};
    const existingVehicleData = currentMeta.vehicleData || {};

    const { data, error } = await updateDriverRowById(
        driverId,
        {
            metadata: {
                ...currentMeta,
                vehicleData: {
                    ...existingVehicleData,
                    color: vehicleData.color || existingVehicleData.color || '',
                    licensePlate: vehicleData.licensePlate || existingVehicleData.licensePlate || '',
                },
            },
            updated_at: new Date().toISOString(),
        },
        true
    );

    if (error) throw error;
    return data;
};
