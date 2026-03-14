import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { TRIP_STATUS, normalizeTripStatus } from "../../constants/tripStatus";
import { links } from "../../constants/links";
import ScreenHeader from "../../components/ScreenHeader";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/theme";

const MILESTONE_TARGET = 5;
const MILESTONE_REWARD = 15;

export default function CustomerRewardsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { getUserPickupRequests, currentUser } = useAuth();
  const [completedTrips, setCompletedTrips] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState(null); // null | 'success' | 'error'
  const [credits] = useState(0);
  const promoTimerRef = useRef(null);

  // Handle referral code from deep link (pikup-app.com/invite/CODE)
  const deepLinkCode = route?.params?.code;

  useEffect(() => {
    if (deepLinkCode) {
      setPromoCode(deepLinkCode.toUpperCase());
    }
  }, [deepLinkCode]);

  const loadTripCount = useCallback(async () => {
    try {
      const requests = await getUserPickupRequests?.();
      const completed = (requests || []).filter(
        (r) => normalizeTripStatus(r.status) === TRIP_STATUS.COMPLETED
      );
      setCompletedTrips(completed.length);
    } catch (_e) {
      console.error("Error loading trip count:", _e);
    }
  }, [getUserPickupRequests]);

  useEffect(() => {
    loadTripCount();
    return () => {
      if (promoTimerRef.current) clearTimeout(promoTimerRef.current);
    };
  }, [loadTripCount]);

  const milestoneProgress = completedTrips % MILESTONE_TARGET;
  const milestonesCompleted = Math.floor(completedTrips / MILESTONE_TARGET);
  const progressPercent = (milestoneProgress / MILESTONE_TARGET) * 100;

  const handleApplyPromo = () => {
    if (!promoCode.trim()) return;
    // UI-only feedback — backend integration later
    setPromoStatus("success");
    if (promoTimerRef.current) clearTimeout(promoTimerRef.current);
    promoTimerRef.current = setTimeout(() => setPromoStatus(null), 3000);
    setPromoCode("");
  };

  const handleShare = async () => {
    const code = currentUser?.id?.slice(0, 8)?.toUpperCase() || "PIKUP10";
    try {
      await Share.share({
        message: `Join PikUp and get $10 off your first delivery! Use my code: ${code}\n${links.inviteBase}${code}`,
      });
    } catch (_e) {
      // user cancelled
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Rewards"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Credits Balance ── */}
        <View style={styles.creditsCard}>
          <View style={styles.creditsHeader}>
            <View style={styles.creditsIconCircle}>
              <Ionicons name="gift" size={22} color={colors.primary} />
            </View>
            <Text style={styles.creditsLabel}>PikUp Credits</Text>
          </View>
          <Text style={styles.creditsAmount}>
            ${credits.toFixed(2)}
          </Text>
          <Text style={styles.creditsSubtitle}>
            Credits are automatically applied to your next trip
          </Text>
        </View>

        {/* ── Promo Code ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>PROMO CODE</Text>
          <View style={styles.card}>
            <View style={styles.promoRow}>
              <TextInput
                style={styles.promoInput}
                placeholder="Enter promo code"
                placeholderTextColor={colors.text.muted}
                value={promoCode}
                onChangeText={setPromoCode}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleApplyPromo}
              />
              <TouchableOpacity
                style={[
                  styles.promoButton,
                  !promoCode.trim() && styles.promoButtonDisabled,
                ]}
                onPress={handleApplyPromo}
                disabled={!promoCode.trim()}
              >
                <Text style={styles.promoButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
            {promoStatus === "success" && (
              <View style={styles.promoFeedback}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.promoFeedbackText}>
                  Promo code applied successfully!
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Referral ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>INVITE FRIENDS</Text>
          <View style={styles.card}>
            <View style={styles.referralContent}>
              <View style={styles.referralIconCircle}>
                <Ionicons name="people" size={24} color={colors.primary} />
              </View>
              <Text style={styles.referralTitle}>
                Invite Friends, Get $10
              </Text>
              <Text style={styles.referralSubtitle}>
                Share your code. When a friend completes their first trip, you
                both earn $10 in credits.
              </Text>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text style={styles.shareButtonText}>Share Invite Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Milestones ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>MILESTONES</Text>
          <View style={styles.card}>
            <View style={styles.milestoneContent}>
              <View style={styles.milestoneHeader}>
                <Ionicons name="trophy-outline" size={20} color={colors.warning} />
                <Text style={styles.milestoneTitle}>
                  Trip Milestone
                </Text>
              </View>

              {milestonesCompleted > 0 && (
                <View style={styles.milestoneAchieved}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.milestoneAchievedText}>
                    {milestonesCompleted} milestone{milestonesCompleted > 1 ? "s" : ""} completed!
                  </Text>
                </View>
              )}

              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progressPercent}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {milestoneProgress} / {MILESTONE_TARGET} trips
                </Text>
              </View>

              <Text style={styles.milestoneReward}>
                Complete {MILESTONE_TARGET} trips to earn ${MILESTONE_REWARD} credit
              </Text>
            </View>
          </View>
        </View>

        {/* ── Reward History ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>REWARD HISTORY</Text>
          <View style={styles.card}>
            <View style={styles.emptyState}>
              <Ionicons
                name="time-outline"
                size={32}
                color={colors.text.subtle}
              />
              <Text style={styles.emptyText}>
                Complete trips to start earning rewards
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

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

  /* Credits Balance */
  creditsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  creditsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  creditsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.background.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  creditsLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  creditsAmount: {
    fontSize: 40,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  creditsSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.muted,
    textAlign: "center",
  },

  /* Sections */
  sectionBlock: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: "hidden",
  },

  /* Promo Code */
  promoRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.base,
    gap: spacing.sm,
  },
  promoInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  promoButton: {
    height: 44,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  promoButtonDisabled: {
    opacity: 0.4,
  },
  promoButtonText: {
    color: "#fff",
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  promoFeedback: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
  },
  promoFeedbackText: {
    color: colors.success,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },

  /* Referral */
  referralContent: {
    padding: spacing.xl,
    alignItems: "center",
  },
  referralIconCircle: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.background.brandTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  referralTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  referralSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  shareButtonText: {
    color: "#fff",
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },

  /* Milestones */
  milestoneContent: {
    padding: spacing.lg,
  },
  milestoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  milestoneTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  milestoneAchieved: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  milestoneAchievedText: {
    fontSize: typography.fontSize.base,
    color: colors.success,
    fontWeight: typography.fontWeight.medium,
  },
  progressBarContainer: {
    marginBottom: spacing.md,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.xs,
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xs,
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    textAlign: "right",
  },
  milestoneReward: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },

  /* Empty State */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.muted,
    textAlign: "center",
  },
});
