import { logger } from './logger';
import { normalizeError } from './errorService';
import { GEMINI_API_KEY, IMAGE_ANALYSIS_PROMPT } from './ai/aiConstants';
import {
  getAIProviderAdapter,
  resetAIProviderAdapter,
  setAIProviderAdapter,
} from './adapters/aiProviderAdapter';

const normalizeVehiclePayload = (vehicles = []) => (
  vehicles.map((vehicle) => ({
    id: vehicle.id,
    type: vehicle.type,
    capacity: vehicle.capacity || null,
    maxWeight: vehicle.maxWeight || null,
    itemGuidance: vehicle.items || null,
  }))
);

const normalizeItemPayload = (items = []) => (
  items.map((item) => ({
    name: item.name || '',
    description: item.description || '',
    condition: item.condition || 'used',
    fragile: !!item.isFragile,
    insured: !!item.hasInsurance,
    estimatedWeightLbs: Number(item.weightEstimate) || 0,
  }))
);

export const analyzeImages = async (base64Images) => {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY');
  }

  try {
    const aiProvider = getAIProviderAdapter();
    return await aiProvider.analyzeImageBatchJson({
      textPrompt: IMAGE_ANALYSIS_PROMPT,
      base64Images,
      scope: 'AIImageAnalysis',
      errorMessage: 'Failed to analyze images',
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to analyze images');
    logger.error('AIImageAnalysis', 'Image analysis failed', normalized, error);
    throw new Error(normalized.message);
  }
};

export const recommendVehicleForItems = async ({ itemSummary, items = [], vehicles = [] }) => {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY');
  }

  const aiProvider = getAIProviderAdapter();
  const baseInput = {
    summary: itemSummary || '',
    vehicles: normalizeVehiclePayload(vehicles),
    items: normalizeItemPayload(items),
  };

  const fitRecommendation = await aiProvider.requestVehicleRecommendation(baseInput);
  const followUpInput = {
    ...baseInput,
    recommended_vehicle_id: fitRecommendation.recommendedVehicleId,
    fit_by_vehicle: fitRecommendation.fitByVehicle,
  };

  const [handlingResult, descriptorResult] = await Promise.allSettled([
    aiProvider.requestHandlingEstimate(followUpInput),
    aiProvider.requestStep6Description(followUpInput),
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
    notes: step6Description,
  };
};

export {
  resetAIProviderAdapter,
  setAIProviderAdapter,
};
