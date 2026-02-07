import { StyleSheet, Dimensions } from 'react-native';
import { colors } from '../../styles/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export { SCREEN_WIDTH, SCREEN_HEIGHT };

export const styles = StyleSheet.create({
    // Backdrop
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.black,
        zIndex: 999,
    },

    // Main Container
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    gradient: {
        flex: 1,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },

    // Swipeable Handle Area
    handleArea: {
        paddingTop: 10,
        paddingBottom: 6,
        alignItems: 'center',
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 2,
    },

    // ============================================
    // COLLAPSED STATE - Peek View
    // ============================================
    collapsedContainer: {
        flex: 1,
        paddingBottom: 90, // Space for Go Online button
    },
    peekContent: {
        paddingHorizontal: 20,
    },
    peekHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    peekLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    peekTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
    },
    peekProgress: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
    },
    progressBarSmall: {
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 12,
    },
    progressFillSmall: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 4,
    },
    peekFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    peekSubtitle: {
        fontSize: 13,
        color: colors.text.tertiary,
        flex: 1,
    },
    expandHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    expandHintText: {
        fontSize: 12,
        color: colors.text.placeholder,
    },

    // ============================================
    // EXPANDED STATE - Full Dashboard
    // ============================================
    expandedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.strong,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    expandedTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.text.primary,
    },
    scrollContent: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 12,
    },

    // Status Section
    statusSection: {
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 12,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    offlineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.error,
        marginRight: 8,
    },
    statusText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
    },
    statusSubtext: {
        fontSize: 13,
        color: colors.text.tertiary,
    },

    // Section Cards
    sectionCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border.strong,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text.primary,
    },

    // Milestone Card
    milestoneHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    milestoneLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    milestoneTextWrap: {
        marginLeft: 10,
        flex: 1,
    },
    milestoneTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 2,
    },
    milestoneSubtitle: {
        fontSize: 12,
        color: colors.text.tertiary,
    },
    milestoneCount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.success,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: colors.border.strong,
        borderRadius: 3,
        overflow: 'hidden',
        marginRight: 10,
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.success,
        borderRadius: 3,
    },
    progressPct: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.success,
        minWidth: 32,
        textAlign: 'right',
    },

    // Stats Grid
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.success,
    },
    statLabel: {
        fontSize: 11,
        color: colors.text.tertiary,
        marginTop: 3,
    },

    // Recommendations
    recommendationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    recIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    recContent: {
        flex: 1,
    },
    recTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text.primary,
    },
    recDescription: {
        fontSize: 11,
        color: colors.text.tertiary,
        marginTop: 1,
    },

    // Quick Actions
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    actionButton: {
        width: '48%',
        alignItems: 'center',
        padding: 12,
        marginBottom: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: colors.border.strong,
    },
    actionText: {
        fontSize: 11,
        color: colors.success,
        marginTop: 5,
        fontWeight: '600',
    },

    // ============================================
    // GO ONLINE BUTTON - Always visible
    // ============================================
    buttonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        paddingBottom: 16,
        // Removed explicit background to blend with dashboard gradient
    },
    goOnlineBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 25,
        backgroundColor: colors.primary, // Solid color matching Customer Request button
        // Shadow properties
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    goOnlineText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
    },
});
