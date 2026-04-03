import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ONBOARDING_DRAFT_STORAGE_PREFIX } from "./DriverOnboardingScreen.constants";
import { logger } from "../../services/logger";

const STATUS_POLL_INITIAL_INTERVAL_MS = 5000;
const STATUS_POLL_MAX_INTERVAL_MS = 60000;

const normalizeList = (value) => (
  Array.isArray(value)
    ? value.map((entry) => String(entry || "").trim()).filter(Boolean)
    : []
);

const resolveNormalizedStatus = (result) => {
  const rawStatus = String(result?.status || "").trim().toLowerCase();
  if (rawStatus === "verified") return "verified";
  if (rawStatus === "under_review" || rawStatus === "review") return "under_review";
  if (rawStatus === "action_required") return "action_required";
  if (rawStatus === "missing_account") return "missing_account";

  if (result?.canReceivePayments) return "verified";
  if (result?.onboardingComplete) return "under_review";
  return "action_required";
};

const buildStatusDetails = (result, normalizedStatus) => ({
  status: normalizedStatus,
  requirements: normalizeList(result?.requirements),
  currentlyDue: normalizeList(result?.currentlyDue),
  pastDue: normalizeList(result?.pastDue),
  eventuallyDue: normalizeList(result?.eventuallyDue),
  pendingVerification: normalizeList(result?.pendingVerification),
  disabledReason: String(result?.disabledReason || "").trim() || null,
  checkedAt: new Date().toISOString(),
});

const createDefaultStatusDetails = () => ({
  status: "checking",
  requirements: [],
  currentlyDue: [],
  pastDue: [],
  eventuallyDue: [],
  pendingVerification: [],
  disabledReason: null,
  checkedAt: null,
});

export default function useDriverOnboardingCompleteFlow({
  connectAccountId,
  currentUser,
  updateDriverPaymentProfile,
  checkDriverOnboardingStatus,
  getDriverOnboardingLink,
  navigation,
}) {
  const userId = currentUser?.uid || currentUser?.id;
  const initialConnectAccountId = String(connectAccountId || "").trim() || null;

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [resolvedConnectAccountId, setResolvedConnectAccountId] = useState(initialConnectAccountId);
  const [verificationStatus, setVerificationStatus] = useState("checking");
  const [statusDetails, setStatusDetails] = useState(createDefaultStatusDetails);

  const pollTimeoutRef = useRef(null);
  const pollIntervalMsRef = useRef(STATUS_POLL_INITIAL_INTERVAL_MS);
  const pulseLoopRef = useRef(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const clearStatusPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const scheduleNextStatusCheck = useCallback((callback) => {
    clearStatusPolling();
    const delay = pollIntervalMsRef.current;
    pollTimeoutRef.current = setTimeout(() => {
      callback?.();
    }, delay);
    pollIntervalMsRef.current = Math.min(
      Math.round(delay * 1.6),
      STATUS_POLL_MAX_INTERVAL_MS
    );
  }, [clearStatusPolling]);

  const startCheckmarkAnimation = useCallback(() => {
    Animated.spring(checkmarkAnim, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [checkmarkAnim]);

  const checkVerificationStatus = useCallback(async ({ foreground = false, resetBackoff = false } = {}) => {
    if (resetBackoff) {
      pollIntervalMsRef.current = STATUS_POLL_INITIAL_INTERVAL_MS;
    }

    if (foreground) {
      setIsRefreshingStatus(true);
    }

    clearStatusPolling();

    try {
      const statusResult = await checkDriverOnboardingStatus?.(resolvedConnectAccountId);
      if (!statusResult?.success) {
        throw new Error(statusResult?.error || "Could not verify Stripe Connect status");
      }

      const nextConnectAccountId =
        String(
          statusResult?.connectAccountId ||
          statusResult?.accountId ||
          resolvedConnectAccountId ||
          ""
        ).trim() || null;

      setResolvedConnectAccountId(nextConnectAccountId);

      const normalizedStatus = resolveNormalizedStatus(statusResult);
      const nextDetails = buildStatusDetails(statusResult, normalizedStatus);

      setStatusDetails(nextDetails);
      setVerificationStatus(normalizedStatus);

      if (normalizedStatus === "verified" || statusResult.canReceivePayments) {
        startCheckmarkAnimation();
        clearStatusPolling();
        return;
      }

      if (normalizedStatus === "under_review") {
        scheduleNextStatusCheck(() => {
          void checkVerificationStatus();
        });
        return;
      }

      clearStatusPolling();
    } catch (error) {
      logger.error("DriverOnboardingCompleteFlow", "Error checking verification status", error);
      setVerificationStatus("error");
      setStatusDetails((prev) => ({
        ...prev,
        status: "error",
        checkedAt: new Date().toISOString(),
      }));
      clearStatusPolling();
    } finally {
      if (foreground) {
        setIsRefreshingStatus(false);
      }
    }
  }, [
    checkDriverOnboardingStatus,
    clearStatusPolling,
    resolvedConnectAccountId,
    scheduleNextStatusCheck,
    startCheckmarkAnimation,
  ]);

  useEffect(() => {
    if (initialConnectAccountId) {
      setResolvedConnectAccountId(initialConnectAccountId);
    }
  }, [initialConnectAccountId]);

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
    void checkVerificationStatus({ foreground: true, resetBackoff: true });

    return () => {
      clearStatusPolling();
      if (pulseLoopRef.current) {
        pulseLoopRef.current.stop();
      }
    };
  }, [checkVerificationStatus, clearStatusPolling, startAnimations]);

  const handleContinue = useCallback(async () => {
    setIsLoading(true);

    try {
      if (!userId) {
        throw new Error("User not found");
      }

      await updateDriverPaymentProfile?.(userId, {
        onboardingComplete: true,
        canReceivePayments: true,
        onboardingStatus: "verified",
        connectAccountId: resolvedConnectAccountId,
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
  }, [navigation, resolvedConnectAccountId, updateDriverPaymentProfile, userId]);

  const handleResumeOnboarding = useCallback(async () => {
    try {
      const existingAccountId = String(
        resolvedConnectAccountId || connectAccountId || ""
      ).trim();
      if (!existingAccountId) {
        throw new Error("Missing Stripe Connect account ID");
      }

      const result = await getDriverOnboardingLink?.(existingAccountId);
      if (!result?.success || !result?.onboardingUrl) {
        throw new Error(result?.error || "Unable to open onboarding link");
      }

      await Linking.openURL(result.onboardingUrl);
    } catch (error) {
      Alert.alert("Onboarding Error", error?.message || "Could not reopen onboarding.");
    }
  }, [connectAccountId, getDriverOnboardingLink, resolvedConnectAccountId]);

  const handleCheckAgain = useCallback(async () => {
    await checkVerificationStatus({ foreground: true, resetBackoff: true });
  }, [checkVerificationStatus]);

  const handleGoHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: "DriverTabs" }],
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
    handleCheckAgain,
    handleContinue,
    handleGoHome,
    handleResumeOnboarding,
    handleSettings,
    handleViewEarnings,
    isLoading,
    isRefreshingStatus,
    scaleAnim,
    pulseAnim,
    statusDetails,
    verificationStatus,
  };
}
