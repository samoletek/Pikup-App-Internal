import { logger } from '../logger';
import { normalizeError } from '../errorService';
import {
  getDriverProfileRow,
  isNoRowsError,
} from './common';
import {
  getAuthenticatedUser,
  updateDriverRowById,
  upsertDriverRowWithSelect,
} from '../repositories/paymentRepository';

/**
 * Update driver payment profile metadata.
 */
export const updateDriverPaymentProfile = async (driverId, updates = {}) => {
  try {
    if (!driverId) {
      throw new Error('Driver ID is required');
    }

    const now = new Date().toISOString();
    const profile = await getDriverProfileRow(driverId);
    const currentMeta = profile?.metadata || {};

    const newMeta = { ...currentMeta, ...updates, updatedAt: now };
    const columnUpdates = {
      metadata: newMeta,
      updated_at: now,
    };

    if (Object.prototype.hasOwnProperty.call(updates, 'onboardingComplete')) {
      columnUpdates.onboarding_complete = Boolean(updates.onboardingComplete);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'canReceivePayments')) {
      columnUpdates.can_receive_payments = Boolean(updates.canReceivePayments);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'connectAccountId')) {
      columnUpdates.stripe_account_id = updates.connectAccountId || null;
    }

    const { data, error } = await updateDriverRowById(driverId, columnUpdates, true);

    if (error && !isNoRowsError(error)) throw error;
    if (data) return data;

    if (profile) {
      return {
        ...profile,
        ...columnUpdates,
        id: driverId,
        metadata: newMeta,
      };
    }

    const { data: authData } = await getAuthenticatedUser();
    const fallbackEmail = profile?.email || authData?.user?.email || null;
    const upsertPayload = {
      id: driverId,
      ...columnUpdates,
    };

    if (fallbackEmail) {
      upsertPayload.email = fallbackEmail;
    }

    const { data: upsertedData, error: upsertError } = await upsertDriverRowWithSelect(upsertPayload);

    if (upsertError) throw upsertError;
    return upsertedData || upsertPayload;
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to update driver payment profile');
    logger.error('PaymentService', 'updateDriverPaymentProfile failed', normalized, error);
    throw new Error(normalized.message);
  }
};
