import { normalizeError } from "./errorService";
import { logger } from "./logger";

export type FlowContext = {
  flow: string;
  correlationId: string;
} & Record<string, unknown>;

const randomToken = () => Math.random().toString(36).slice(2, 8);

export const createCorrelationId = (flow = "flow"): string => {
  return `${flow}_${Date.now().toString(36)}_${randomToken()}`;
};

export const startFlowContext = (
  flow: string,
  extras: Record<string, unknown> = {}
): FlowContext => {
  return {
    flow,
    correlationId: createCorrelationId(flow),
    ...extras,
  };
};

export const normalizeErrorPayload = (
  error: unknown,
  fallbackMessage = "Unexpected error"
): { message: string; code: string | null } => {
  const normalized = normalizeError(error, fallbackMessage);
  return {
    message: normalized.message,
    code: normalized.code || null,
  };
};

export const logFlowInfo = (
  scope: string,
  message: string,
  flowContext: Record<string, unknown> = {}
) => {
  logger.info(scope, message, flowContext);
};

export const logFlowError = (
  scope: string,
  message: string,
  error: unknown,
  flowContext: Record<string, unknown> = {},
  fallbackMessage = "Unexpected error"
) => {
  const payload = normalizeErrorPayload(error, fallbackMessage);
  logger.error(scope, message, {
    ...flowContext,
    error: payload,
  });
  return payload;
};
