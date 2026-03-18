import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ONBOARDING_DRAFT_STORAGE_PREFIX } from "./DriverOnboardingScreen.constants";
import { logger } from "../../services/logger";

const MAX_STATUS_POLL_ATTEMPTS = 20;
const STATUS_POLL_INTERVAL_MS = 5000;

export default function useDriverOnboardingCompleteFlow({
  connectAccountId,
  currentUser,
  updateDriverPaymentProfile,
  checkDriverOnboardingStatus,
  getDriverOnboardingLink,
  navigation,
}) {
  const userId = currentUser?.uid || currentUser?.id;

  const [isLoading, setIsLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState("processing");

  const pollTimeoutRef = useRef(null);
  const pollAttemptsRef = useRef(0);
  const pulseLoopRef = useRef(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startCheckmarkAnimation = useCallback(() => {
    Animated.spring(checkmarkAnim, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [checkmarkAnim]);

  const checkVerificationStatus = useCallback(async () => {
    if (!connectAccountId) {
      setVerificationStatus("error");
      return;
    }

    try {
      const statusResult = await checkDriverOnboardingStatus?.(connectAccountId);
      if (!statusResult?.success) {
        throw new Error(statusResult?.error || "Could not verify Stripe Connect status");
      }

      if (statusResult.status === "verified" || statusResult.canReceivePayments) {
        setVerificationStatus("verified");
        startCheckmarkAnimation();
        return;
      }

      setVerificationStatus("processing");
      if (pollAttemptsRef.current < MAX_STATUS_POLL_ATTEMPTS) {
        pollAttemptsRef.current += 1;
        pollTimeoutRef.current = setTimeout(() => {
          void checkVerificationStatus();
        }, STATUS_POLL_INTERVAL_MS);
      } else {
        setVerificationStatus("error");
      }
    } catch (error) {
      logger.error("DriverOnboardingCompleteFlow", "Error checking verification status", error);
      setVerificationStatus("error");
    }
  }, [checkDriverOnboardingStatus, connectAccountId, startCheckmarkAnimation]);

  const startAnimations = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoopRef.current.start();
  }, [fadeAnim, pulseAnim, scaleAnim]);

  useEffect(() => {
    startAnimations();
    void checkVerificationStatus();

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }

      if (pulseLoopRef.current) {
        pulseLoopRef.current.stop();
      }
    };
  }, [checkVerificationStatus, startAnimations]);

  const handleContinue = useCallback(async () => {
    setIsLoading(true);

    try {
      if (!userId) {
        throw new Error("User not found");
      }

      await updateDriverPaymentProfile?.(userId, {
        onboardingComplete: true,
        connectAccountId,
        completedAt: new Date().toISOString(),
        onboardingStep: null,
        onboardingDraft: null,
        onboardingLastSavedAt: null,
      });

      await AsyncStorage.removeItem(`${ONBOARDING_DRAFT_STORAGE_PREFIX}:${userId}`);

      navigation.reset({
        index: 0,
        routes: [{ name: "DriverTabs" }],
      });
    } catch (error) {
      logger.error("DriverOnboardingCompleteFlow", "Error updating profile", error);
      Alert.alert(
        "Error",
        `There was an issue completing your setup: ${error?.message || "Unknown error"}`
      );
    } finally {
      setIsLoading(false);
    }
  }, [connectAccountId, navigation, updateDriverPaymentProfile, userId]);

  const handleResumeOnboarding = useCallback(async () => {
    try {
      if (!connectAccountId) {
        throw new Error("Missing Stripe Connect account ID");
      }

      const result = await getDriverOnboardingLink?.(connectAccountId);
      if (!result?.success || !result?.onboardingUrl) {
        throw new Error(result?.error || "Unable to open onboarding link");
      }

      await Linking.openURL(result.onboardingUrl);
    } catch (error) {
      Alert.alert("Onboarding Error", error?.message || "Could not reopen onboarding.");
    }
  }, [connectAccountId, getDriverOnboardingLink]);

  const handleGoHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'DriverTabs' }],
    });
  }, [navigation]);

  const handleViewEarnings = useCallback(() => {
    navigation.navigate("DriverEarningsScreen");
  }, [navigation]);

  const handleSettings = useCallback(() => {
    navigation.navigate("DriverPaymentSettingsScreen");
  }, [navigation]);

  return {
    checkmarkAnim,
    fadeAnim,
    handleContinue,
    handleGoHome,
    handleResumeOnboarding,
    handleSettings,
    handleViewEarnings,
    isLoading,
    scaleAnim,
    pulseAnim,
    verificationStatus,
  };
}
