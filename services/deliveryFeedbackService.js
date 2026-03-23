import { logger } from './logger';
import { invokeSubmitFeedback } from './repositories/feedbackRepository';

export const submitDeliveryFeedback = async ({
  requestId,
  rating,
  tip,
  driverId,
  badges = [],
  comment = null,
}) => {
  const { error } = await invokeSubmitFeedback({
    requestId,
    rating,
    tip,
    driverId,
    badges,
    comment,
  });

  if (error) {
    logger.warn('DeliveryFeedbackService', 'submit-feedback edge function returned error', error);
    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    error: null,
  };
};
