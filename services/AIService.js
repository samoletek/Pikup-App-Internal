import { appConfig } from "../config/appConfig";

const GEMINI_API_KEY = appConfig.ai.geminiApiKey;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const VEHICLE_IDS = ['midsize_suv', 'fullsize_pickup', 'fullsize_truck', 'cargo_truck'];

const SYSTEM_PROMPT = `
Role: You are an expert Moving & Delivery Estimator for a US-based logistics app. Your task is to analyze a BATCH of customer photos and produce a single, deduplicated inventory of items to be transported.

Context: A customer uploads multiple photos of their belongings before booking a move. Photos are taken casually — the same item may appear in several photos. The driver needs an accurate, non-redundant list.

NON-NEGOTIABLE FOCUS RULE:
- In each photo, identify primary transport subject(s): usually ONE, but include multiple when several large central items are co-primary.
- "Most central" means the item is mostly inside the center area of the frame (roughly middle 60%).
- "Largest" means it visually dominates the scene (not a tiny or background object).
- Ignore all secondary/background objects, even if recognizable.
- NEVER capture small background items such as shoes, wall decor, lamps, plants, pillows, rugs, or small tabletop objects.
- If an object is small, on the periphery, wall-mounted decor, or not the transport target, exclude it from the inventory.
- Default to one candidate item per photo, but include 2+ candidates if there are multiple large central transport targets (e.g., sofa + table).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — CROSS-PHOTO DEDUPLICATION (Critical)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before building the inventory, you MUST perform deduplication across all images:
1. For each photo, extract its primary transport subject(s): normally one, or multiple if several large central co-primary items exist.
2. Match extracted primary subjects across photos by comparing: shape, material, color, distinct features, and context.
3. If ≥70% confident Photo A and Photo B show the same physical object, merge as ONE item.
4. Different angle, distance, lighting, rotation, crop, or partial view of the same object still counts as the SAME item.
5. If in doubt, lean toward merging rather than duplicating.
6. In "source_photos", list ONLY photo indices where this item is clearly and prominently visible as a PRIMARY subject.
7. If all uploaded photos show the same object, output exactly ONE item with quantity = 1.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — ITEM DETECTION & CLASSIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For EACH unique item:
1. Use only deduplicated primary subjects from Phase 1 (ignore background clutter completely).
2. Do NOT create extra entries for the same object seen in multiple photos.
3. If multiple IDENTICAL physical copies truly exist, group them into one entry with correct quantity.
4. If items are SIMILAR but not identical, list separately.
5. Do NOT include incidental household/background items (e.g., shoes, wall decor, lamps) unless they are clearly the main transport item.
6. Estimate weight in lbs conservatively.
7. Estimate dimensions (L x W x H) in inches.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3 — JSON OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Output MUST be a valid JSON object. No markdown.

{
  "total_items": <int>,
  "estimated_total_weight_lbs": <int>,
  "items": [
    {
      "item_name": "<specific title, 2-5 words>",
      "description": "<visual description, 10-25 words, material, color, style>",
      "category": "<Furniture | Boxes/Totes | Appliances | Electronics | Sports Equipment | Mattress/Bedding | Outdoor/Garden | Fragile/Art | Musical Instruments | Office Equipment | Other>",
      "condition": "<New | Good | Worn | Damaged>",
      "estimated_weight_lbs": <int>,
      "is_fragile": <boolean>,
      "quantity": <int, default 1>,
      "source_photos": [<1-based photo indices where item is PROMINENTLY visible>]
    }
  ]
}

RETURN ONLY THE JSON OBJECT.
`;

const VEHICLE_RECOMMENDATION_PROMPT = `
Role: You are a logistics load-planning assistant for a US moving app.

Task:
Given a JSON payload with:
1) vehicle options
2) item summary
3) item list

Return a strict JSON recommendation for which vehicle should be selected.

Rules:
1) Choose ONE recommended vehicle id from this allowed set:
["midsize_suv","fullsize_pickup","fullsize_truck","cargo_truck"]
2) Mark each vehicle as fits true/false.
3) If a vehicle is false, provide a short concrete reason.
4) Prefer the smallest vehicle that safely fits all items.
5) Consider quantity, bulk, fragility stacking limits, and rough weight.
6) TV SAFETY RULE (strict):
   - If any item is a TV/television, it must be transported upright (not laid flat).
   - With any TV present, "midsize_suv" must be marked fits=false.
   - Minimum allowed recommendation becomes "fullsize_pickup".
   - If pickup cannot safely fit all items together with the TV upright, recommend "fullsize_truck" or "cargo_truck" based on total load.
7) Output ONLY valid JSON, no markdown.

Output schema:
{
  "recommended_vehicle_id": "midsize_suv|fullsize_pickup|fullsize_truck|cargo_truck",
  "fit_by_vehicle": {
    "midsize_suv": { "fits": true, "reason": "..." },
    "fullsize_pickup": { "fits": true, "reason": "..." },
    "fullsize_truck": { "fits": true, "reason": "..." },
    "cargo_truck": { "fits": true, "reason": "..." }
  }
}
`;

