import { logger } from '../logger';

const repairTruncatedJson = (text) => {
  const stack = [];
  let inString = false;
  let escaped = false;
  let lastClosedPos = -1;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (ch === '{' || ch === '[') {
      stack.push(ch);
      continue;
    }

    if (ch === '}' || ch === ']') {
      stack.pop();
      if (stack.length === 0) {
        lastClosedPos = i;
      }
    }
  }

  if (stack.length === 0) {
    return text;
  }

  let repaired = lastClosedPos >= 0
    ? text.substring(0, lastClosedPos + 1)
    : text.trimEnd().replace(/,\s*$/, '');

  repaired = repaired.replace(/,\s*$/, '');
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    repaired += stack[i] === '{' ? '}' : ']';
  }

  return repaired;
};

export const parseGeminiJson = (textResponse, scope = 'AIService') => {
  if (!textResponse) {
    throw new Error('No analysis result received');
  }

  const cleaned = textResponse
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_firstError) {
    // Continue to fallback parsing.
  }

  const outerMatch = cleaned.match(/\{[\s\S]*\}/);
  if (outerMatch) {
    try {
      return JSON.parse(outerMatch[0]);
    } catch (_secondError) {
      // Continue to repair path.
    }
  }

  logger.warn(scope, 'AI response truncated, attempting JSON repair');

  try {
    const toRepair = outerMatch ? outerMatch[0] : cleaned;
    const repaired = repairTruncatedJson(toRepair);
    const parsed = JSON.parse(repaired);
    logger.warn(scope, 'JSON repair succeeded', {
      salvagedItems: parsed?.items?.length ?? 0,
    });
    return parsed;
  } catch (_repairError) {
    throw new Error('Could not parse AI response as JSON');
  }
};
