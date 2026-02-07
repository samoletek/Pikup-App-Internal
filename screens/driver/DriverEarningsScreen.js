import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { TRIP_STATUS } from "../../constants/tripStatus";
import CollapsibleMessagesHeader, {
  MESSAGES_TOP_BAR_HEIGHT,
} from "../../components/messages/CollapsibleMessagesHeader";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/theme";

const HEADER_ROW_HEIGHT = 56;
const TITLE_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;

export default function DriverEarningsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const {
    currentUser,
    getDriverTrips,
    getDriverStats,
    processInstantPayout,
    getDriverProfile,
  } = useAuth();
  const currentUserId = currentUser?.id || currentUser?.uid;

  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const isSnappingRef = useRef(false);

  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [weeklyData, setWeeklyData] = useState([]);
  const [driverTrips, setDriverTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driverStats, setDriverStats] = useState({
    currentWeekTrips: 0,
    totalEarnings: 0,
    availableBalance: 0,
    weeklyMilestone: 15,
  });
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [driverProfile, setDriverProfile] = useState(null);

  useEffect(() => {
    if (currentUserId) {
      loadDriverData();
    } else {
      setLoading(false);
    }
  }, [currentUserId]);

  const loadDriverData = async () => {
    try {
      setLoading(true);

      const trips = (await getDriverTrips?.(currentUserId)) || [];
      const stats = (await getDriverStats?.(currentUserId)) || {};
      const profile = (await getDriverProfile?.(currentUserId)) || {};

      setDriverTrips(trips);
      setDriverProfile(profile);
      setDriverStats({
        currentWeekTrips: stats.currentWeekTrips || 0,
        totalEarnings: stats.totalEarnings || 0,
        availableBalance: stats.availableBalance || 0,
        weeklyMilestone: 15,
      });

      const processedWeeklyData = processTripsIntoWeeklyData(trips);
      setWeeklyData(processedWeeklyData);
    } catch (error) {
      console.error("Error loading driver data:", error);
      setWeeklyData(getMockWeeklyData());
      setDriverStats({
        currentWeekTrips: 12,
        totalEarnings: 330.5,
        availableBalance: 0,
        weeklyMilestone: 15,
      });
    } finally {
      setLoading(false);
    }
  };

  const processTripsIntoWeeklyData = (trips) => {
    const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weekData = daysOfWeek.map((day) => ({ day, trips: 0, earnings: 0 }));

    const now = new Date();
    const currentDay = now.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const mondayDate = new Date(now);
    mondayDate.setDate(now.getDate() + mondayOffset);
    mondayDate.setHours(0, 0, 0, 0);

    const thisWeekTrips = trips.filter((trip) => {
      const tripDate = new Date(trip.completedAt || trip.timestamp);
      return tripDate >= mondayDate;
    });

    thisWeekTrips.forEach((trip) => {
      const tripDate = new Date(trip.completedAt || trip.timestamp);
      const dayIndex = tripDate.getDay() === 0 ? 6 : tripDate.getDay() - 1;

      if (dayIndex >= 0 && dayIndex < 7) {
        weekData[dayIndex].trips += 1;
        weekData[dayIndex].earnings += parseFloat(
          trip.driverEarnings || trip.pricing?.total * 0.7 || 0
        );
      }
    });

    return weekData;
  };

  const getMockWeeklyData = () => [
    { day: "Mon", trips: 2, earnings: 45.8 },
    { day: "Tue", trips: 3, earnings: 67.2 },
    { day: "Wed", trips: 1, earnings: 28.5 },
    { day: "Thu", trips: 2, earnings: 52.3 },
    { day: "Fri", trips: 2, earnings: 61.4 },
    { day: "Sat", trips: 1, earnings: 34.2 },
    { day: "Sun", trips: 1, earnings: 41.1 },
  ];

  const getRecentTrips = () => {
    return driverTrips
      .filter((trip) => trip.status === TRIP_STATUS.COMPLETED)
      .sort(
        (a, b) =>
          new Date(b.completedAt || b.timestamp) -
          new Date(a.completedAt || a.timestamp)
      )
      .slice(0, 4)
      .map((trip) => ({
        id: trip.id,
        date: formatTripDate(trip.completedAt || trip.timestamp),
        time: formatTripTime(trip.completedAt || trip.timestamp),
        pickup: "Pickup Location",
        dropoff: "Dropoff Location",
        amount: Number(trip.driverEarnings || trip.pricing?.total * 0.7 || 0),
        distance: trip.distance || "0 mi",
        duration: trip.duration || "0 min",
      }));
  };

  const formatTripDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTripTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const totalWeeklyEarnings = weeklyData.reduce((sum, day) => sum + day.earnings, 0);
  const totalWeeklyTrips = weeklyData.reduce((sum, day) => sum + day.trips, 0);
  const averagePerTrip = totalWeeklyTrips > 0 ? totalWeeklyEarnings / totalWeeklyTrips : 0;

  const milestoneProgress =
    (driverStats.currentWeekTrips / driverStats.weeklyMilestone) * 100;
  const tripsRemaining = driverStats.weeklyMilestone - driverStats.currentWeekTrips;

  const recentTrips = getRecentTrips();

  const handleInstantPayout = async () => {
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
              console.error("Payout error:", error);
              Alert.alert("Error", `Failed to process payout: ${error.message}`);
            } finally {
              setPayoutLoading(false);
            }
          },
        },
      ]
    );
  };

  const getSnapOffset = (offsetY) => {
    if (offsetY < 0 || offsetY > TITLE_COLLAPSE_DISTANCE) {
      return null;
    }

    return offsetY < TITLE_COLLAPSE_DISTANCE / 2 ? 0 : TITLE_COLLAPSE_DISTANCE;
  };

  const snapToNearestOffset = (offsetY) => {
    const targetOffset = getSnapOffset(offsetY);
    if (targetOffset === null || Math.abs(targetOffset - offsetY) < 1) {
      return;
    }

    if (!scrollRef.current) {
      return;
    }

    isSnappingRef.current = true;
    scrollRef.current.scrollTo({ y: targetOffset, animated: true });
    setTimeout(() => {
      isSnappingRef.current = false;
    }, 220);
  };

  const handleScrollEndDrag = (event) => {
    if (isSnappingRef.current) {
      return;
    }

    const velocityY = event.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(velocityY) < 0.15) {
      snapToNearestOffset(event.nativeEvent.contentOffset.y);
    }
  };

  const handleMomentumScrollEnd = (event) => {
    if (isSnappingRef.current) {
      return;
    }
    snapToNearestOffset(event.nativeEvent.contentOffset.y);
  };

  const renderChart = () => {
    if (loading) {
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Weekly Trip Activity</Text>
          <View style={styles.loadingChart}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </View>
      );
    }

    const maxTrips = Math.max(...weeklyData.map((day) => day.trips), 1);

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Weekly Trip Activity</Text>
        <View style={styles.chartWrapper}>
          {weeklyData.map((day, index) => (
            <View key={index} style={styles.barContainer}>
              <View style={styles.barWrapper}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max((day.trips / maxTrips) * 60, 4),
                      backgroundColor:
                        day.trips > 0 ? colors.success : colors.border.strong,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.barValue,
                    { color: day.trips > 0 ? colors.text.primary : colors.text.subtle },
                  ]}
                >
                  {day.trips}
                </Text>
              </View>
              <Text style={styles.barLabel}>{day.day}</Text>
            </View>
          ))}
        </View>
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: colors.success }]} />
            <Text style={styles.legendText}>Daily Trips</Text>
          </View>
        </View>
      </View>
    );
  };

  const showBack = route?.name === "DriverEarningsScreen" && navigation.canGoBack();
  const headerHeight = insets.top + MESSAGES_TOP_BAR_HEIGHT;

  return (
    <View style={styles.container}>
      <CollapsibleMessagesHeader
        title="Earnings"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack={showBack}
        scrollY={scrollY}
        searchCollapseDistance={0}
        titleCollapseDistance={TITLE_COLLAPSE_DISTANCE}
      />

      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingHorizontal: spacing.base,
          paddingBottom: insets.bottom + 90,
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.largeTitleSection}>
          <Text style={styles.largeTitle}>Earnings</Text>
        </View>

        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[
              styles.periodButton,
              selectedPeriod === "week" && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod("week")}
          >
            <Text
              style={[
                styles.periodText,
                selectedPeriod === "week" && styles.periodTextActive,
              ]}
            >
              This Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.periodButton,
              selectedPeriod === "month" && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod("month")}
          >
            <Text
              style={[
                styles.periodText,
                selectedPeriod === "month" && styles.periodTextActive,
              ]}
            >
              This Month
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.earningsCard}>
          <View style={styles.earningsHeader}>
            <Text style={styles.earningsAmount}>
              ${loading ? "---" : totalWeeklyEarnings.toFixed(2)}
            </Text>
            <TouchableOpacity style={styles.earningsInfo} onPress={loadDriverData}>
              <Ionicons
                name={loading ? "refresh" : "information-circle-outline"}
                size={20}
                color={colors.text.subtle}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.earningsSubtitle}>
            {loading
              ? "Loading trip data..."
              : `Active ${totalWeeklyTrips} trips • Avg $${averagePerTrip.toFixed(2)} per trip`}
          </Text>
        </View>

        <View style={styles.milestoneCard}>
          <View style={styles.milestoneHeader}>
            <View style={styles.milestoneLeft}>
              <Ionicons name="trophy" size={24} color={colors.primary} />
              <View style={styles.milestoneText}>
                <Text style={styles.milestoneTitle}>Weekly Milestone</Text>
                <Text style={styles.milestoneSubtitle}>
                  {loading
                    ? "Loading..."
                    : tripsRemaining > 0
                      ? `${tripsRemaining} more trips for $50 bonus`
                      : "Milestone achieved! $50 bonus earned"}
                </Text>
              </View>
            </View>
            <Text style={styles.milestoneCount}>
              {loading
                ? "--/--"
                : `${driverStats.currentWeekTrips}/${driverStats.weeklyMilestone}`}
            </Text>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: loading ? "0%" : `${Math.min(milestoneProgress, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {loading ? "--%" : `${Math.round(milestoneProgress)}%`}
            </Text>
          </View>
        </View>

        <View style={styles.payoutCard}>
          <View style={styles.payoutHeader}>
            <View style={styles.payoutLeft}>
              <Ionicons name="card" size={20} color={colors.success} />
              <Text style={styles.payoutTitle}>PikUp Payout Account</Text>
            </View>
            <TouchableOpacity>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.text.subtle}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.payoutBalance}>
            Available Balance: ${loading ? "---" : driverStats.availableBalance.toFixed(2)}
          </Text>
          <Text style={styles.payoutNote}>Auto-deposit every Monday</Text>

          <TouchableOpacity
            style={[
              styles.instantPayoutButton,
              (loading ||
                payoutLoading ||
                driverStats.availableBalance <= 0 ||
                !driverProfile?.connectAccountId ||
                !driverProfile?.canReceivePayments) &&
                styles.instantPayoutButtonDisabled,
            ]}
            onPress={handleInstantPayout}
            disabled={
              loading ||
              payoutLoading ||
              driverStats.availableBalance <= 0 ||
              !driverProfile?.connectAccountId ||
              !driverProfile?.canReceivePayments
            }
          >
            <Ionicons name="flash" size={16} color={colors.white} />
            <Text style={styles.instantPayoutText}>
              {payoutLoading
                ? "Processing..."
                : !driverProfile?.connectAccountId || !driverProfile?.canReceivePayments
                  ? "Setup Required"
                  : "Instant Payout"}
            </Text>
          </TouchableOpacity>
        </View>

        {renderChart()}

        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Recent Trips</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {recentTrips.length > 0 ? (
            recentTrips.map((trip) => (
              <View key={trip.id} style={styles.tripCard}>
                <View style={styles.tripHeader}>
                  <View style={styles.tripLeft}>
                    <Text style={styles.tripDate}>{trip.date}</Text>
                    <Text style={styles.tripTime}>{trip.time}</Text>
                  </View>
                  <Text style={styles.tripAmount}>${trip.amount.toFixed(2)}</Text>
                </View>

                <View style={styles.tripRoute}>
                  <View style={styles.routePoint}>
                    <Ionicons name="radio-button-on" size={10} color={colors.success} />
                    <Text style={styles.routeText}>{trip.pickup}</Text>
                  </View>
                  <View style={styles.routeLine} />
                  <View style={styles.routePoint}>
                    <Ionicons name="location" size={10} color={colors.primary} />
                    <Text style={styles.routeText}>{trip.dropoff}</Text>
                  </View>
                </View>

                <View style={styles.tripStats}>
                  <View style={styles.tripStatItem}>
                    <Ionicons name="car" size={12} color={colors.text.subtle} />
                    <Text style={styles.tripStatText}>{trip.distance}</Text>
                  </View>
                  <View style={styles.tripStatItem}>
                    <Ionicons name="time" size={12} color={colors.text.subtle} />
                    <Text style={styles.tripStatText}>{trip.duration}</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyTripsState}>
              <Ionicons name="file-tray-outline" size={28} color={colors.border.strong} />
              <Text style={styles.emptyTripsTitle}>No completed trips yet</Text>
            </View>
          )}
        </View>
      </Animated.ScrollView>
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
  largeTitleSection: {
    height: HEADER_ROW_HEIGHT,
    justifyContent: "center",
    paddingVertical: spacing.xs,
    backgroundColor: colors.background.primary,
    zIndex: 2,
    marginBottom: spacing.sm,
  },
  largeTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
  },
  periodSelector: {
    flexDirection: "row",
    backgroundColor: colors.background.secondary,
    marginBottom: spacing.base,
    borderRadius: borderRadius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  periodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: borderRadius.sm,
  },
  periodButtonActive: {
    backgroundColor: colors.success,
  },
  periodText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  periodTextActive: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  earningsCard: {
    backgroundColor: colors.background.secondary,
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  earningsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  earningsInfo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.elevated,
    justifyContent: "center",
    alignItems: "center",
  },
  earningsSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  milestoneCard: {
    backgroundColor: colors.background.secondary,
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  milestoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.base,
  },
  milestoneLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  milestoneText: {
    marginLeft: spacing.base,
    flex: 1,
  },
  milestoneTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  milestoneSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  milestoneCount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border.strong,
    borderRadius: 4,
    overflow: "hidden",
    marginRight: spacing.sm,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
    minWidth: 40,
  },
  payoutCard: {
    backgroundColor: colors.background.secondary,
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  payoutHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  payoutLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  payoutTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  payoutBalance: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success,
    marginBottom: 4,
  },
  payoutNote: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.base,
  },
  instantPayoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  instantPayoutButtonDisabled: {
    backgroundColor: colors.text.subtle,
    shadowOpacity: 0,
    elevation: 0,
  },
  instantPayoutText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  chartContainer: {
    backgroundColor: colors.background.secondary,
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  chartTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  chartWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 80,
    marginBottom: spacing.base,
  },
  barContainer: {
    alignItems: "center",
    flex: 1,
  },
  barWrapper: {
    alignItems: "center",
    height: 60,
    justifyContent: "flex-end",
    marginBottom: spacing.xs,
  },
  bar: {
    width: 20,
    backgroundColor: colors.success,
    borderRadius: 4,
    marginBottom: 4,
  },
  barValue: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  barLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  loadingChart: {
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.base,
  },
  loadingText: {
    color: colors.text.subtle,
    fontSize: typography.fontSize.sm,
  },
  historySection: {
    marginBottom: spacing.base,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.base,
  },
  historyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  viewAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.success,
    fontWeight: typography.fontWeight.medium,
  },
  tripCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  tripLeft: {
    flex: 1,
  },
  tripDate: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  tripTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  tripAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success,
  },
  tripRoute: {
    marginBottom: spacing.sm,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  routeText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
  routeLine: {
    width: 1,
    height: 12,
    backgroundColor: colors.text.subtle,
    marginLeft: 5,
    marginVertical: 2,
  },
  tripStats: {
    flexDirection: "row",
    gap: spacing.base,
  },
  tripStatItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  tripStatText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginLeft: 4,
  },
  emptyTripsState: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.secondary,
    paddingVertical: spacing.xl,
  },
  emptyTripsTitle: {
    marginTop: spacing.sm,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
});
