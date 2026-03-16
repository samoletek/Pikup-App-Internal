import { StyleSheet } from "react-native";
import { borderRadius, colors, spacing, typography } from "../../styles/theme";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  messagesList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.base,
  },
  largeTitleSection: {
    height: 56,
    justifyContent: "center",
    paddingVertical: spacing.xs,
    backgroundColor: colors.background.primary,
    zIndex: 2,
  },
  largeTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
  },
  searchSection: {
    height: 56,
    justifyContent: "center",
    paddingVertical: spacing.xs,
    zIndex: 1,
  },
  searchBar: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    marginLeft: spacing.sm,
  },
  filterSection: {
    height: 56,
    justifyContent: "center",
    paddingVertical: spacing.xs,
  },
  messagesSection: {},
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  filterTextActive: {
    color: colors.text.primary,
  },
  filterBadge: {
    marginLeft: spacing.sm,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    backgroundColor: colors.background.elevated,
  },
  filterBadgeActive: {
    backgroundColor: colors.overlayPrimarySoft,
  },
  filterBadgeText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  messageItem: {
    height: 100,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  avatarContainer: {
    position: "relative",
    marginRight: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.circle,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  messageContent: {
    flex: 1,
    justifyContent: "center",
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  peerName: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginRight: spacing.sm,
  },
  peerNameUnread: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
  },
  timestamp: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  metaText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.xs,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  lastMessage: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    lineHeight: 18,
  },
  lastMessageUnread: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.warning,
    alignSelf: "center",
    marginLeft: spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
  },
  emptyStateTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.base,
    marginBottom: spacing.xs,
  },
  emptyStateSubtitle: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
});

export default styles;
