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
import {
  buildDriverPreferenceColumnUpdates,
  mergeDriverPreferences,
} from '../driverPreferencesColumns';

const SENSITIVE_PAYMENT_FIELDS = new Set([
  'onboardingComplete',
  'canReceivePayments',
  'connectAccountId',
  'onboardingStatus',
  'onboardingRequirements',
  'onboardingRequirementsByBucket',
  'onboardingDisabledReason',
  'transfersCapability',
  'payoutsEnabled',
  'detailsSubmitted',
]);

const isPermissionPolicyError = (error) => {
  if (!error) {
    return false;
  }

  const normalizedCode = String(error?.code || '').trim().toUpperCase();
  if (normalizedCode === '42501') {
    return true;
  }

  const normalizedText = String(error?.message || error?.details || '')
    .trim()
    .toLowerCase();
  return (
    normalizedText.includes('row-level security policy') ||
    normalizedText.includes('permission denied')
  );
};

/**
 * Update driver payment profile metadata.
 */
export const updateDriverPaymentProfile = async (driverId, updates = {}, options = {}) => {
  try {
    if (!driverId) {
      throw new Error('Driver ID is required');
    }

    const now = new Date().toISOString();
    const profile = await getDriverProfileRow(driverId);
    const currentMeta = profile?.metadata || {};

    const providedUpdates = updates && typeof updates === 'object' ? updates : {};
    const allowSensitivePaymentFields = Boolean(options?.allowSensitivePaymentFields);

    const safeUpdates = {};
    const ignoredSensitiveFields = [];
    Object.entries(providedUpdates).forEach(([key, value]) => {
      if (!allowSensitivePaymentFields && SENSITIVE_PAYMENT_FIELDS.has(key)) {
        ignoredSensitiveFields.push(key);
        return;
      }

      safeUpdates[key] = value;
    });

    if (ignoredSensitiveFields.length > 0) {
      logger.warn(
        'PaymentService',
        'Ignoring sensitive payment profile fields from client update',
        {
          driverId,
          fields: ignoredSensitiveFields,
        },
      );
    }

    const hasDriverPreferencesUpdate = (
      Object.prototype.hasOwnProperty.call(safeUpdates, 'driverPreferences') &&
      safeUpdates.driverPreferences &&
      typeof safeUpdates.driverPreferences === 'object'
    );
    const nextDriverPreferences = hasDriverPreferencesUpdate
      ? mergeDriverPreferences(safeUpdates.driverPreferences)
      : null;
    const otherUpdates = { ...safeUpdates };
    delete otherUpdates.driverPreferences;

    const newMeta = { ...currentMeta, ...otherUpdates, updatedAt: now };
    if (nextDriverPreferences) {
      newMeta.driverPreferences = {
        ...nextDriverPreferences,
        updatedAt: now,
      };
    }

    const columnUpdates = {
      metadata: newMeta,
      updated_at: now,
    };

    if (nextDriverPreferences) {
      Object.assign(
        columnUpdates,
        buildDriverPreferenceColumnUpdates(nextDriverPreferences)
      );
    }

    if (allowSensitivePaymentFields && Object.prototype.hasOwnProperty.call(safeUpdates, 'onboardingComplete')) {
      columnUpdates.onboarding_complete = Boolean(safeUpdates.onboardingComplete);
    }

    if (allowSensitivePaymentFields && Object.prototype.hasOwnProperty.call(safeUpdates, 'canReceivePayments')) {
      columnUpdates.can_receive_payments = Boolean(safeUpdates.canReceivePayments);
    }

    if (allowSensitivePaymentFields && Object.prototype.hasOwnProperty.call(safeUpdates, 'connectAccountId')) {
      columnUpdates.stripe_account_id = safeUpdates.connectAccountId || null;
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

    if (upsertError) {
      if (isPermissionPolicyError(upsertError)) {
        logger.warn('PaymentService', 'Skipping driver profile upsert due RLS policy', {
          driverId,
          code: upsertError?.code || null,
          message: upsertError?.message || null,
        });
        return upsertPayload;
      }
      throw upsertError;
    }
    return upsertedData || upsertPayload;
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to update driver payment profile');
    if (isPermissionPolicyError(normalized) || isPermissionPolicyError(error)) {
      logger.warn('PaymentService', 'updateDriverPaymentProfile blocked by RLS policy', normalized);
    } else {
      logger.error('PaymentService', 'updateDriverPaymentProfile failed', normalized, error);
    }
    throw new Error(normalized.message);
  }
};
