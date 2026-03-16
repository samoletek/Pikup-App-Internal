import { appConfig } from '../../config/appConfig';

export const GEMINI_API_KEY = appConfig.ai.geminiApiKey;
export const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export const VEHICLE_IDS = ['midsize_suv', 'fullsize_pickup', 'fullsize_truck', 'cargo_truck'];

export const IMAGE_ANALYSIS_PROMPT = `
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

export const VEHICLE_RECOMMENDATION_PROMPT = `
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

export const HANDLING_TIME_PROMPT = `
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

export const STEP6_DESCRIPTION_PROMPT = `
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
