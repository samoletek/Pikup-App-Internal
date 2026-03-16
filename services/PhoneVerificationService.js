import {
    invokeSendPhoneOtp,
    invokeVerifyPhoneOtp,
    updateProfileByTableAndUserId,
} from './repositories/authRepository';
import { normalizeError } from './errorService';
import { failureResult, successResult } from './contracts/result';

const getEdgeFunctionErrorMessage = async (error) => {
    if (!error) return 'Request failed';

    // Supabase Functions HTTP errors include a Response-like context with the real payload.
    const context = error.context;
    if (context && typeof context.json === 'function') {
        try {
            const payload = await context.json();
            if (payload?.error) return payload.error;
            if (payload?.message) return payload.message;
        } catch (contextParseError) {
            const normalized = normalizeError(contextParseError, '');
            if (normalized.message) {
                return normalized.message;
            }
        }
    }

    return error.message || 'Request failed';
};

/**
 * Send OTP to phone number via Twilio (through Edge Function)
 * @param {string} phone - Full phone number with country code (e.g., "+12125551234")
 * @param {Object} options
 * @param {string} [options.userId] - Current user ID (for ownership checks)
 * @param {'drivers'|'customers'} [options.userTable] - Current user table (for ownership checks)
 */
export const sendPhoneOtp = async (phone, options = {}) => {
    if (!phone || !phone.startsWith('+')) {
        return failureResult('Valid phone number with country code is required');
    }

    try {
        const { data, error } = await invokeSendPhoneOtp({
            phone,
            userId: options.userId || null,
            userTable: options.userTable || null,
        });

        if (error) {
            return failureResult(await getEdgeFunctionErrorMessage(error));
        }
        if (data?.error) {
            return failureResult(data.error);
        }

        return successResult();
    } catch (error) {
        const normalized = normalizeError(error, 'Failed to send verification code');
        return failureResult(normalized.message, normalized.code || null);
    }
};

/**
 * Verify OTP code for phone number
 * @param {string} phone - Full phone number with country code
 * @param {string} code - 6-digit OTP code
 */
export const verifyPhoneOtp = async (phone, code) => {
    if (!phone || !code) {
        return failureResult('Phone number and code are required');
    }

    try {
        const { data, error } = await invokeVerifyPhoneOtp({ phone, code });

        if (error) {
            return failureResult(await getEdgeFunctionErrorMessage(error));
        }
        if (data?.error) {
            return failureResult(data.error);
        }

        return successResult({ verified: data?.verified === true });
    } catch (error) {
        const normalized = normalizeError(error, 'Failed to verify code');
        return failureResult(normalized.message, normalized.code || null);
    }
};

export const saveVerifiedPhoneNumber = async ({ userTable, userId, phone }) => {
    if (!userTable || !userId) {
        return failureResult('Could not link verification to your profile. Please sign in again.');
    }

    try {
        const { error: updateError } = await updateProfileByTableAndUserId(userTable, userId, {
            phone_number: phone,
            phone_verified: true,
        });

        if (updateError) {
            return failureResult(updateError.message || 'Failed to save verified phone number');
        }

        return successResult();
    } catch (error) {
        const normalized = normalizeError(error, 'Failed to save verified phone number');
        return failureResult(normalized.message, normalized.code || null);
    }
};

/**
 * Format phone number for display: (XXX) XXX-XXXX
 */
export const formatPhoneForDisplay = (value) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const len = phoneNumber.length;
    if (len < 4) return phoneNumber;
    if (len < 7) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

/**
 * Validate phone number (minimum 10 digits for US)
 */
export const validatePhoneNumber = (phone) => {
    const digits = phone.replace(/[^\d]/g, '');
    return digits.length >= 10;
};
