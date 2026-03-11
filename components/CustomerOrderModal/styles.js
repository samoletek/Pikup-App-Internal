import { StyleSheet, Dimensions } from 'react-native';
import { colors, borderRadius, spacing, typography, layout } from '../../styles/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DATE_PICKER_MODAL_WIDTH = Math.min(SCREEN_WIDTH - (spacing.xl * 2), layout.authMaxWidth);
const AI_ACTION_ICON_SIZE = spacing.xxxl - spacing.xs;
const SUBTLE_GAP = spacing.xs / 2;

export { SCREEN_WIDTH, SCREEN_HEIGHT };

export const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.base,
        height: 56
    },
    headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text.primary },
    headerStep: { fontSize: typography.fontSize.sm, color: colors.text.muted, marginTop: 2 },
    progressBar: { height: 3, backgroundColor: colors.border.default, marginHorizontal: spacing.lg },
    progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: borderRadius.xs },
    stepContainer: { flex: 1 },
    stepContent: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
    footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.base, borderTopWidth: 1, borderTopColor: colors.background.input },
    continueBtn: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        borderRadius: borderRadius.full
    },
    continueBtnText: { color: colors.white, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, marginRight: spacing.sm },
    continueBtnDisabled: { opacity: 0.7 },
    continueBtnTextDisabled: { color: colors.white },

    // Step 1 Styles - Address Search
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.input,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border.default,
        height: 56,
        paddingHorizontal: spacing.base
    },
    input: { flex: 1, color: colors.text.primary, marginLeft: spacing.md, fontSize: typography.fontSize.md, height: '100%' },
    addressMarker: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center'
    },
    pickupMarker: { backgroundColor: colors.primary },
    dropoffMarker: { backgroundColor: colors.success },
    addressMarkerText: { color: colors.white, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold },
    suggestionsContainer: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
        maxHeight: 350,
        zIndex: 100,
        overflow: 'hidden'
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.base
    },
    suggestionIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md
    },
    suggestionTitle: { color: colors.text.primary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, marginBottom: 2 },
    suggestionAddr: { color: colors.text.secondary, fontSize: typography.fontSize.sm },
    sectionLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xs,
        marginTop: spacing.xs
    },
    sectionLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border.default,
        marginHorizontal: spacing.md
    },
    sectionLabelText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: spacing.sm
    },
    loadingRow: {
        paddingVertical: spacing.sm,
        alignItems: 'center'
    },
    currentLocBtn: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, padding: spacing.md },
    currentLocText: { color: colors.text.link, fontWeight: typography.fontWeight.semibold, marginLeft: spacing.md, fontSize: typography.fontSize.md },

    // Schedule Styles
    scheduleSection: { marginTop: spacing.xl },
    sectionLabel: { color: colors.text.primary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md },
    scheduleToggle: { flexDirection: 'row', backgroundColor: colors.background.input, borderRadius: borderRadius.full, padding: spacing.xs },
    scheduleOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        borderRadius: borderRadius.xl
    },
    scheduleOptionActive: { backgroundColor: colors.primary },
    scheduleOptionText: { color: colors.text.muted, fontWeight: typography.fontWeight.semibold, marginLeft: spacing.sm },
    scheduleOptionTextActive: { color: colors.white },
    scheduleDisclaimer: {
        marginBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
    },
    scheduleDisclaimerIcon: {
        marginRight: spacing.sm,
    },
    scheduleDisclaimerText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
    },
    dateTimeSection: { marginTop: spacing.md },
    datePickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.input,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border.default
    },
    datePickerBtnFirst: {
        marginTop: 0,
    },
    datePickerText: { color: colors.text.primary, marginLeft: spacing.md, fontSize: typography.fontSize.md, flex: 1 },
    datePickerChevron: { marginLeft: spacing.sm },
    datePickerDoneBtn: {
        alignSelf: 'center',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        marginTop: spacing.md
    },
    datePickerDoneText: { color: colors.primary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold },
    datePickerModal: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.overlayDark
    },
    datePickerModalContent: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        width: DATE_PICKER_MODAL_WIDTH,
        alignItems: 'center',
        overflow: 'hidden'
    },
    datePickerModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border
    },
    datePickerModalTitle: {
        color: colors.text.primary,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.semibold
    },
    datePickerControl: {
        width: '100%',
        backgroundColor: colors.background.secondary
    },

    // Step 2 Styles - Items
    itemsStepContentContainer: {
        paddingBottom: spacing.xxxl + spacing.xl,
    },
    itemsStickyHeader: {
        backgroundColor: colors.background.secondary,
        paddingBottom: spacing.base,
        marginBottom: spacing.sm,
    },
    aiPrimaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primaryLight,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    addItemsPill: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.base,
        marginLeft: spacing.sm,
    },
    addItemsPillText: {
        color: colors.white,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
    },
    aiPrimaryIconContainer: {
        width: AI_ACTION_ICON_SIZE,
        height: AI_ACTION_ICON_SIZE,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.base,
    },
    aiSecondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        borderWidth: 1,
        borderColor: colors.border.default,
        marginTop: spacing.sm,
    },
    aiSecondaryBtnDisabled: {
        opacity: 0.55,
    },
    aiSecondaryIconContainer: {
        width: AI_ACTION_ICON_SIZE,
        height: AI_ACTION_ICON_SIZE,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.input,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.base,
    },
    aiActionTextContainer: {
        flex: 1,
    },
    aiPrimaryTitle: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: typography.fontWeight.bold,
    },
    aiSecondaryTitle: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: typography.fontWeight.semibold,
    },
    aiActionSubtitle: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.sm,
        marginTop: SUBTLE_GAP,
    },
    aiPoweredByRow: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-end',
    },
    aiPoweredByText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        marginLeft: spacing.xs,
    },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyStateText: { color: colors.text.primary, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginTop: spacing.base },
    emptyStateSubtext: { color: colors.text.placeholder, fontSize: typography.fontSize.base, marginTop: spacing.sm },
    itemsDisclaimerBox: {
        marginTop: spacing.base,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.warning,
        backgroundColor: colors.warningLight,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    itemsDisclaimerIcon: {
        marginTop: 1,
        marginRight: spacing.sm,
    },
    itemsDisclaimerText: {
        color: colors.warning,
        fontSize: typography.fontSize.sm,
        lineHeight: 18,
        flex: 1,
    },
    itemsBottomSpacer: { height: spacing.xxxl },

    // Step 5 Styles - Vehicle Selection
    vehicleHint: { color: colors.text.muted, fontSize: typography.fontSize.base, marginBottom: spacing.base, textAlign: 'center' },
    whatFitsSection: { backgroundColor: colors.background.tertiary, borderRadius: borderRadius.lg, padding: spacing.base, marginTop: spacing.base },
    whatFitsTitle: { color: colors.text.primary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md },
    whatFitsItem: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    whatFitsText: { color: colors.text.secondary, fontSize: typography.fontSize.base, marginLeft: spacing.sm },

    // Step 6 Styles - Review
    summaryCard: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        marginBottom: spacing.base
    },
    summaryCardTitle: { color: colors.text.primary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, marginBottom: spacing.md },
    routeRow: { flexDirection: 'row', alignItems: 'center' },
    routeDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
    routeLine: { width: 2, height: 20, backgroundColor: colors.border.default, marginLeft: spacing.xs, marginVertical: spacing.xs },
    routeAddress: { color: colors.text.secondary, fontSize: typography.fontSize.base, flex: 1 },
    itemSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    itemSummaryName: { color: colors.text.primary, fontSize: typography.fontSize.base },
    itemSummaryBadges: { flexDirection: 'row' },
    fragileTag: { backgroundColor: colors.secondaryLight, color: colors.secondary, fontSize: typography.fontSize.xs, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.xs, marginLeft: 6 },
    insuredTag: { backgroundColor: colors.primaryLight, color: colors.primary, fontSize: typography.fontSize.xs, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.xs, marginLeft: 6 },
    handlingEstimateBox: {
        marginTop: spacing.sm,
        paddingTop: spacing.base,
        borderTopWidth: 1,
        borderTopColor: colors.border.default,
    },
    handlingEstimateTitle: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: typography.fontWeight.bold,
        marginBottom: spacing.sm,
    },
    handlingEstimateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    handlingEstimateLabel: {
        color: colors.text.muted,
        fontSize: typography.fontSize.base,
    },
    handlingEstimateValue: {
        color: colors.text.primary,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
    },
    handlingEstimateHint: {
        marginTop: spacing.xs,
        color: colors.text.placeholder,
        fontSize: typography.fontSize.xs,
    },
    vehicleSummary: { flexDirection: 'row', alignItems: 'center' },
    vehicleSummaryImg: { width: 60, height: 35, resizeMode: 'contain', marginRight: spacing.md },
    vehicleSummaryName: { color: colors.text.primary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold },
    paymentSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    paymentSummaryLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    paymentSummaryCopy: { marginLeft: spacing.md, flex: 1 },
    paymentSummaryTitle: { color: colors.text.primary, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold },
    paymentSummarySubtitle: { color: colors.text.muted, fontSize: typography.fontSize.sm, marginTop: 2 },
    noCardsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.input,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing.base,
        marginBottom: spacing.sm,
    },
    addPaymentCardButton: {
        marginTop: spacing.sm,
        height: 46,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addPaymentCardButtonText: {
        marginLeft: spacing.xs,
        color: colors.white,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
    },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    priceLabel: { color: colors.text.muted, fontSize: typography.fontSize.base },
    priceValue: { color: colors.text.primary, fontSize: typography.fontSize.base },
    priceDivider: { height: 1, backgroundColor: colors.border.default, marginVertical: spacing.md },
    totalLabel: { color: colors.text.primary, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold },
    totalValue: { color: colors.primary, fontSize: typography.fontSize.xxl, fontWeight: typography.fontWeight.bold },

    paymentMethodRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing.base,
        marginBottom: spacing.sm,
    },
    paymentMethodRowSelected: {
        borderColor: colors.success,
        backgroundColor: colors.successLight,
    },
    paymentMethodRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    paymentMethodCopy: {
        marginLeft: spacing.md,
        flex: 1,
    },
    paymentMethodTitle: {
        color: colors.text.primary,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
    },
    paymentMethodSubtitle: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        marginTop: 2,
    },
    paymentMethodBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    defaultMethodBadge: {
        color: colors.primary,
        backgroundColor: colors.primaryLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
    },
});

