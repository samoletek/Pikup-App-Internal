import { Platform } from 'react-native';

export const getAuthModalTitle = (step, selectedRole) => {
    switch (step) {
        case 'initial':
            return `${selectedRole === 'driver' ? 'Driver' : 'Customer'} Login`;
        case 'email_check':
            return 'What\'s your email?';
        case 'password':
            return 'Welcome Back';
        case 'register':
            return 'Create Account';
        case 'phone_input':
            return 'Verify Phone Number';
        case 'phone_verify':
            return 'Enter Code';
        default:
            return '';
    }
};

export const getAuthModalHeight = (step, screenHeight) => {
    if (step === 'register') {
        return Platform.OS === 'ios' ? screenHeight * 0.55 : screenHeight * 0.60;
    }
    if (step === 'email_check') {
        return Platform.OS === 'ios' ? screenHeight * 0.30 : screenHeight * 0.35;
    }
    if (step === 'password') {
        return Platform.OS === 'ios' ? screenHeight * 0.40 : screenHeight * 0.45;
    }
    if (step === 'phone_input') {
        return Platform.OS === 'ios' ? screenHeight * 0.45 : screenHeight * 0.50;
    }
    if (step === 'phone_verify') {
        return Platform.OS === 'ios' ? screenHeight * 0.45 : screenHeight * 0.50;
    }

    return Platform.OS === 'ios' ? screenHeight * 0.35 : screenHeight * 0.40;
};
