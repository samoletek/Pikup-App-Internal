import { StyleSheet } from 'react-native';
import { borderRadius, colors, layout, spacing, typography } from '../../styles/theme';

const BORDER_WIDTH = StyleSheet.hairlineWidth;
const STATUS_CHIP_HORIZONTAL_PADDING = spacing.sm;
const STATUS_CHIP_VERTICAL_PADDING = spacing.xs;
const ROUTE_DIVIDER_OFFSET = spacing.sm - 1;
const ROUTE_DIVIDER_HEIGHT = spacing.lg - 2;
const BODY_LINE_HEIGHT = Math.round(typography.fontSize.base * typography.lineHeight.normal);
const PHOTO_PREVIEW_SIZE = 112;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  contentColumn: {
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: spacing.base,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  heroCard: {
    borderRadius: borderRadius.lg,
    borderWidth: BORDER_WIDTH,
    borderColor: colors.border.strong,
    padding: spacing.base,
    marginBottom: spacing.base,
  },

  /* -- Row 1: status chip + price -- */
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.full,
    paddingHorizontal: STATUS_CHIP_HORIZONTAL_PADDING,
    paddingVertical: STATUS_CHIP_VERTICAL_PADDING,
  },
  statusChipText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  amountText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },

  /* -- Route block with timeline dots -- */
  heroRouteBlock: {
    marginBottom: spacing.md,
    paddingLeft: spacing.xxs,
  },
  heroRouteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  heroRouteTimeline: {
    width: 20,
    alignItems: "center",
    paddingTop: 5,
  },
  heroRouteDot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.circle,
  },
  heroRouteDotPickup: {
    backgroundColor: colors.primary,
  },
  heroRouteDotDropoff: {
    backgroundColor: colors.success,
  },
  heroRouteConnector: {
    width: 2,
    height: spacing.lg,
    backgroundColor: colors.border.strong,
    marginVertical: spacing.xxs,
  },
  heroRouteText: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    lineHeight: Math.round(typography.fontSize.base * typography.lineHeight.normal),
  },

  /* -- Driver row -- */
  heroDriverRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: BORDER_WIDTH,
    borderTopColor: colors.border.strong,
    paddingTop: spacing.md,
  },
  heroParticipantAvatar: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.background.elevated,
    borderWidth: BORDER_WIDTH,
    borderColor: colors.border.strong,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroParticipantAvatarImage: {
    width: "100%",
    height: "100%",
  },
  heroDriverInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  heroDriverName: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  heroVehicleRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  heroVehicleText: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    lineHeight: Math.round(typography.fontSize.sm * typography.lineHeight.normal),
  },
  heroMeta: {
    marginTop: 2,
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
  heroPlatePill: {
    marginLeft: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: BORDER_WIDTH,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.elevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 1,
    maxWidth: 108,
  },
  heroPlateText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  heroChatButtonWrap: {
    position: "relative",
    marginLeft: spacing.sm,
  },
  heroChatButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  heroChatButtonDisabled: {
    opacity: 0.8,
  },
  heroChatUnreadDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.warning,
    borderWidth: 1,
    borderColor: colors.background.secondary,
  },
  sectionCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: BORDER_WIDTH,
    borderColor: colors.border.strong,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  sectionHint: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    lineHeight: BODY_LINE_HEIGHT,
  },
  progressList: {
    paddingTop: spacing.xs,
  },
  progressStepRow: {
    flexDirection: "row",
  },
  progressStepRail: {
    width: 20,
    alignItems: "center",
    marginRight: spacing.sm,
  },
  progressStepIconWrap: {
    width: 18,
    height: 18,
    borderRadius: borderRadius.circle,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.elevated,
  },
  progressStepIconWrapReached: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  progressStepIconWrapCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  progressConnector: {
    marginTop: spacing.xs,
    width: 2,
    flex: 1,
    minHeight: spacing.base,
    backgroundColor: colors.border.strong,
  },
  progressConnectorReached: {
    backgroundColor: colors.primary,
  },
  progressStepTextWrap: {
    flex: 1,
    paddingBottom: spacing.base,
  },
  progressStepLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  progressStepLabelReached: {
    color: colors.text.primary,
  },
  progressStepLabelCurrent: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  progressStepDescription: {
    marginTop: spacing.xs,
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    lineHeight: Math.round(typography.fontSize.sm * typography.lineHeight.normal),
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  routeDivider: {
    marginLeft: ROUTE_DIVIDER_OFFSET,
    marginVertical: spacing.sm,
    width: BORDER_WIDTH,
    height: ROUTE_DIVIDER_HEIGHT,
    backgroundColor: colors.border.strong,
  },
  routeText: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    lineHeight: BODY_LINE_HEIGHT,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: colors.border.strong,
  },
  infoLabel: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
  infoValue: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    flexShrink: 1,
    textAlign: "right",
    marginLeft: spacing.base,
  },
  itemDescription: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    lineHeight: BODY_LINE_HEIGHT,
  },
  photoScrollContent: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  photoTile: {
    width: PHOTO_PREVIEW_SIZE,
    height: PHOTO_PREVIEW_SIZE,
    borderRadius: borderRadius.md,
    overflow: "hidden",
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    marginRight: spacing.sm,
  },
  photoTileImage: {
    width: "100%",
    height: "100%",
  },
  photoTilePressable: {
    width: "100%",
    height: "100%",
  },
  photoTileBadge: {
    position: "absolute",
    left: spacing.xs,
    bottom: spacing.xs,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
  },
  photoTileBadgeText: {
    color: colors.white,
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.semibold,
  },
  ratingSubtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    lineHeight: BODY_LINE_HEIGHT,
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.base,
  },
  starButton: {
    paddingHorizontal: spacing.xs,
  },
  ratingLabel: {
    marginTop: spacing.sm,
    textAlign: "center",
    color: colors.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  badgesTitle: {
    marginTop: spacing.lg,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  badgesRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm,
  },
  badgeButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  badgeLabel: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.xs + 1,
    textAlign: "center",
    color: colors.text.muted,
    fontWeight: typography.fontWeight.medium,
  },
  submitRatingButton: {
    marginTop: spacing.lg,
    height: 46,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitRatingButtonDisabled: {
    opacity: 0.6,
  },
  submitRatingButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default styles;