const HANDLING_TIME_PROMPT = `
Role: You are a moving operations planner.

Task:
Estimate loading and unloading time ranges for this move.

Rules:
1) Use concise ranges in minutes.
2) Include people count in parentheses.
3) Consider item quantity, total weight, fragility, and recommended vehicle.
4) Be practical and conservative.
5) Output ONLY valid JSON, no markdown.

Output schema:
{
  "loading_estimate": "e.g. 25-40 min (2 people)",
  "unloading_estimate": "e.g. 20-35 min (2 people)"
}
`;

const STEP6_DESCRIPTION_PROMPT = `
Role: You are a customer-facing assistant for a moving app review screen.

Task:
Write one short, clear descriptor sentence for Step 6 ("Review & Confirm").

Rules:
1) Mention that estimate is based on items and selected/recommended vehicle.
2) Keep it calm and practical.
3) Max 120 characters.
4) Output ONLY valid JSON, no markdown.

Output schema:
{
  "step6_description": "e.g. AI estimate based on your items and selected vehicle."
}
`;

// Repairs truncated JSON by tracking open braces/brackets char-by-char,
// then trimming to last valid closed position and appending missing closers.
const repairTruncatedJson = (text) => {
    const stack = [];
    let inString = false;
    let escaped = false;
    let lastClosedPos = -1;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\' && inString) { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;

        if (ch === '{' || ch === '[') {
            stack.push(ch);
        } else if (ch === '}' || ch === ']') {
            stack.pop();
            if (stack.length === 0) lastClosedPos = i;
        }
    }

    if (stack.length === 0) return text; // already valid

    // Trim back to last fully-closed root, then close remaining open structures
    let repaired = lastClosedPos >= 0
        ? text.substring(0, lastClosedPos + 1)
        : text.trimEnd().replace(/,\s*$/, '');

    repaired = repaired.replace(/,\s*$/, '');
    for (let i = stack.length - 1; i >= 0; i--) {
        repaired += stack[i] === '{' ? '}' : ']';
    }
    return repaired;
};

const parseGeminiJson = (textResponse) => {
    if (!textResponse) {
        throw new Error('No analysis result received');
    }

    // Remove markdown fences
    let cleaned = textResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // Attempt 1: direct parse
    try {
        return JSON.parse(cleaned);
    } catch (_e1) { }

    // Attempt 2: extract outermost {...} and parse
    const outerMatch = cleaned.match(/\{[\s\S]*\}/);
    if (outerMatch) {
        try {
            return JSON.parse(outerMatch[0]);
        } catch (_e2) { }
    }

    // Attempt 3: response was truncated — try to repair the JSON structure
    console.warn('AI response truncated, attempting JSON repair...');
    try {
        const toRepair = outerMatch ? outerMatch[0] : cleaned;
        const repaired = repairTruncatedJson(toRepair);
        const parsed = JSON.parse(repaired);
        console.warn(`JSON repair succeeded, salvaged ${parsed?.items?.length ?? 0} items`);
        return parsed;
    } catch (_e3) { }

    throw new Error('Could not parse AI response as JSON');
};

const callGeminiJson = async ({ prompt, input, temperature = 0.2 }) => {
    const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [{
                        text: [
                            prompt.trim(),
                            '',
                            'INPUT_JSON:',
                            JSON.stringify(input || {}),
                        ].join('\n'),
                    }],
                },
            ],
            generationConfig: {
                response_mime_type: 'application/json',
                temperature,
            },
        }),
    });

    const data = await response.json();
    if (!response.ok) {
        console.error('Gemini JSON call error:', data);
        throw new Error(data.error?.message || 'Failed AI JSON call');
    }

    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return parseGeminiJson(textResponse);
};

