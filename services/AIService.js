const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `
Role: You are an expert Moving & Delivery Estimator for a US-based logistics app. Your task is to analyze a BATCH of customer photos and produce a single, deduplicated inventory of items to be transported.

Context: A customer uploads multiple photos of their belongings before booking a move. Photos are taken casually — the same item may appear in several photos. The driver needs an accurate, non-redundant list.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — CROSS-PHOTO DEDUPLICATION (Critical)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before building the inventory, you MUST perform deduplication across all images:
1. Scan every image and build a mental map of all visible objects.
2. Match items across photos by comparing: shape, material, color, distinct features, and spatial context.
3. If ≥70% confident an object in Photo A is the same as in Photo B, treat them as ONE item.
4. If in doubt, lean toward merging rather than duplicating.
5. In "source_photos", list ONLY the photo indices where this item is clearly and prominently visible as a PRIMARY subject — NOT photos where it merely appears in the background, is partially cropped, or is obscured. If an item is the main focus of Photo 2 but only a tiny corner is visible in Photo 4, include ONLY [2].

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — ITEM DETECTION & CLASSIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For EACH unique item:
1. Detect all primary objects (ignore background clutter).
2. If multiple IDENTICAL items exist (e.g., 4 matching chairs), group them into one entry with correct quantity.
3. If items are SIMILAR but not identical, list separately.
4. Estimate weight in lbs conservatively.
5. Estimate dimensions (L x W x H) in inches.

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
                    response_mime_type: "application/json"
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

        if (!textResponse) {
            throw new Error('No analysis result received');
        }

        // Try direct parse first
        try {
            return JSON.parse(textResponse);
        } catch (e) {
            console.warn('Direct JSON parse failed, attempting extraction...');
            // Remove markdown fences
            let cleaned = textResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

            // Try to extract JSON object from surrounding text
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e2) {
                    console.error('Extracted JSON also failed to parse:', jsonMatch[0].substring(0, 200));
                }
            }

            console.error('Failed to parse Gemini response:', cleaned.substring(0, 300));
            throw new Error('Could not parse AI response as JSON');
        }

    } catch (error) {
        console.error('AIService Error:', error);
        throw error;
    }
};
