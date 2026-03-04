import { supabase } from '../config/supabase';

const getEdgeFunctionErrorMessage = async (error) => {
    if (!error) return 'Request failed';

    // Supabase Functions HTTP errors include a Response-like context with the real payload.
    const context = error.context;
    if (context && typeof context.json === 'function') {
        try {
            const payload = await context.json();
            if (payload?.error) return payload.error;
            if (payload?.message) return payload.message;
        } catch (_) {
            // fall back to generic message below
        }
    }

    return error.message || 'Request failed';
};

/**
 * Send OTP to phone number via Twilio (through Edge Function)
 * @param {string} phone - Full phone number with country code (e.g., "+12125551234")
 */
export const sendPhoneOtp = async (phone) => {
    if (!phone || !phone.startsWith('+')) {
        throw new Error('Valid phone number with country code is required');
    }

    const { data, error } = await supabase.functions.invoke('send-phone-otp', {
        body: { phone }
    });

    if (error) {
        throw new Error(await getEdgeFunctionErrorMessage(error));
    }
    if (data?.error) throw new Error(data.error);

    return { success: true };
};

/**
 * Verify OTP code for phone number
 * @param {string} phone - Full phone number with country code
 * @param {string} code - 6-digit OTP code
 */
export const verifyPhoneOtp = async (phone, code) => {
    if (!phone || !code) {
        throw new Error('Phone number and code are required');
    }

    const { data, error } = await supabase.functions.invoke('verify-phone-otp', {
        body: { phone, code }
    });

    if (error) {
        throw new Error(await getEdgeFunctionErrorMessage(error));
    }
    if (data?.error) throw new Error(data.error);

    return { success: true, verified: data?.verified === true };
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