const normalizeVehicleFitRecommendation = (parsed) => {
    const fitByVehicle = {};
    VEHICLE_IDS.forEach((id, idx) => {
        const raw = parsed?.fit_by_vehicle?.[id];
        const fits = typeof raw?.fits === 'boolean' ? raw.fits : idx === VEHICLE_IDS.length - 1;
        fitByVehicle[id] = {
            fits,
            reason: typeof raw?.reason === 'string' ? raw.reason : '',
        };
    });

    let recommendedVehicleId = parsed?.recommended_vehicle_id;
    if (!VEHICLE_IDS.includes(recommendedVehicleId)) {
        const firstFit = VEHICLE_IDS.find(id => fitByVehicle[id].fits);
        recommendedVehicleId = firstFit || VEHICLE_IDS[VEHICLE_IDS.length - 1];
    }

    return {
        recommendedVehicleId,
        fitByVehicle,
    };
};

const normalizeHandlingEstimates = (parsed) => {
    return {
        loadingEstimate: typeof parsed?.loading_estimate === 'string' ? parsed.loading_estimate : '',
        unloadingEstimate: typeof parsed?.unloading_estimate === 'string' ? parsed.unloading_estimate : '',
    };
};

const normalizeStep6Descriptor = (parsed) => {
    if (typeof parsed?.step6_description === 'string') {
        return parsed.step6_description.trim();
    }
    return '';
};

const requestVehicleRecommendation = async (input) => {
    const parsed = await callGeminiJson({
        prompt: VEHICLE_RECOMMENDATION_PROMPT,
        input,
        temperature: 0.2,
    });

    return normalizeVehicleFitRecommendation(parsed);
};

const requestHandlingEstimate = async (input) => {
    const parsed = await callGeminiJson({
        prompt: HANDLING_TIME_PROMPT,
        input,
        temperature: 0.2,
    });

    return normalizeHandlingEstimates(parsed);
};

const requestStep6Description = async (input) => {
    const parsed = await callGeminiJson({
        prompt: STEP6_DESCRIPTION_PROMPT,
        input,
        temperature: 0.2,
    });

    return normalizeStep6Descriptor(parsed);
};

export const analyzeImages = async (base64Images) => {
    try {
        // Prepare parts: 1 text prompt + N images
        const parts = [
            { text: SYSTEM_PROMPT }
        ];

        base64Images.forEach(base64 => {
            parts.push({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: base64
                }
            });
        });

        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: parts
                    }
                ],
                generationConfig: {
                    response_mime_type: "application/json",
                    maxOutputTokens: 65536
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Gemini API Error:', data);
            throw new Error(data.error?.message || 'Failed to analyze images');
        }

        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log('Gemini raw response (first 500 chars):', textResponse?.substring(0, 500));

        return parseGeminiJson(textResponse);

    } catch (error) {
        console.error('AIService Error:', error);
        throw error;
    }
};

export const recommendVehicleForItems = async ({ itemSummary, items = [], vehicles = [] }) => {
    if (!GEMINI_API_KEY) {
        throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY');
    }

    const vehiclePayload = vehicles.map(vehicle => ({
        id: vehicle.id,
        type: vehicle.type,
        capacity: vehicle.capacity || null,
        maxWeight: vehicle.maxWeight || null,
        itemGuidance: vehicle.items || null,
    }));

    const itemPayload = (items || []).map(item => ({
        name: item.name || '',
        description: item.description || '',
        condition: item.condition || 'used',
        fragile: !!item.isFragile,
        insured: !!item.hasInsurance,
        estimatedWeightLbs: Number(item.weightEstimate) || 0,
    }));

    const baseInput = {
        summary: itemSummary || '',
        vehicles: vehiclePayload,
        items: itemPayload,
    };

    // 1) Vehicle fit + recommendation
    const fitRecommendation = await requestVehicleRecommendation(baseInput);

    const followUpInput = {
        ...baseInput,
        recommended_vehicle_id: fitRecommendation.recommendedVehicleId,
        fit_by_vehicle: fitRecommendation.fitByVehicle,
    };

    // 2) Handling time + 3) Step 6 descriptor
    const [handlingResult, descriptorResult] = await Promise.allSettled([
        requestHandlingEstimate(followUpInput),
        requestStep6Description(followUpInput),
    ]);

    const handling = handlingResult.status === 'fulfilled'
        ? handlingResult.value
        : { loadingEstimate: '', unloadingEstimate: '' };

    const step6Description = descriptorResult.status === 'fulfilled'
        ? descriptorResult.value
        : '';

    return {
        ...fitRecommendation,
        loadingEstimate: handling.loadingEstimate,
        unloadingEstimate: handling.unloadingEstimate,
        step6Description,
        // Keep notes for backwards compatibility while screens migrate.
        notes: step6Description,
    };
};
