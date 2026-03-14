// services/TermsService.js
// Extracted from AuthContext.js - Legal document and terms management

import { supabase } from '../config/supabase';

/**
 * Get current legal document versions
 * @returns {Promise<Object>} Version numbers for TOS, privacy policy, driver agreement
 */
export const getLegalConfig = async () => {
    return {
        tosVersion: '1.0',
        privacyVersion: '1.0',
        driverAgreementVersion: '1.0'
    };
};

/**
 * Check if user has accepted current terms versions
 * @param {string} uid - User ID to check
 * @returns {Promise<Object>} Acceptance status and missing versions
 */
export const checkTermsAcceptance = async (uid) => {
    try {
        // 1. Get current config (with timeout)
        const configTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('getLegalConfig timeout')), 1000)
        );

        let currentVersions;
        try {
            currentVersions = await Promise.race([getLegalConfig(), configTimeout]);
        } catch (_err) {
            console.warn('⚠️ getLegalConfig timed out, using defaults');
            currentVersions = { tosVersion: '1.0', privacyVersion: '1.0' };
        }

        // 2. Get user metadata from Supabase (with timeout)
        const getUserTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('getUser timeout')), 1000)
        );

        let user;
        try {
            const result = await Promise.race([supabase.auth.getUser(), getUserTimeout]);
            user = result.data?.user;
        } catch (_err) {
            console.warn('⚠️ getUser timed out - skipping terms check for now');
            return { needsAcceptance: false };
        }

        if (!user || (uid && user.id !== uid)) {
            console.warn('Cannot check terms for different user or no user');
            return { needsAcceptance: false };
        }

        const userTerms = user.user_metadata?.termsAgreement;

        if (!userTerms) {
            return {
                needsAcceptance: true,
                missingVersions: ['tosVersion', 'privacyVersion'],
                reason: 'No terms record found'
            };
        }

        // Check version mismatches
        const missingVersions = [];

        if (userTerms.tosVersion !== currentVersions.tosVersion) {
            missingVersions.push('tosVersion');
        }

        if (userTerms.privacyVersion !== currentVersions.privacyVersion) {
            missingVersions.push('privacyVersion');
        }

        // Check driver agreement if user is a driver
        const userType = user.user_metadata?.user_type || 'customer';

        if (userType === 'driver' && currentVersions.driverAgreementVersion) {
            if (userTerms.driverAgreementVersion !== currentVersions.driverAgreementVersion) {
                missingVersions.push('driverAgreementVersion');
            }
        }

        return {
            needsAcceptance: missingVersions.length > 0,
            missingVersions,
            currentVersions,
            userVersions: {
                tosVersion: userTerms.tosVersion,
                privacyVersion: userTerms.privacyVersion,
                driverAgreementVersion: userTerms.driverAgreementVersion
            },
            reason: missingVersions.length > 0 ? 'Version mismatch' : 'All versions current'
        };
    } catch (error) {
        console.error('Error checking terms acceptance:', error);
        return { needsAcceptance: false };
    }
};

/**
 * Accept current terms versions for user
 * @param {string} uid - User ID (currently unused, uses session)
 * @param {boolean} acceptedDuringSignup - Whether accepted during signup flow
 * @param {string} tokenOverride - Optional token override (currently unused)
 */
export const acceptTerms = async (uid, acceptedDuringSignup = false, tokenOverride) => {
    try {
        const currentVersions = await getLegalConfig();

        const { error } = await supabase.auth.updateUser({
            data: {
                termsAgreement: {
                    accepted: true,
                    acceptedAt: new Date().toISOString(),
                    tosVersion: currentVersions.tosVersion,
                    privacyVersion: currentVersions.privacyVersion,
                    driverAgreementVersion: currentVersions.driverAgreementVersion,
                    acceptedDuringSignup
                }
            }
        });

        if (error) throw error;
        console.log('Terms accepted and saved to Supabase metadata');

    } catch (error) {
        console.error('Failed to accept terms:', error);
        throw error;
    }
};

/**
 * Get full terms status for a user
 * @param {string} uid - User ID to check
 * @param {Object} currentUser - Current user object (passed from context)
 * @returns {Promise<Object>} Full terms status
 */
export const getTermsStatus = async (uid, currentUser = null) => {
    const effectiveUid = uid || currentUser?.uid;
    if (!effectiveUid) throw new Error('User not authenticated');

    try {
        const termsData = await checkTermsAcceptance(effectiveUid);

        return {
            hasAccepted: termsData.accepted || false,
            version: termsData.version || null,
            acceptedAt: termsData.acceptedAt || null,
            acceptedDuringSignup: termsData.acceptedDuringSignup || false,
            needsUpdate: termsData.version !== "1.0"
        };
    } catch (error) {
        console.error('Error getting terms status:', error);
        return {
            hasAccepted: false,
            version: null,
            acceptedAt: null,
            acceptedDuringSignup: false,
            needsUpdate: true
        };
    }
};
