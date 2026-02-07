import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { TRIP_STATUS } from '../../constants/tripStatus';
import { colors } from '../../styles/theme';

const { width } = Dimensions.get('window');

export default function DriverEarningsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currentUser, getDriverTrips, getDriverStats, processInstantPayout, getDriverProfile } = useAuth();
  const currentUserId = currentUser?.id || currentUser?.uid;
  
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [weeklyData, setWeeklyData] = useState([]);
  const [driverTrips, setDriverTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driverStats, setDriverStats] = useState({
    currentWeekTrips: 0,
    totalEarnings: 0,
    availableBalance: 0,
    weeklyMilestone: 15
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
      
      // Get driver's completed trips
      const trips = await getDriverTrips?.(currentUserId) || [];
      const stats = await getDriverStats?.(currentUserId) || {};
      const profile = await getDriverProfile?.(currentUserId) || {};
      
      setDriverTrips(trips);
      setDriverProfile(profile);
      setDriverStats({
        currentWeekTrips: stats.currentWeekTrips || 0,
        totalEarnings: stats.totalEarnings || 0,
        availableBalance: stats.availableBalance || 0.00,
        weeklyMilestone: 15
      });
      
      // Process trips into weekly data
      const processedWeeklyData = processTripsIntoWeeklyData(trips);
      setWeeklyData(processedWeeklyData);
      
    } catch (error) {
      console.error('Error loading driver data:', error);
      // Fallback to mock data if Firebase functions don't exist yet
      setWeeklyData(getMockWeeklyData());
      setDriverStats({
        currentWeekTrips: 12,
        totalEarnings: 330.50,
        availableBalance: 0.00,
        weeklyMilestone: 15
      });
    } finally {
      setLoading(false);
    }
  };

  const processTripsIntoWeeklyData = (trips) => {
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekData = daysOfWeek.map(day => ({ day, trips: 0, earnings: 0 }));
    
    // Get current week's start (Monday)
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Get Monday of current week
    const mondayDate = new Date(now);
    mondayDate.setDate(now.getDate() + mondayOffset);
    mondayDate.setHours(0, 0, 0, 0);

    // Filter trips from this week only
    const thisWeekTrips = trips.filter(trip => {
      const tripDate = new Date(trip.completedAt || trip.timestamp);
      return tripDate >= mondayDate;
    });

    // Group trips by day
    thisWeekTrips.forEach(trip => {
      const tripDate = new Date(trip.completedAt || trip.timestamp);
      const dayIndex = tripDate.getDay() === 0 ? 6 : tripDate.getDay() - 1; // Convert to Mon=0, Sun=6
      
      if (dayIndex >= 0 && dayIndex < 7) {
        weekData[dayIndex].trips += 1;
        weekData[dayIndex].earnings += parseFloat(trip.driverEarnings || trip.pricing?.total * 0.7 || 0);
      }
    });

    return weekData;
  };

  const getMockWeeklyData = () => [
    { day: 'Mon', trips: 2, earnings: 45.80 },
    { day: 'Tue', trips: 3, earnings: 67.20 },
    { day: 'Wed', trips: 1, earnings: 28.50 },
    { day: 'Thu', trips: 2, earnings: 52.30 },
    { day: 'Fri', trips: 2, earnings: 61.40 },
    { day: 'Sat', trips: 1, earnings: 34.20 },
    { day: 'Sun', trips: 1, earnings: 41.10 },
  ];

  const getRecentTrips = () => {
    // Get last 4 completed trips
    return driverTrips
      .filter((trip) => trip.status === TRIP_STATUS.COMPLETED)
      .sort((a, b) => new Date(b.completedAt || b.timestamp) - new Date(a.completedAt || a.timestamp))
      .slice(0, 4)
      .map(trip => ({
        id: trip.id,
        date: formatTripDate(trip.completedAt || trip.timestamp),
        time: formatTripTime(trip.completedAt || trip.timestamp),
        pickup: 'Pickup Location',
        dropoff: 'Dropoff Location',
        amount: trip.driverEarnings || (trip.pricing?.total * 0.7) || 0,
        distance: trip.distance || '0 mi',
        duration: trip.duration || '0 min'
      }));
  };

  const formatTripDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatTripTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const totalWeeklyEarnings = weeklyData.reduce((sum, day) => sum + day.earnings, 0);
  const totalWeeklyTrips = weeklyData.reduce((sum, day) => sum + day.trips, 0);
  const averagePerTrip = totalWeeklyTrips > 0 ? totalWeeklyEarnings / totalWeeklyTrips : 0;

  const milestoneProgress = (driverStats.currentWeekTrips / driverStats.weeklyMilestone) * 100;
  const tripsRemaining = driverStats.weeklyMilestone - driverStats.currentWeekTrips;

  const recentTrips = getRecentTrips();

  const handleInstantPayout = async () => {
    if (driverStats.availableBalance <= 0) {
      Alert.alert('No Balance', 'You don\'t have any available balance to cash out.');
      return;
    }

    // Check driver onboarding status
    if (!driverProfile?.connectAccountId) {
      Alert.alert(
        'Setup Required', 
        'You need to complete your payment setup before you can receive payouts. Please complete your driver onboarding first.',
        [
          { text: 'OK', style: 'default' },
          { text: 'Setup Now', onPress: () => navigation.navigate('DriverOnboardingScreen') }
        ]
      );
      return;
    }

    if (!driverProfile?.canReceivePayments) {
      Alert.alert(
        'Account Under Review', 
        'Your payment account is still being reviewed. You\'ll be able to receive payouts once verification is complete.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    Alert.alert(
      'Instant Payout',
      `Cash out $${driverStats.availableBalance.toFixed(2)}? This will be processed immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Cash Out', 
          onPress: async () => {
            setPayoutLoading(true);
            try {
              const result = await processInstantPayout?.(currentUserId, driverStats.availableBalance);
              if (result?.success) {
                Alert.alert('Success', 'Your payout has been processed successfully!');
                // Refresh driver data to show updated balance
                await loadDriverData();
              } else {
                throw new Error(result?.error || 'Payout failed');
              }
            } catch (error) {
              console.error('Payout error:', error);
              Alert.alert('Error', `Failed to process payout: ${error.message}`);
            } finally {
              setPayoutLoading(false);
            }
          }
        }
      ]
    );
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

    const maxTrips = Math.max(...weeklyData.map(day => day.trips), 1);

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
                      backgroundColor: day.trips > 0 ? colors.success : colors.border.strong
                    }
                  ]} 
                />
                <Text style={[styles.barValue, { color: day.trips > 0 ? colors.white : colors.text.subtle }]}>
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

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Earnings</Text>
          <TouchableOpacity style={styles.statsButton}>
            <Ionicons name="stats-chart" size={24} color={colors.success} />
          </TouchableOpacity>
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          <TouchableOpacity 
            style={[styles.periodButton, selectedPeriod === 'week' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('week')}
          >
            <Text style={[styles.periodText, selectedPeriod === 'week' && styles.periodTextActive]}>
              This Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.periodButton, selectedPeriod === 'month' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('month')}
          >
            <Text style={[styles.periodText, selectedPeriod === 'month' && styles.periodTextActive]}>
              This Month
            </Text>
          </TouchableOpacity>
        </View>

        {/* Main Earnings Card */}
        <View style={styles.earningsCard}>
          <View style={styles.earningsHeader}>
            <Text style={styles.earningsAmount}>
              ${loading ? '---' : totalWeeklyEarnings.toFixed(2)}
            </Text>
            <TouchableOpacity style={styles.earningsInfo} onPress={loadDriverData}>
              <Ionicons name={loading ? "refresh" : "information-circle-outline"} size={20} color={colors.text.subtle} />
            </TouchableOpacity>
          </View>
          <Text style={styles.earningsSubtitle}>
            {loading 
              ? 'Loading trip data...' 
              : `Active ${totalWeeklyTrips} trips • Avg $${averagePerTrip.toFixed(2)} per trip`
            }
          </Text>
        </View>

        {/* Milestone Progress */}
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
                      : 'Milestone achieved! $50 bonus earned'
                  }
                </Text>
              </View>
            </View>
            <Text style={styles.milestoneCount}>
              {loading ? '--/--' : `${driverStats.currentWeekTrips}/${driverStats.weeklyMilestone}`}
            </Text>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[
                styles.progressFill, 
                { width: loading ? '0%' : `${Math.min(milestoneProgress, 100)}%` }
              ]} />
            </View>
            <Text style={styles.progressText}>
              {loading ? '--%' : `${Math.round(milestoneProgress)}%`}
            </Text>
          </View>
        </View>

        {/* Payout Info */}
        <View style={styles.payoutCard}>
          <View style={styles.payoutHeader}>
            <View style={styles.payoutLeft}>
              <Ionicons name="card" size={20} color={colors.success} />
              <Text style={styles.payoutTitle}>PikUp Payout Account</Text>
            </View>
            <TouchableOpacity>
              <Ionicons name="chevron-forward" size={20} color={colors.text.subtle} />
            </TouchableOpacity>
          </View>
          <Text style={styles.payoutBalance}>
            Available Balance: ${loading ? '---' : driverStats.availableBalance.toFixed(2)}
          </Text>
          <Text style={styles.payoutNote}>Auto-deposit every Monday</Text>
          
          {/* Instant Payout Button */}
          <TouchableOpacity
            style={[
              styles.instantPayoutButton,
              (loading || payoutLoading || driverStats.availableBalance <= 0 || !driverProfile?.connectAccountId || !driverProfile?.canReceivePayments) && styles.instantPayoutButtonDisabled
            ]}
            onPress={handleInstantPayout}
            disabled={loading || payoutLoading || driverStats.availableBalance <= 0 || !driverProfile?.connectAccountId || !driverProfile?.canReceivePayments}
          >
            <Ionicons name="flash" size={16} color={colors.white} />
            <Text style={styles.instantPayoutText}>
              {payoutLoading 
                ? 'Processing...' 
                : (!driverProfile?.connectAccountId || !driverProfile?.canReceivePayments)
                  ? 'Setup Required'
                  : 'Instant Payout'
              }
            </Text>
          </TouchableOpacity>
        </View>

        {/* Trip Chart */}
        {renderChart()}

        {/* Trip History */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Recent Trips</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {recentTrips.map((trip) => (
            <View key={trip.id} style={styles.tripCard}>
              <View style={styles.tripHeader}>
                <View style={styles.tripLeft}>
                  <Text style={styles.tripDate}>{trip.date}</Text>
                  <Text style={styles.tripTime}>{trip.time}</Text>
                </View>
                <Text style={styles.tripAmount}>${trip.amount}</Text>
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
                <View style={styles.statItem}>
                  <Ionicons name="car" size={12} color={colors.text.subtle} />
                  <Text style={styles.statText}>{trip.distance}</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="time" size={12} color={colors.text.subtle} />
                  <Text style={styles.statText}>{trip.duration}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.bottomSpacing, { paddingBottom: insets.bottom }]} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: colors.background.secondary,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    marginHorizontal: 20,
    marginVertical: 15,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: colors.success,
  },
  periodText: {
    color: colors.text.tertiary,
    fontSize: 14,
    fontWeight: '500',
  },
  periodTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  earningsCard: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.white,
  },
  earningsInfo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  earningsSubtitle: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  milestoneCard: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  milestoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  milestoneText: {
    marginLeft: 12,
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    marginBottom: 2,
  },
  milestoneSubtitle: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  milestoneCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border.strong,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    minWidth: 40,
  },
  payoutCard: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  payoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  payoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    marginLeft: 8,
  },
  payoutBalance: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.success,
    marginBottom: 4,
  },
  payoutNote: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginBottom: 16,
  },
  instantPayoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
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
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  chartContainer: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    marginBottom: 20,
  },
  chartWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 80,
    marginBottom: 15,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    alignItems: 'center',
    height: 60,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  bar: {
    width: 20,
    backgroundColor: colors.success,
    borderRadius: 4,
    marginBottom: 4,
  },
  barValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  barLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  loadingChart: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  loadingText: {
    color: colors.text.subtle,
    fontSize: 14,
  },
  historySection: {
    marginHorizontal: 20,
    marginBottom: 15,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '500',
  },
  tripCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripLeft: {
    flex: 1,
  },
  tripDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
    marginBottom: 2,
  },
  tripTime: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  tripAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.success,
  },
  tripRoute: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  routeText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: 8,
  },
  routeLine: {
    width: 1,
    height: 12,
    backgroundColor: colors.text.subtle,
    marginLeft: 5,
    marginVertical: 2,
  },
  tripStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginLeft: 4,
  },
  bottomSpacing: {
    height: 40,
  },
});
