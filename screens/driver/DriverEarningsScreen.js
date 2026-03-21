import React, { useCallback, useState } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useAuthIdentity,
  useDriverActions,
  usePaymentActions,
} from '../../contexts/AuthContext';
import CollapsibleMessagesHeader, {
  MESSAGES_TOP_BAR_HEIGHT,
} from '../../components/messages/CollapsibleMessagesHeader';
import AppButton from '../../components/ui/AppButton';
import styles from './DriverEarningsScreen.styles';
import { colors, spacing } from '../../styles/theme';
import useDriverEarningsData from '../../hooks/useDriverEarningsData';
import useCollapsibleTitleSnap from '../../hooks/useCollapsibleTitleSnap';
import { getRecentTrips } from './earnings/earningsUtils';
import EarningsPeriodSelector from './earnings/EarningsPeriodSelector';
import EarningsChart from './earnings/EarningsChart';
import RecentTripsPreview from './earnings/RecentTripsPreview';
import useDriverEarningsPayoutActions from './useDriverEarningsPayoutActions';

const HEADER_ROW_HEIGHT = 56;
const TITLE_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;

export default function DriverEarningsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuthIdentity();
  const { getDriverTrips, getDriverStats, getDriverProfile } = useDriverActions();
  const { processInstantPayout } = usePaymentActions();
  const currentUserId = currentUser?.id || currentUser?.uid;
  const {
    scrollRef,
    scrollY,
    handleScrollEndDrag,
    handleMomentumScrollEnd,
  } = useCollapsibleTitleSnap({
    collapseDistance: TITLE_COLLAPSE_DISTANCE,
  });

  const [selectedPeriod, setSelectedPeriod] = useState('week');

  const {
    weeklyData,
    driverTrips,
    loading,
    driverStats,
    driverProfile,
    loadDriverData,
  } = useDriverEarningsData({
    currentUserId,
    selectedPeriod,
    getDriverTrips,
    getDriverStats,
    getDriverProfile,
  });

  const totalWeeklyEarnings = weeklyData.reduce((sum, day) => sum + day.earnings, 0);
  const totalWeeklyTrips = weeklyData.reduce((sum, day) => sum + day.trips, 0);
  const averagePerTrip = totalWeeklyTrips > 0 ? totalWeeklyEarnings / totalWeeklyTrips : 0;

  const milestoneProgress =
    (driverStats.currentWeekTrips / driverStats.weeklyMilestone) * 100;
  const tripsRemaining = driverStats.weeklyMilestone - driverStats.currentWeekTrips;

  const recentTrips = getRecentTrips(driverTrips);
  const {
    handleInstantPayout,
    handlePayoutDetails,
    isInstantPayoutDisabled,
    payoutLoading,
  } = useDriverEarningsPayoutActions({
    currentUserId,
    driverProfile,
    driverStats,
    loading,
    processInstantPayout,
    loadDriverData,
    navigation,
  });

  const chartTitle = selectedPeriod === 'month' ? 'Monthly Trip Activity' : 'Weekly Trip Activity';
  const showBack = route?.name === 'DriverEarningsScreen' && navigation.canGoBack();
  const headerHeight = insets.top + MESSAGES_TOP_BAR_HEIGHT;
  const handleOpenRecentTrips = useCallback(() => {
    navigation.navigate('DriverRecentTripsScreen');
  }, [navigation]);
  const handleOpenRecentTrip = useCallback((trip) => {
    const request = trip?.request || null;
    if (!request) {
      return;
    }
    navigation.navigate('DriverRequestDetailsScreen', { request });
  }, [navigation]);

  const rightContent = (
    <TouchableOpacity
      style={styles.headerActionButton}
      onPress={handleOpenRecentTrips}
      accessibilityRole="button"
      accessibilityLabel="Open trip history"
    >
      <Ionicons name="time-outline" size={20} color={colors.text.primary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <CollapsibleMessagesHeader
        title="Earnings"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack={showBack}
        rightContent={rightContent}
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

        <EarningsPeriodSelector
          styles={styles}
          selectedPeriod={selectedPeriod}
          onSelectPeriod={setSelectedPeriod}
        />

        <View style={styles.earningsCard}>
          <View style={styles.earningsHeader}>
            <Text style={styles.earningsAmount}>${loading ? '---' : totalWeeklyEarnings.toFixed(2)}</Text>
            <TouchableOpacity style={styles.earningsInfo} onPress={() => loadDriverData()}>
              <Ionicons
                name={loading ? 'refresh' : 'information-circle-outline'}
                size={20}
                color={colors.text.subtle}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.earningsSubtitle}>
            {loading
              ? 'Loading trip data...'
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
                    ? 'Loading...'
                    : tripsRemaining > 0
                      ? `${tripsRemaining} more trips for $50 bonus`
                      : 'Milestone achieved! $50 bonus earned'}
                </Text>
              </View>
            </View>
            <Text style={styles.milestoneCount}>
              {loading ? '--/--' : `${driverStats.currentWeekTrips}/${driverStats.weeklyMilestone}`}
            </Text>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: loading ? '0%' : `${Math.min(milestoneProgress, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {loading ? '--%' : `${Math.round(milestoneProgress)}%`}
            </Text>
          </View>
        </View>

        <View style={styles.payoutCard}>
          <View style={styles.payoutHeader}>
            <View style={styles.payoutLeft}>
              <Ionicons name="card" size={20} color={colors.success} />
              <Text style={styles.payoutTitle}>PikUp Payout Account</Text>
            </View>
            <TouchableOpacity onPress={handlePayoutDetails}>
              <Ionicons name="chevron-forward" size={20} color={colors.text.subtle} />
            </TouchableOpacity>
          </View>
          <Text style={styles.payoutBalance}>
            Available Balance: ${loading ? '---' : driverStats.availableBalance.toFixed(2)}
          </Text>
          <Text style={styles.payoutNote}>Auto-deposit every Monday</Text>

          <AppButton
            title={
              !driverProfile?.connectAccountId || !driverProfile?.canReceivePayments
                ? 'Setup Required'
                : 'Instant Payout'
            }
            style={[
              styles.instantPayoutButton,
              isInstantPayoutDisabled && styles.instantPayoutButtonDisabled,
            ]}
            onPress={handleInstantPayout}
            disabled={isInstantPayoutDisabled}
            loading={payoutLoading}
            labelStyle={styles.instantPayoutText}
            leftIcon={<Ionicons name="flash" size={16} color={colors.white} />}
          />
        </View>

        <EarningsChart
          styles={styles}
          loading={loading}
          chartTitle={chartTitle}
          weeklyData={weeklyData}
        />

        <RecentTripsPreview
          styles={styles}
          recentTrips={recentTrips}
          onViewAll={handleOpenRecentTrips}
          onOpenTrip={handleOpenRecentTrip}
        />
      </Animated.ScrollView>
    </View>
  );
}
