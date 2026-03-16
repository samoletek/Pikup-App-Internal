import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { logger } from "../../services/logger";

export default function useDriverEarningsPayoutActions({
  currentUserId,
  driverProfile,
  driverStats,
  loading,
  processInstantPayout,
  loadDriverData,
  navigation,
}) {
  const [payoutLoading, setPayoutLoading] = useState(false);

  const handleInstantPayout = useCallback(async () => {
    if (driverStats.availableBalance <= 0) {
      Alert.alert("No Balance", "You don't have any available balance to cash out.");
      return;
    }

    if (!driverProfile?.connectAccountId) {
      Alert.alert(
        "Setup Required",
        "You need to complete your payment setup before you can receive payouts. Please complete your driver onboarding first.",
        [
          { text: "OK", style: "default" },
          { text: "Setup Now", onPress: () => navigation.navigate("DriverOnboardingScreen") },
        ]
      );
      return;
    }

    if (!driverProfile?.canReceivePayments) {
      Alert.alert(
        "Account Under Review",
        "Your payment account is still being reviewed. You'll be able to receive payouts once verification is complete.",
        [{ text: "OK", style: "default" }]
      );
      return;
    }

    Alert.alert(
      "Instant Payout",
      `Cash out $${driverStats.availableBalance.toFixed(2)}? This will be processed immediately.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Cash Out",
          onPress: async () => {
            setPayoutLoading(true);
            try {
              const result = await processInstantPayout?.(
                currentUserId,
                driverStats.availableBalance
              );

              if (result?.success) {
                Alert.alert("Success", "Your payout has been processed successfully!");
                await loadDriverData();
              } else {
                throw new Error(result?.error || "Payout failed");
              }
            } catch (error) {
              logger.error("DriverEarningsPayoutActions", "Payout error", error);
              Alert.alert("Error", `Failed to process payout: ${error.message}`);
            } finally {
              setPayoutLoading(false);
            }
          },
        },
      ]
    );
  }, [
    currentUserId,
    driverProfile?.canReceivePayments,
    driverProfile?.connectAccountId,
    driverStats.availableBalance,
    loadDriverData,
    navigation,
    processInstantPayout,
  ]);

  const handlePayoutDetails = useCallback(() => {
    if (!driverProfile?.connectAccountId) {
      Alert.alert(
        "Payout Account",
        "Complete your driver onboarding to set up payouts via Stripe Connect.",
        [
          { text: "OK", style: "default" },
          { text: "Setup Now", onPress: () => navigation.navigate("DriverOnboardingScreen") },
        ]
      );
      return;
    }

    Alert.alert(
      "Payout Account",
      `Status: ${driverProfile?.canReceivePayments ? "Active" : "Under Review"}\nAvailable Balance: $${driverStats.availableBalance.toFixed(2)}\nAuto-deposit: Every Monday`,
      [{ text: "OK", style: "default" }]
    );
  }, [
    driverProfile?.canReceivePayments,
    driverProfile?.connectAccountId,
    driverStats.availableBalance,
    navigation,
  ]);

  const isInstantPayoutDisabled = (
    loading ||
    payoutLoading ||
    driverStats.availableBalance <= 0 ||
    !driverProfile?.connectAccountId ||
    !driverProfile?.canReceivePayments
  );

  return {
    handleInstantPayout,
    handlePayoutDetails,
    isInstantPayoutDisabled,
    payoutLoading,
  };
}
