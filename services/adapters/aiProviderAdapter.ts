import { callGeminiImageBatchJson } from '../ai/aiGeminiClient';
import {
  requestHandlingEstimate,
  requestStep6Description,
  requestVehicleRecommendation,
} from '../ai/aiRecommendationService';

type AnalyzeImageBatchParams = {
  textPrompt: string;
  base64Images: string[];
  scope?: string;
  errorMessage?: string;
};

type RecommendationInput = Record<string, unknown>;

export type AIProviderAdapter = {
  analyzeImageBatchJson: (params: AnalyzeImageBatchParams) => Promise<unknown>;
  requestVehicleRecommendation: (input: RecommendationInput) => Promise<any>;
  requestHandlingEstimate: (input: RecommendationInput) => Promise<any>;
  requestStep6Description: (input: RecommendationInput) => Promise<any>;
};

const defaultAIProviderAdapter: AIProviderAdapter = {
  analyzeImageBatchJson: (params) => callGeminiImageBatchJson(params),
  requestVehicleRecommendation: (input) => requestVehicleRecommendation(input),
  requestHandlingEstimate: (input) => requestHandlingEstimate(input),
  requestStep6Description: (input) => requestStep6Description(input),
};

let activeAIProviderAdapter: AIProviderAdapter = defaultAIProviderAdapter;

export const getAIProviderAdapter = (): AIProviderAdapter => activeAIProviderAdapter;

export const setAIProviderAdapter = (nextAdapter: AIProviderAdapter) => {
  activeAIProviderAdapter = nextAdapter || defaultAIProviderAdapter;
};

export const resetAIProviderAdapter = () => {
  activeAIProviderAdapter = defaultAIProviderAdapter;
};
