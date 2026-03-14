import { StyleSheet } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../../styles/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  contentColumn: {
    flex: 1,
    width: "100%",
    alignSelf: "center",
  },
  messageListContainer: {
    flex: 1,
  },
  messageList: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.base,
  },
  systemBox: {
    backgroundColor: colors.background.tertiary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm + spacing.xs,
  },
  systemText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingOlderContainer: {
    paddingVertical: spacing.base,
    alignItems: "center",
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  messageContainer: {
    marginBottom: spacing.sm + spacing.xs,
    maxWidth: "80%",
  },
  incomingContainer: {
    alignSelf: "flex-start",
  },
  outgoingContainer: {
    alignSelf: "flex-end",
  },
  messageBubble: {
    padding: 10,
    borderRadius: borderRadius.lg,
  },
  incomingMsg: {
    backgroundColor: colors.background.tertiary,
    borderBottomLeftRadius: borderRadius.xs,
  },
  outgoingMsg: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: borderRadius.xs,
  },
  messageText: {
    fontSize: typography.fontSize.base,
    lineHeight: 20,
  },
  incomingText: {
    color: colors.text.primary,
  },
  outgoingText: {
    color: colors.white,
  },
  messageTime: {
    fontSize: typography.fontSize.xs,
    lineHeight: 14, // Explicit lineHeight to match icon height
    // marginTop: spacing.xs, // Removed to fix alignment with icon
    opacity: 0.7,
  },
  incomingTime: {
    color: colors.text.secondary,
  },
  outgoingTime: {
    color: colors.white,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginHorizontal: spacing.xs,
    marginTop: spacing.sm,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
    marginBottom: 0,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.strong,
    minHeight: 40,
    paddingLeft: spacing.base,
    paddingRight: 2,
    paddingVertical: 2,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    lineHeight: 20,
    paddingTop: 8,
    paddingBottom: 8,
    textAlignVertical: "top",
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.xs,
    marginBottom: 0,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  attachButtonDisabled: {
    opacity: 0.6,
  },
  imageBubble: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  messageImage: {
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
  },
  messageVideo: {
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
  },
  videoContainer: {
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
    overflow: "hidden",
  },
  imageTime: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
    opacity: 0.8,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: spacing.xs,
  },
  imageTimeOverlay: {
    position: "absolute",
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  imageTimeText: {
    fontSize: typography.fontSize.xs,
    color: colors.white,
  },
  statusIcon: {
    marginLeft: spacing.xs,
  },
  failedMsg: {
    opacity: 0.6,
    borderWidth: 1,
    borderColor: colors.error,
  },
  imageWrapper: {
    position: "relative",
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  imageUploading: {
    opacity: 0.5,
  },
  videoPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.md,
  },
});

export default styles;
