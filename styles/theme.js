/**
 * PikUp App Design System
 * 
 * This file contains all design tokens for consistent UI across the app.
 * Import this file instead of hardcoding values in components.
 */

// ============================================
// COLORS
// ============================================
export const colors = {
    // Primary brand colors
    primary: '#A77BFF',       // Main purple
    primaryLight: '#A77BFF20', // Purple with opacity
    primaryDark: '#7B5BFF',   // Darker purple for gradients

    // Secondary accent
    secondary: '#FF7B7B',     // Red/coral for dropoff, alerts
    secondaryLight: '#FF7B7B33',

    // Success/positive
    success: '#00D4AA',       // Green for checkmarks, success states
    successLight: '#00D4AA20',

    // Warning/caution  
    warning: '#FFB800',       // Yellow/orange for warnings
    warningLight: '#FFB80020',

    // Error/danger
    error: '#FF4444',         // Red for errors, delete
    errorLight: '#FF444420',

    // Backgrounds (dark theme)
    background: {
        primary: '#0A0A1F',     // Darkest - main app background
        secondary: '#141426',   // Modal backgrounds
        tertiary: '#1E1E2E',    // Cards, elevated surfaces
        panel: '#1E1E38',       // Alternative panel/card surface
        elevated: '#1A1A3A',    // Elevated cards/chips
        successSubtle: '#1A3A2E', // Success tinted background
        warningSubtle: '#3A2A1A', // Warning tinted background
        brandTint: '#2A1F3D',   // Primary-tinted dark surface
        input: '#222233',       // Input fields
    },

    // Borders
    border: {
        default: '#333',        // Default border
        light: '#444',          // Lighter border
        strong: '#2A2A3B',      // Strong contrast border on dark surfaces
        focus: '#A77BFF',       // Focused state
    },

    // Text
    text: {
        primary: '#FFFFFF',     // Main text
        secondary: '#CCCCCC',   // Secondary text
        muted: '#888888',       // Muted/disabled text
        tertiary: '#999999',    // Tertiary labels
        subtle: '#666666',      // Subtle text for empty states
        placeholder: '#666666', // Input placeholders
        link: '#A77BFF',        // Links and actionable text
    },

    // Misc
    white: '#FFFFFF',
    black: '#000000',
    info: '#4A90E2',
    gold: '#FFD700',
    overlayDark: 'rgba(0, 0, 0, 0.8)',
    overlayPrimarySoft: 'rgba(167, 123, 255, 0.1)',
    transparent: 'transparent',

    // Navigation surfaces
    navigation: {
        tabBarBackground: 'rgba(20, 20, 38, 0.78)',
        tabBarBorder: 'rgba(255, 255, 255, 0.08)',
        tabBarInactive: '#8E8E93',
    },
};

// ============================================
// TYPOGRAPHY
// ============================================
export const typography = {
    // Font families (system fonts for now, can be customized)
    fontFamily: {
        regular: undefined, // Uses system default
        medium: undefined,
        bold: undefined,
    },

    // Font sizes
    fontSize: {
        xs: 10,      // Tags, badges
        sm: 12,      // Captions, labels
        base: 14,    // Body text
        md: 16,      // Default input, buttons
        lg: 18,      // Titles, button text
        xl: 20,      // Section headers
        xxl: 24,     // Large numbers, prices
        xxxl: 32,    // Hero text
    },

    // Font weights
    fontWeight: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
    },

    // Line heights
    lineHeight: {
        tight: 1.2,
        normal: 1.5,
        relaxed: 1.75,
    },
};

// ============================================
// SPACING
// ============================================
export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 48,
};

// ============================================
// BORDER RADIUS
// ============================================
export const borderRadius = {
    none: 0,
    xs: 4,       // Tags, small badges
    sm: 8,       // Small cards, chips
    md: 12,      // Cards, inputs, modals corners
    lg: 16,      // Large cards
    xl: 20,      // Rounded panels
    full: 28,    // Fully rounded buttons (pill shape)
    circle: 999, // Perfect circles (use half of size)
};

// ============================================
// SHADOWS
// ============================================
export const shadows = {
    none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    primary: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
};

// ============================================
// COMMON COMPONENT STYLES
// ============================================
export const components = {
    // Primary button (Continue, Confirm, etc.)
    buttonPrimary: {
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.xl,
    },

    // Secondary/outline button
    buttonSecondary: {
        backgroundColor: 'transparent',
        height: 56,
        borderRadius: borderRadius.full,
        borderWidth: 2,
        borderColor: colors.primary,
        paddingHorizontal: spacing.xl,
    },

    // Text input
    input: {
        backgroundColor: colors.background.input,
        height: 56,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border.default,
        paddingHorizontal: spacing.base,
    },

    // Card container
    card: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        borderWidth: 1,
        borderColor: colors.border.default,
    },

    // Modal container
    modal: {
        backgroundColor: colors.background.secondary,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
    },

    // Badge/tag
    badge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.xs,
    },
};

// ============================================
// ANIMATION DURATIONS
// ============================================
export const animation = {
    fast: 150,
    normal: 300,
    slow: 500,
};

// ============================================
// Z-INDEX LAYERS
// ============================================
export const zIndex = {
    base: 1,
    dropdown: 100,
    modal: 998,
    overlay: 999,
    toast: 1000,
};

// Default export for convenience
export default {
    colors,
    typography,
    spacing,
    borderRadius,
    shadows,
    components,
    animation,
    zIndex,
};