const THUMB_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 2) / 3;

export const aiPhotoStyles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background.secondary },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.base, height: 56,
    },
    headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text.primary },
    photoArea: { flex: 1, backgroundColor: colors.background.primary },
    photoAreaContent: { padding: spacing.lg },
    photoAreaEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 300 },
    placeholder: { alignItems: 'center', paddingVertical: spacing.xxxl },
    placeholderTitle: { color: colors.text.primary, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginTop: spacing.base },
    placeholderSubtitle: { color: colors.text.muted, fontSize: typography.fontSize.base, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.xl, lineHeight: typography.fontSize.base * 1.5 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    thumbWrapper: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: borderRadius.md, overflow: 'visible' },
    thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: borderRadius.md, backgroundColor: colors.background.tertiary },
    thumbDelete: { position: 'absolute', top: -8, right: -8, backgroundColor: colors.background.secondary, borderRadius: borderRadius.circle },
    footer: {
        paddingHorizontal: spacing.lg, paddingTop: spacing.base, paddingBottom: spacing.xl,
        borderTopWidth: 1, borderTopColor: colors.border.default, backgroundColor: colors.background.secondary,
    },
    photoCount: { color: colors.text.muted, fontSize: typography.fontSize.sm, textAlign: 'center', marginBottom: spacing.base },
    footerButtons: { flexDirection: 'row', gap: spacing.sm },
    addPhotoBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        height: 52, borderRadius: borderRadius.full, borderWidth: 2,
        borderColor: colors.primary, backgroundColor: colors.background.tertiary, gap: spacing.sm,
    },
    addPhotoBtnText: { color: colors.primary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold },
    identifyBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        height: 52, borderRadius: borderRadius.full, backgroundColor: colors.primary, gap: spacing.sm,
    },
    identifyBtnDisabled: { opacity: 0.4 },
    identifyBtnText: { color: colors.white, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold },
    poweredByRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: spacing.sm, gap: spacing.xs },
    poweredByText: { color: colors.text.muted, fontSize: typography.fontSize.xs },
});
