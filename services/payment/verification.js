import { logger } from '../logger';
import { normalizeError } from '../errorService';
import {
  invokeCreateVerificationSession,
  invokeGetVerificationData,
  updateDriverRowById,
} from '../repositories/paymentRepository';

/**
 * Create Stripe Identity verification session.
 */
export const createVerificationSession = async (userData, currentUser) => {
  try {
    const { data, error } = await invokeCreateVerificationSession({
      userId: currentUser.uid || currentUser.id,
      email: currentUser.email,
      ...userData,
    }, currentUser?.accessToken || null);

    if (error) {
      throw new Error(error.message || 'Verification session creation failed');
    }

    return data;
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to create verification session');
    logger.error('PaymentService', 'createVerificationSession failed', normalized, error);
    throw new Error(normalized.message);
  }
};

export const getVerificationData = async (sessionId, currentUser = null) => {
  const { data, error } = await invokeGetVerificationData(
    { sessionId },
    currentUser?.accessToken || null
  );

  if (error) {
    throw error;
  }

  return data;
};

export const markDriverIdentityVerified = async ({ currentUser, verificationSessionId }) => {
  const driverId = currentUser?.uid || currentUser?.id;
  if (!driverId || !verificationSessionId) {
    return;
  }

  const { error } = await updateDriverRowById(driverId, {
    identity_verified: true,
    verification_session_id: verificationSessionId,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
};
