import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthIdentity, usePaymentActions } from "../../contexts/AuthContext";
import ScreenHeader from "../../components/ScreenHeader";
import AppButton from "../../components/ui/AppButton";
import { colors, spacing } from "../../styles/theme";
import styles from "./DriverOnboardingCompleteScreen.styles";
import useDriverOnboardingCompleteFlow from "./useDriverOnboardingCompleteFlow";

export default function DriverOnboardingCompleteScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuthIdentity();
  const {
    updateDriverPaymentProfile,
    checkDriverOnboardingStatus,
    getDriverOnboardingLink,
  } = usePaymentActions();
  const { connectAccountId } = route.params || {};

  const {
    checkmarkAnim,
    fadeAnim,
    handleCheckAgain,
    handleContinue,
    handleGoHome,
    handleResumeOnboarding,
    handleSettings,
    handleViewEarnings,
    isLoading,
    isRefreshingStatus,
    pulseAnim,
    scaleAnim,
    verificationStatus,
  } = useDriverOnboardingCompleteFlow({
    connectAccountId,
    currentUser,
    updateDriverPaymentProfile,
    checkDriverOnboardingStatus,
    getDriverOnboardingLink,
    navigation,
  });
  const isVerified = verificationStatus === "verified";
  const isChecking = verificationStatus === "checking";
  const isUnderReview = verificationStatus === "under_review";
  const isActionRequired =
    verificationStatus === "action_required" || verificationStatus === "missing_account";
  const isError = verificationStatus === "error";
  const statusCircleColor = isVerified
    ? colors.success
    : isActionRequired || isError
      ? colors.secondary
      : colors.warning;
  const statusRingColor = isVerified
    ? colors.successLight
    : isActionRequired || isError
      ? colors.secondaryLight
      : colors.warningLight;
  const primaryButtonTitle = isVerified
    ? "Start Driving"
    : isActionRequired
      ? "Resume Account Setup"
      : "Go Home";
  const staticSubtitle = "No action is needed for now. Our partner is reviewing your account details now.";
  const currentStatusLabel = isRefreshingStatus
    ? "Updating"
    : isChecking
      ? "Checking"
      : isUnderReview
        ? "Under Review"
        : isActionRequired
          ? "Action Required"
          : isError
            ? "Status Check Failed"
            : "Verified";
  const currentStatusIcon = isChecking
    ? "sync-outline"
    : isUnderReview
      ? "time-outline"
      : isActionRequired
        ? "alert-circle-outline"
        : isError
          ? "cloud-offline-outline"
          : "checkmark-circle";
  const currentStatusIconColor = isVerified
    ? colors.success
    : isActionRequired || isError
      ? colors.secondary
      : colors.warning;
  const currentStatusIconBackground = isVerified
    ? colors.successLight
    : isActionRequired || isError
      ? colors.secondaryLight
      : colors.primaryLight;
  const refreshSpinAnim = React.useRef(new Animated.Value(0)).current;
  const refreshIconRotation = refreshSpinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  React.useEffect(() => {
    let loopAnimation = null;

    if (isRefreshingStatus) {
      refreshSpinAnim.setValue(0);
      loopAnimation = Animated.loop(
        Animated.timing(refreshSpinAnim, {
          toValue: 1,
          duration: 750,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loopAnimation.start();
    }

    return () => {
      if (loopAnimation) {
        loopAnimation.stop();
      }
      refreshSpinAnim.stopAnimation();
    };
  }, [isRefreshingStatus, refreshSpinAnim]);

  const renderSuccessIcon = () => (
    <Animated.View
      style={[
        styles.successIconContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }, { scale: pulseAnim }],
        },
      ]}
    >
      <LinearGradient
        colors={[statusCircleColor, statusCircleColor]}
        style={styles.successIconGradient}
      >
        {isVerified ? (
          <Animated.View
            style={[
              styles.checkmarkContainer,
              {
                transform: [{ scale: checkmarkAnim }],
              },
            ]}
          >
            <Ionicons name="checkmark" size={52} color={colors.white} />
          </Animated.View>
        ) : (
          <View style={styles.pendingIconContainer}>
            <Ionicons name="time-outline" size={46} color={colors.white} />
          </View>
        )}
      </LinearGradient>

      <View style={[styles.pulseRing1, { borderColor: statusRingColor }]} />
      <View style={[styles.pulseRing2, { borderColor: statusRingColor }]} />
    </Animated.View>
  );

  const renderVerificationStatus = () => (
    <View style={styles.verificationCard}>
      <View style={styles.verificationHeader}>
        <Text style={styles.verificationLabel}>Current Status</Text>
      </View>
      <View style={styles.verificationStatusRow}>
        <View style={styles.verificationStatusMain}>
          <View style={[styles.processingIcon, { backgroundColor: currentStatusIconBackground }]}>
            <Ionicons name={currentStatusIcon} size={20} color={currentStatusIconColor} />
          </View>
          <Text style={styles.verificationTitle}>{currentStatusLabel}</Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshIconButton, { backgroundColor: currentStatusIconBackground }]}
          onPress={handleCheckAgain}
          disabled={isRefreshingStatus}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Animated.View
            style={isRefreshingStatus ? { transform: [{ rotate: refreshIconRotation }] } : null}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={currentStatusIconColor}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderNextSteps = () => (
    <View style={styles.nextStepsSection}>
      <Text style={styles.nextStepsTitle}>What's Next?</Text>

      <View style={styles.stepsList}>
        <TouchableOpacity style={styles.stepItem} onPress={handleViewEarnings}>
          <View style={styles.stepIcon}>
            <Ionicons name="trending-up" size={20} color={colors.success} />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Track Your Earnings</Text>
            <Text style={styles.stepSubtitle}>
              Monitor your daily and weekly earnings
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.text.subtle} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.stepItem} onPress={handleSettings}>
          <View style={styles.stepIcon}>
            <Ionicons name="card" size={20} color={colors.primary} />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Payment Settings</Text>
            <Text style={styles.stepSubtitle}>
              Manage your bank account and instant pay
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.text.subtle} />
        </TouchableOpacity>

        <View style={styles.stepItem}>
          <View style={styles.stepIcon}>
            <Ionicons name="car" size={20} color={colors.secondary} />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Go Online</Text>
            <Text style={styles.stepSubtitle}>
              Start accepting delivery requests
            </Text>
          </View>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>Ready!</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Setup Complete"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentStack}>
          <View style={styles.successSection}>
            {renderSuccessIcon()}

            <Animated.View
              style={[
                styles.successContent,
                { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
              ]}
            >
              <Text style={styles.congratsTitle}>All Set Up</Text>
              <Text style={styles.congratsSubtitle}>
                {staticSubtitle}
              </Text>
            </Animated.View>
          </View>

          {renderVerificationStatus()}

          {verificationStatus === "verified" ? renderNextSteps() : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.fixedBottomActions,
          { paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
      >
        <View style={styles.buttonSection}>
          <AppButton
            title={isVerified && isLoading ? "Starting..." : primaryButtonTitle}
            onPress={
              isVerified
                ? handleContinue
                : isActionRequired
                  ? handleResumeOnboarding
                  : handleGoHome
            }
            loading={isVerified && isLoading}
            style={[
              styles.primaryActionButton,
              isVerified && styles.primaryActionButtonSuccess,
            ]}
            labelStyle={styles.primaryActionButtonText}
            leftIcon={
              isVerified
                ? <Ionicons name="car" size={16} color={colors.white} />
                : isActionRequired
                  ? <Ionicons name="refresh" size={16} color={colors.white} />
                : <Ionicons name="home-outline" size={16} color={colors.white} />
            }
          />
        </View>
      </View>
    </View>
  );
}
