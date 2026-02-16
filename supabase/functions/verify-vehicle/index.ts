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

const VIN_CHAR_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

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

interface OcrResult {
    fullText: string;
    blocks: string[];
}

function extractVin(ocr: OcrResult): string | null {
    const { fullText, blocks } = ocr;

    // Strategy 1: Check individual OCR text blocks for a standalone 17-char VIN.
    // Google Vision returns each word/number as a separate block — the VIN is
    // almost always its own block (e.g. "WDB2100261B359440"), without surrounding
    // text that causes false matches in the concatenated full text.
    for (const block of blocks) {
        const cleaned = block.replace(/[\s\-\.]/g, '').toUpperCase();
        if (cleaned.length === 17 && VIN_CHAR_REGEX.test(cleaned)) {
            return cleaned;
        }
    }

    // Strategy 2: Find "VIN" label in full text and extract 17-char number after it.
    // US stickers have "VIN WD3PE7DD8GP283765" — the label points right to it.
    const upper = fullText.toUpperCase();
    const vinAfterLabel = upper.match(
        /\bVIN\b[\s.:;\-#]*((?:[A-HJ-NPR-Z0-9][\s.\-]*){17})/
    );
    if (vinAfterLabel) {
        const vin = vinAfterLabel[1].replace(/[^A-HJ-NPR-Z0-9]/g, '');
        if (vin.length === 17) return vin;
    }

    // Strategy 3: Sliding window on full cleaned text (last resort).
    const cleaned = upper.replace(/[\s\-\.]/g, '');
    const candidates: string[] = [];
    for (let i = 0; i <= cleaned.length - 17; i++) {
        const substr = cleaned.substring(i, i + 17);
        if (VIN_CHAR_REGEX.test(substr)) {
            candidates.push(substr);
        }
    }

    if (candidates.length === 0) return null;

    const unique = [...new Set(candidates)];

    // Prefer a match that passes check digit validation
    for (const candidate of unique) {
        if (validateVinCheckDigit(candidate)) return candidate;
    }

    return unique[0];
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

async function ocrImage(base64Image: string): Promise<OcrResult> {
    const response = await fetch(`${VISION_API_URL}?key=${visionApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            requests: [{
                image: { content: base64Image },
                features: [{ type: 'TEXT_DETECTION', maxResults: 50 }]
            }]
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Vision API TEXT_DETECTION failed: ${errorBody}`);
    }

    const data = await response.json();
    const annotations = data.responses?.[0]?.textAnnotations;
    if (!annotations || annotations.length === 0) {
        return { fullText: '', blocks: [] };
    }

    // First annotation is the full concatenated text; rest are individual words/blocks
    return {
        fullText: annotations[0].description || '',
        blocks: annotations.slice(1).map((a: { description: string }) => a.description || ''),
    };
}

interface CarPhotoAnalysis {
    labels: string[];
    logos: string[];
    texts: string[];
    dominantColors: { r: number; g: number; b: number; score: number; pixelFraction: number }[];
}

async function analyzeCarPhoto(base64Image: string): Promise<CarPhotoAnalysis> {
    const response = await fetch(`${VISION_API_URL}?key=${visionApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            requests: [{
                image: { content: base64Image },
                features: [
                    { type: 'LABEL_DETECTION', maxResults: 20 },
                    { type: 'LOGO_DETECTION', maxResults: 5 },
                    { type: 'TEXT_DETECTION', maxResults: 10 },
                    { type: 'IMAGE_PROPERTIES' },
                ]
            }]
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Vision API analysis failed: ${errorBody}`);
    }

    const data = await response.json();
    const result = data.responses?.[0] || {};

    const labels = (result.labelAnnotations || []).map((l: { description: string }) => l.description);
    const logos = (result.logoAnnotations || []).map((l: { description: string }) => l.description);
    const textAnnotations = result.textAnnotations || [];
    const texts = textAnnotations.map((t: { description: string }) => t.description);
    const dominantColors = (result.imagePropertiesAnnotation?.dominantColors?.colors || [])
        .map((c: { color: { red?: number; green?: number; blue?: number }; score: number; pixelFraction: number }) => ({
            r: c.color?.red || 0,
            g: c.color?.green || 0,
            b: c.color?.blue || 0,
            score: c.score || 0,
            pixelFraction: c.pixelFraction || 0,
        }));

    return { labels, logos, texts, dominantColors };
}

// ============================================
// LICENSE PLATE EXTRACTION
// ============================================

