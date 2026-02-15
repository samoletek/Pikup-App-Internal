import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const visionApiKey = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY') ?? '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================
// VIN UTILITIES
// ============================================

const VIN_REGEX = /[A-HJ-NPR-Z0-9]{17}/g;

const VIN_TRANSLITERATION: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
    J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

function validateVinCheckDigit(vin: string): boolean {
    let sum = 0;
    for (let i = 0; i < 17; i++) {
        const char = vin[i];
        const value = /\d/.test(char) ? parseInt(char) : (VIN_TRANSLITERATION[char] || 0);
        sum += value * VIN_WEIGHTS[i];
    }
    const remainder = sum % 11;
    const checkDigit = remainder === 10 ? 'X' : String(remainder);
    return vin[8] === checkDigit;
}

function extractVin(ocrText: string): string | null {
    const cleaned = ocrText.replace(/[\s\-\.]/g, '').toUpperCase();
    const matches = cleaned.match(VIN_REGEX);
    if (!matches) return null;

    // Prefer a match that passes check digit validation
    for (const candidate of matches) {
        if (validateVinCheckDigit(candidate)) return candidate;
    }
    // If none pass, return first match anyway
    return matches[0];
}

// ============================================
// GOOGLE CLOUD VISION
// ============================================

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';

async function downloadAndEncode(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download image from ${url}`);
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
}

async function ocrImage(base64Image: string): Promise<string> {
    const response = await fetch(`${VISION_API_URL}?key=${visionApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            requests: [{
                image: { content: base64Image },
                features: [{ type: 'TEXT_DETECTION', maxResults: 10 }]
            }]
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Vision API TEXT_DETECTION failed: ${errorBody}`);
    }

    const data = await response.json();
    const annotations = data.responses?.[0]?.textAnnotations;
    if (!annotations || annotations.length === 0) return '';

    // First annotation is the full detected text
    return annotations[0].description || '';
}

async function analyzeCarPhoto(base64Image: string): Promise<{ labels: string[], logos: string[] }> {
    const response = await fetch(`${VISION_API_URL}?key=${visionApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            requests: [{
                image: { content: base64Image },
                features: [
                    { type: 'LABEL_DETECTION', maxResults: 20 },
                    { type: 'LOGO_DETECTION', maxResults: 5 }
                ]
            }]
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Vision API LABEL/LOGO failed: ${errorBody}`);
    }

    const data = await response.json();
    const result = data.responses?.[0] || {};

    const labels = (result.labelAnnotations || []).map((l: { description: string }) => l.description);
    const logos = (result.logoAnnotations || []).map((l: { description: string }) => l.description);

    return { labels, logos };
}

// ============================================
// NHTSA VIN DECODE
// ============================================

interface VinData {
    vin: string;
    make: string;
    model: string;
    year: string;
    bodyClass: string;
    vehicleType: string;
    plantCountry: string;
    errorCode: string;
}

async function decodeVin(vin: string): Promise<VinData> {
    const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${vin}?format=json`
    );

    if (!response.ok) {
        throw new Error('NHTSA API request failed');
    }

    const data = await response.json();
    const v = data.Results?.[0];

    if (!v) {
        throw new Error('NHTSA returned no results');
    }

    return {
        vin,
        make: v.Make || '',
        model: v.Model || '',
        year: v.ModelYear || '',
        bodyClass: v.BodyClass || '',
        vehicleType: v.VehicleType || '',
        plantCountry: v.PlantCountry || '',
        errorCode: v.ErrorCode || '',
    };
}

// ============================================
// CROSS-CHECK
// ============================================

const VEHICLE_KEYWORDS = [
    'car', 'vehicle', 'automobile', 'truck', 'van', 'suv',
    'pickup', 'motor vehicle', 'sedan', 'transport'
];

function crossCheck(
    vinData: VinData,
    photoLabels: string[],
    photoLogos: string[]
): { match: boolean; confidence: number; isVehicle: boolean } {
    const allDetected = [...photoLabels, ...photoLogos].map(s => s.toLowerCase());
    const vinMake = vinData.make.toLowerCase();

    const isVehicle = allDetected.some(d =>
        VEHICLE_KEYWORDS.some(kw => d.includes(kw))
    );

    if (!vinMake) {
        return { match: false, confidence: 0.3, isVehicle };
    }

    const makeFound = allDetected.some(d =>
        d.includes(vinMake) || vinMake.includes(d)
    );

    if (makeFound && isVehicle) return { match: true, confidence: 0.95, isVehicle };
    if (makeFound) return { match: true, confidence: 0.8, isVehicle };
    if (isVehicle) return { match: false, confidence: 0.5, isVehicle };
    return { match: false, confidence: 0.2, isVehicle };
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('Missing required server configuration');
        }

        if (!visionApiKey) {
            throw new Error('Google Cloud Vision API key not configured');
        }

        if (!supabaseServiceRoleKey) {
            throw new Error('Service role key not configured');
        }

        // Auth check
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Unauthorized');
        }

        const supabaseClient = createClient(
            supabaseUrl,
            supabaseAnonKey,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            throw new Error('Unauthorized');
        }

        // Parse request — accepts array of car photo URLs
        const { vinPhotoUrl, carPhotoUrls } = await req.json();
        if (!vinPhotoUrl || !carPhotoUrls || !Array.isArray(carPhotoUrls) || carPhotoUrls.length === 0) {
            throw new Error('vinPhotoUrl and at least one car photo URL are required');
        }

        // Step 1: Download and encode all images in parallel
        const [vinPhotoBase64, ...carPhotosBase64] = await Promise.all([
            downloadAndEncode(vinPhotoUrl),
            ...carPhotoUrls.map((url: string) => downloadAndEncode(url)),
        ]);

        // Step 2: OCR on VIN photo
        const ocrText = await ocrImage(vinPhotoBase64);
        const extractedVin = extractVin(ocrText);

        if (!extractedVin) {
            return new Response(
                JSON.stringify({
                    status: 'rejected',
                    reason: 'Could not read VIN from photo. Please make sure the VIN plate is clearly visible and retake the photo.',
                    extractedVin: null,
                    vinData: null,
                    photoAnalysis: null,
                    confidence: 0,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Step 3: Decode VIN via NHTSA + Analyze ALL car photos (in parallel)
        const [vinData, ...photoAnalyses] = await Promise.all([
            decodeVin(extractedVin),
            ...carPhotosBase64.map((b64: string) => analyzeCarPhoto(b64)),
        ]) as [VinData, ...{ labels: string[], logos: string[] }[]];

        // Merge labels and logos from all car photos (deduplicated)
        const mergedLabels = [...new Set(photoAnalyses.flatMap(a => a.labels))];
        const mergedLogos = [...new Set(photoAnalyses.flatMap(a => a.logos))];

        // Step 4: Cross-check with merged data from all photos
        const checkResult = crossCheck(vinData, mergedLabels, mergedLogos);

        // Step 5: Determine status
        let status: string;
        let reason: string;

        if (vinData.errorCode && !vinData.errorCode.startsWith('0')) {
            status = 'manual_review';
            reason = 'VIN could not be fully decoded. Please review the vehicle details.';
        } else if (!checkResult.isVehicle) {
            status = 'rejected';
            reason = 'No vehicle detected in the photo. Please take a clear photo of your vehicle.';
        } else if (checkResult.match && checkResult.confidence >= 0.8) {
            status = 'approved';
            reason = 'Vehicle verified successfully.';
        } else if (checkResult.confidence >= 0.5) {
            status = 'manual_review';
            reason = `VIN indicates ${vinData.make} ${vinData.model}, but the photo could not be fully matched. Please review the details.`;
        } else {
            status = 'rejected';
            reason = `VIN indicates ${vinData.make}, but the vehicle photo does not match. Please retake the photos.`;
        }

        // Step 6: Server-side save — only the server can set vehicle_verified
        const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

        const { data: profile } = await adminClient
            .from('drivers')
            .select('metadata')
            .eq('id', user.id)
            .maybeSingle();

        const currentMeta = profile?.metadata || {};
        const isApproved = status === 'approved';

        const { error: updateError } = await adminClient
            .from('drivers')
            .update({
                vehicle_verified: isApproved,
                metadata: {
                    ...currentMeta,
                    vehicleData: {
                        vin: extractedVin,
                        make: vinData.make,
                        model: vinData.model,
                        year: vinData.year,
                        bodyClass: vinData.bodyClass,
                        vehicleType: vinData.vehicleType,
                        verificationStatus: status,
                        confidence: checkResult.confidence,
                        verifiedAt: isApproved ? new Date().toISOString() : null,
                    },
                },
                updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

        if (updateError) {
            console.error('Failed to save verification result:', updateError);
            throw new Error('Failed to save verification result');
        }

        return new Response(
            JSON.stringify({
                status,
                vinData,
                photoAnalysis: {
                    labels: mergedLabels,
                    logos: mergedLogos,
                    photoCount: carPhotoUrls.length,
                },
                confidence: checkResult.confidence,
                reason,
                extractedVin,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('verify-vehicle error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
