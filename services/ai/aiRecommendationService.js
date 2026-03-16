import {
  HANDLING_TIME_PROMPT,
  STEP6_DESCRIPTION_PROMPT,
  VEHICLE_IDS,
  VEHICLE_RECOMMENDATION_PROMPT,
} from './aiConstants';
import { callGeminiJson } from './aiGeminiClient';

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
    const firstFit = VEHICLE_IDS.find((id) => fitByVehicle[id].fits);
    recommendedVehicleId = firstFit || VEHICLE_IDS[VEHICLE_IDS.length - 1];
  }

  return {
    recommendedVehicleId,
    fitByVehicle,
  };
};

const normalizeHandlingEstimates = (parsed) => ({
  loadingEstimate: typeof parsed?.loading_estimate === 'string' ? parsed.loading_estimate : '',
  unloadingEstimate: typeof parsed?.unloading_estimate === 'string' ? parsed.unloading_estimate : '',
});

const normalizeStep6Descriptor = (parsed) => (
  typeof parsed?.step6_description === 'string' ? parsed.step6_description.trim() : ''
);

export const requestVehicleRecommendation = async (input) => {
  const parsed = await callGeminiJson({
    prompt: VEHICLE_RECOMMENDATION_PROMPT,
    input,
    temperature: 0.2,
    scope: 'AIRecommendation',
  });

  return normalizeVehicleFitRecommendation(parsed);
};

export const requestHandlingEstimate = async (input) => {
  const parsed = await callGeminiJson({
    prompt: HANDLING_TIME_PROMPT,
    input,
    temperature: 0.2,
    scope: 'AIRecommendation',
  });

  return normalizeHandlingEstimates(parsed);
};

export const requestStep6Description = async (input) => {
  const parsed = await callGeminiJson({
    prompt: STEP6_DESCRIPTION_PROMPT,
    input,
    temperature: 0.2,
    scope: 'AIRecommendation',
  });

  return normalizeStep6Descriptor(parsed);
};