function extractLicensePlate(allTexts: string[]): string | null {
    if (allTexts.length === 0) return null;

    // Check individual text blocks (skip first — it's the full concatenated text)
    for (const text of allTexts.slice(1)) {
        const cleaned = text.trim().toUpperCase().replace(/[\s\-]/g, '');
        if (cleaned.length >= 5 && cleaned.length <= 8) {
            const hasLetters = /[A-Z]/.test(cleaned);
            const hasNumbers = /[0-9]/.test(cleaned);
            // Skip VIN-like strings (17 chars)
            if (hasLetters && hasNumbers && cleaned.length <= 8) {
                return text.trim().toUpperCase();
            }
        }
    }

    // Fallback: regex on full text
    const fullText = allTexts[0]?.toUpperCase() || '';
    const plateRegex = /\b([A-Z0-9]{1,4}[\s\-]?[A-Z0-9]{2,5})\b/g;
    const matches = [...fullText.matchAll(plateRegex)];

    for (const m of matches) {
        const candidate = m[1].replace(/[\s\-]/g, '');
        if (candidate.length >= 5 && candidate.length <= 8) {
            const hasLetters = /[A-Z]/.test(candidate);
            const hasNumbers = /[0-9]/.test(candidate);
            if (hasLetters && hasNumbers) {
                return m[1].trim();
            }
        }
    }

    return null;
}

// ============================================
// COLOR DETECTION
// ============================================

const COLOR_KEYWORDS = [
    'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange',
    'brown', 'gray', 'grey', 'silver', 'gold', 'beige', 'tan',
    'maroon', 'navy', 'purple', 'burgundy', 'champagne', 'bronze',
];

function detectVehicleColor(
    labels: string[],
    dominantColors: { r: number; g: number; b: number; score: number; pixelFraction: number }[]
): string | null {
    // Strategy 1: look for color keywords in labels
    for (const label of labels) {
        const lower = label.toLowerCase();
        for (const colorName of COLOR_KEYWORDS) {
            if (lower.includes(colorName)) {
                const name = colorName === 'grey' ? 'Gray' : colorName;
                return name.charAt(0).toUpperCase() + name.slice(1);
            }
        }
    }

    // Strategy 2: use dominant color (top by pixelFraction, skip very small fractions)
    if (dominantColors.length > 0) {
        const sorted = [...dominantColors]
            .filter(c => c.pixelFraction > 0.05)
            .sort((a, b) => b.pixelFraction - a.pixelFraction);

        if (sorted.length > 0) {
            return rgbToColorName(sorted[0].r, sorted[0].g, sorted[0].b);
        }
    }

    return null;
}

function rgbToColorName(r: number, g: number, b: number): string {
    const brightness = (r + g + b) / 3;

    // Very dark → Black
    if (brightness < 50) return 'Black';

    // Very bright and neutral → White
    if (brightness > 210 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25) return 'White';

    // Neutral tones (gray/silver)
    if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30) {
        if (brightness > 170) return 'Silver';
        return 'Gray';
    }

    // Red dominant
    if (r > g + 50 && r > b + 50) {
        if (brightness < 80) return 'Maroon';
        if (g > 100 && b < 80) return 'Orange';
        return 'Red';
    }

    // Blue dominant
    if (b > r + 50 && b > g + 50) {
        if (brightness < 80) return 'Navy';
        return 'Blue';
    }

    // Green dominant
    if (g > r + 30 && g > b + 30) return 'Green';

    // Yellow
    if (r > 180 && g > 180 && b < 100) return 'Yellow';

    // Brown
    if (r > 100 && g > 60 && g < 120 && b < 80) return 'Brown';

    return 'Gray';
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

const KNOWN_CAR_BRANDS = [
    'ford', 'chevrolet', 'chevy', 'toyota', 'honda', 'nissan', 'bmw',
    'mercedes-benz', 'mercedes', 'audi', 'volkswagen', 'vw', 'hyundai',
    'kia', 'subaru', 'mazda', 'lexus', 'acura', 'infiniti', 'cadillac',
    'buick', 'gmc', 'jeep', 'dodge', 'ram', 'chrysler', 'lincoln',
    'volvo', 'porsche', 'land rover', 'jaguar', 'tesla', 'rivian',
    'lucid', 'genesis', 'mitsubishi', 'fiat', 'alfa romeo', 'maserati',
    'bentley', 'rolls-royce', 'ferrari', 'lamborghini', 'aston martin',
    'mini', 'peugeot', 'renault', 'citroen', 'seat', 'skoda',
];

interface CrossCheckResult {
    match: boolean;
    confidence: number;
    isVehicle: boolean;
    differentBrandDetected: string | null;
}

