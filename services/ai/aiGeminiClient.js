import { GEMINI_URL } from './aiConstants';
import { logger } from '../logger';
import { parseGeminiJson } from './aiJsonParser';

const extractGeminiText = (responseData) => responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

const sendGeminiRequest = async (payload, { scope = 'AIService', errorMessage = 'Failed AI call' } = {}) => {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error(scope, 'Gemini API call failed', data);
    throw new Error(data?.error?.message || errorMessage);
  }

  return data;
};

export const callGeminiJson = async ({
  prompt,
  input,
  temperature = 0.2,
  scope = 'AIService',
  errorMessage = 'Failed AI JSON call',
}) => {
  const payload = {
    contents: [
      {
        parts: [
          {
            text: [
              prompt.trim(),
              '',
              'INPUT_JSON:',
              JSON.stringify(input || {}),
            ].join('\n'),
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature,
    },
  };

  const data = await sendGeminiRequest(payload, { scope, errorMessage });
  return parseGeminiJson(extractGeminiText(data), scope);
};

export const callGeminiImageBatchJson = async ({
  textPrompt,
  base64Images,
  scope = 'AIService',
  errorMessage = 'Failed to analyze images',
}) => {
  const parts = [{ text: textPrompt }];

  (base64Images || []).forEach((base64) => {
    parts.push({
      inline_data: {
        mime_type: 'image/jpeg',
        data: base64,
      },
    });
  });

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      response_mime_type: 'application/json',
      maxOutputTokens: 65536,
    },
  };

  const data = await sendGeminiRequest(payload, { scope, errorMessage });
  const textResponse = extractGeminiText(data);

  logger.debug(scope, 'Gemini raw response preview', textResponse?.substring(0, 500));
  return parseGeminiJson(textResponse, scope);
};
