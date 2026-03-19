import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthIdentity, usePaymentActions } from "../../contexts/AuthContext";
import ScreenHeader from "../../components/ScreenHeader";
import AppButton from "../../components/ui/AppButton";
import { colors } from "../../styles/theme";
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
    handleContinue,
    handleGoHome,
    handleResumeOnboarding,
    handleSettings,
    handleViewEarnings,
    isLoading,
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
  const isProcessing = verificationStatus === "processing";
  const isError = verificationStatus === "error";
  const statusCircleColor = isVerified ? colors.success : colors.warning;
  const statusRingColor = isVerified ? colors.successLight : colors.warningLight;
  const primaryButtonTitle = isVerified
    ? "Start Driving"
    : isError
      ? "Resume Stripe Onboarding"
      : "Go Home";
  const primaryButtonDescription = isVerified
    ? null
    : isError
      ? "Stripe setup needs another try. Tap to reopen onboarding."
      : "We are reviewing your account now. No action is required from you.";

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

  const renderVerificationStatus = () => {
    if (isProcessing) {
      return (
        <View style={styles.verificationCard}>
          <View style={styles.verificationHeader}>
            <View style={styles.processingIcon}>
              <Ionicons name="time-outline" size={20} color={colors.warning} />
            </View>
            <Text style={styles.verificationTitle}>Under Review</Text>
          </View>
          <Text style={styles.verificationSubtitle}>
            We are processing your account verification. Please wait, no further action is needed.
          </Text>
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.verificationCard}>
          <View style={styles.verificationHeader}>
            <View style={styles.processingIcon}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.secondary} />
            </View>
            <Text style={styles.verificationTitle}>Verification Needs Attention</Text>
          </View>
          <Text style={styles.verificationSubtitle}>
            We could not confirm your Stripe onboarding yet. Tap the button below to resume it.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.verificationCard}>
        <View style={styles.verificationHeader}>
          <View style={styles.verifiedIcon}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          </View>
          <Text style={styles.verificationTitle}>Account Verified</Text>
        </View>
        <Text style={styles.verificationSubtitle}>
          Your account is ready! You can now start accepting delivery requests.
        </Text>
      </View>
    );
  };

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

  const renderFeatureHighlights = () => (
    <View style={styles.featuresSection}>
      <Text style={styles.featuresTitle}>Exclusive Driver Benefits</Text>

      <View style={styles.featuresList}>
        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Ionicons name="flash" size={16} color={colors.success} />
          </View>
          <Text style={styles.featureText}>Instant pay available</Text>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Ionicons name="shield-checkmark" size={16} color={colors.success} />
          </View>
          <Text style={styles.featureText}>Insurance coverage</Text>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Ionicons name="people" size={16} color={colors.success} />
          </View>
          <Text style={styles.featureText}>24/7 support</Text>
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

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.successSection}>
          {renderSuccessIcon()}

          <Animated.View
            style={[
              styles.successContent,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
            ]}
          >
            <Text style={styles.congratsTitle}>Congratulations!</Text>
            <Text style={styles.congratsSubtitle}>
              {isVerified
                ? "Welcome to the PikUp driver community! Your account setup is complete."
                : "Your setup is submitted. We are reviewing your account details now."}
            </Text>
          </Animated.View>
        </View>

        {renderVerificationStatus()}

        {verificationStatus === "verified" ? renderNextSteps() : null}
        {renderFeatureHighlights()}

        <View style={styles.buttonSection}>
          <AppButton
            title={isLoading && isVerified ? "Starting..." : primaryButtonTitle}
            onPress={isVerified ? handleContinue : isError ? handleResumeOnboarding : handleGoHome}
            loading={isLoading && isVerified}
            style={[
              styles.primaryActionButton,
              isVerified && styles.primaryActionButtonSuccess,
            ]}
            labelStyle={styles.primaryActionButtonText}
            leftIcon={
              isVerified
                ? <Ionicons name="car" size={16} color={colors.white} />
                : isError
                  ? <Ionicons name="refresh" size={16} color={colors.white} />
                  : <Ionicons name="home-outline" size={16} color={colors.white} />
            }
          />
          {primaryButtonDescription ? (
            <Text style={styles.primaryActionHint}>{primaryButtonDescription}</Text>
          ) : null}
        </View>

        <View style={[styles.bottomSpacing, { paddingBottom: insets.bottom }]} />
      </ScrollView>
    </View>
  );
}
