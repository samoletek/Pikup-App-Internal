import React from "react";
import {
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthIdentity, useTripActions } from "../../contexts/AuthContext";
import ScreenHeader from "../../components/ScreenHeader";
import AppButton from "../../components/ui/AppButton";
import AppInput from "../../components/ui/AppInput";
import { colors, spacing } from "../../styles/theme";
import styles from "./CustomerRewardsScreen.styles";
import useCustomerRewardsData from "./useCustomerRewardsData";

export default function CustomerRewardsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuthIdentity();
  const { getUserPickupRequests } = useTripActions();

  // Handle referral code from deep link (pikup-app.com/invite/CODE)
  const deepLinkCode = route?.params?.code;

  const {
    credits,
    promoCode,
    setPromoCode,
    promoStatus,
    handleApplyPromo,
    handleShare,
    milestoneProgress,
    milestonesCompleted,
    progressPercent,
    milestoneTarget,
    milestoneReward,
  } = useCustomerRewardsData({
    deepLinkCode,
    currentUser,
    getUserPickupRequests,
  });

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
              <AppInput
                containerStyle={styles.promoInputContainer}
                inputStyle={styles.promoInput}
                placeholder="Enter promo code"
                value={promoCode}
                onChangeText={setPromoCode}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleApplyPromo}
              />
              <AppButton
                title="Apply"
                style={[
                  styles.promoButton,
                  !promoCode.trim() && styles.promoButtonDisabled,
                ]}
                onPress={handleApplyPromo}
                disabled={!promoCode.trim()}
              />
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
              <AppButton
                title="Share Invite Link"
                onPress={handleShare}
                style={styles.shareButton}
                leftIcon={<Ionicons name="share-outline" size={18} color="#fff" />}
              />
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
                  {milestoneProgress} / {milestoneTarget} trips
                </Text>
              </View>

              <Text style={styles.milestoneReward}>
                Complete {milestoneTarget} trips to earn ${milestoneReward} credit
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