function crossCheck(
    vinData: VinData,
    photoLabels: string[],
    photoLogos: string[]
): CrossCheckResult {
    const allDetected = [...photoLabels, ...photoLogos].map(s => s.toLowerCase());
    const logosLower = photoLogos.map(s => s.toLowerCase());
    const vinMake = vinData.make.toLowerCase();

    const isVehicle = allDetected.some(d =>
        VEHICLE_KEYWORDS.some(kw => d.includes(kw))
    );

    if (!vinMake) {
        return { match: false, confidence: 0.3, isVehicle, differentBrandDetected: null };
    }

    const makeFound = allDetected.some(d =>
        d.includes(vinMake) || vinMake.includes(d)
    );

    // Check if a DIFFERENT known car brand was detected in logos
    let differentBrandDetected: string | null = null;
    for (const logo of logosLower) {
        const isKnownBrand = KNOWN_CAR_BRANDS.some(brand =>
            logo.includes(brand) || brand.includes(logo)
        );
        const isVinBrand = logo.includes(vinMake) || vinMake.includes(logo);
        if (isKnownBrand && !isVinBrand) {
            // Found a different brand logo — capitalize for display
            differentBrandDetected = photoLogos.find(l =>
                l.toLowerCase() === logo
            ) || logo;
            break;
        }
    }

    if (makeFound && isVehicle) return { match: true, confidence: 0.95, isVehicle, differentBrandDetected: null };
    if (makeFound) return { match: true, confidence: 0.8, isVehicle, differentBrandDetected: null };
    if (differentBrandDetected && isVehicle) return { match: false, confidence: 0.1, isVehicle, differentBrandDetected };
    if (isVehicle) return { match: false, confidence: 0.5, isVehicle, differentBrandDetected: null };
    return { match: false, confidence: 0.2, isVehicle, differentBrandDetected: null };
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
        const ocrResult = await ocrImage(vinPhotoBase64);
        const extractedVin = extractVin(ocrResult);

        if (!extractedVin) {
            // No 17-character sequence found in photo at all
            const ocrPreview = ocrResult.fullText.trim().substring(0, 80);
            return new Response(
                JSON.stringify({
                    status: 'rejected',
                    reason: ocrResult.fullText.trim().length === 0
                        ? 'No text detected in the VIN photo. Make sure the VIN plate is clearly visible and well-lit.'
                        : `Could not find a 17-character VIN in the photo. OCR read: "${ocrPreview}". Please retake with a clearer angle.`,
                    extractedVin: null,
                    vinData: null,
                    photoAnalysis: null,
                    confidence: 0,
                    detectedColor: null,
                    detectedLicensePlate: null,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check digit validation (informational)
        const vinCheckDigitValid = validateVinCheckDigit(extractedVin);

        // Step 3: Decode VIN via NHTSA + Analyze ALL car photos (in parallel)
        const [vinData, ...photoAnalyses] = await Promise.all([
            decodeVin(extractedVin),
            ...carPhotosBase64.map((b64: string) => analyzeCarPhoto(b64)),
        ]) as [VinData, ...CarPhotoAnalysis[]];

        // Merge labels, logos, texts, and colors from all car photos (deduplicated)
        const mergedLabels = [...new Set(photoAnalyses.flatMap(a => a.labels))];
        const mergedLogos = [...new Set(photoAnalyses.flatMap(a => a.logos))];
        const mergedTexts = photoAnalyses.flatMap(a => a.texts);
        const mergedColors = photoAnalyses.flatMap(a => a.dominantColors);

        // Step 4: Extract license plate and color
        const detectedLicensePlate = extractLicensePlate(mergedTexts);
        const detectedColor = detectVehicleColor(mergedLabels, mergedColors);

        // Step 5: Cross-check with merged data from all photos
        const checkResult = crossCheck(vinData, mergedLabels, mergedLogos);

        // Step 6: Determine status — only approved or rejected
        let status: 'approved' | 'rejected';
        let reason: string;

        if (!vinData.make) {
            // NHTSA couldn't decode make — either non-US vehicle, misread, or invalid VIN.
            // Don't check WMI country code — many US-market vehicles have foreign WMIs
            // (e.g. Mercedes Sprinter WD3..., BMW WBA...). NHTSA itself knows what's US-market.
            if (!vinCheckDigitValid) {
                status = 'rejected';
                reason = `VIN "${extractedVin}" could not be verified — the check digit is invalid. This may be a non-US vehicle or the VIN was misread. Please check the photo.`;
            } else {
                status = 'rejected';
                reason = `VIN "${extractedVin}" could not be decoded. This may be a non-US vehicle or an invalid VIN.`;
            }
        } else if (!checkResult.isVehicle) {
            status = 'rejected';
            reason = 'No vehicle detected in the photo. Please take a clear, close-up photo of your vehicle.';
        } else if (checkResult.differentBrandDetected) {
            status = 'rejected';
            reason = `VIN indicates ${vinData.make}, but ${checkResult.differentBrandDetected} was detected in the photo. The vehicle photos must match the VIN.`;
        } else {
            // VIN decoded + vehicle detected + no brand mismatch → approved
            status = 'approved';
            reason = 'Vehicle verified successfully.';
        }

        // Step 7: Server-side save — only the server can set vehicle_verified
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
                        color: detectedColor,
                        licensePlate: detectedLicensePlate,
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
                detectedColor,
                detectedLicensePlate,
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
