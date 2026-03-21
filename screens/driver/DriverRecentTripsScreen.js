import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import AppListEmpty from '../../components/ui/AppListEmpty';
import { useAuthIdentity, useDriverActions } from '../../contexts/AuthContext';
import { TRIP_STATUS } from '../../constants/tripStatus';
import { logger } from '../../services/logger';
import { colors, layout, spacing } from '../../styles/theme';
import styles from './DriverRecentTripsScreen.styles';

const formatTripDate = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTripTime = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const getStatusColor = (status) => {
  switch (status) {
    case TRIP_STATUS.COMPLETED:
      return colors.success;
    case TRIP_STATUS.CANCELLED:
      return colors.error;
    default:
      return colors.text.subtle;
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case TRIP_STATUS.COMPLETED:
      return 'Completed';
    case TRIP_STATUS.CANCELLED:
      return 'Cancelled';
    default:
      return status || 'Unknown';
  }
};

function TripRow({ trip, onPress }) {
  const timestamp = trip.completedAt || trip.createdAt || trip.timestamp;
  const pickup = trip.pickupAddress || trip.pickup?.address || 'Pickup';
  const dropoff = trip.dropoffAddress || trip.dropoff?.address || 'Dropoff';
  const amount = Number(trip.driverEarnings || trip.pricing?.total * 0.7 || 0);
  const status = trip.status;
  const statusColor = getStatusColor(status);

  return (
    <TouchableOpacity onPress={() => onPress(trip)} activeOpacity={0.85}>
      <View style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <View style={styles.tripLeft}>
            <Text style={styles.tripDate}>{formatTripDate(timestamp)}</Text>
            <Text style={styles.tripTime}>{formatTripTime(timestamp)}</Text>
          </View>
          <View style={styles.tripRight}>
            <Text style={styles.tripAmount}>${amount.toFixed(2)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusLabel(status)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.tripRoute}>
          <View style={styles.routePoint}>
            <Ionicons name="radio-button-on" size={10} color={colors.success} />
            <Text style={styles.routeText} numberOfLines={1}>
              {pickup}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <Ionicons name="location" size={10} color={colors.primary} />
            <Text style={styles.routeText} numberOfLines={1}>
              {dropoff}
            </Text>
          </View>
        </View>

        <View style={styles.tripFooter}>
          <Text style={styles.tripFooterText}>View details</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function DriverRecentTripsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);
  const { currentUser } = useAuthIdentity();
  const { getDriverTrips } = useDriverActions();
  const currentUserId = currentUser?.id || currentUser?.uid;
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);

  const loadTrips = useCallback(async () => {
    if (!currentUserId) {
      setTrips([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const fetchedTrips = (await getDriverTrips?.(currentUserId)) || [];
      setTrips(fetchedTrips);
    } catch (error) {
      logger.error('DriverRecentTripsScreen', 'Failed to load driver recent trips', error);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, getDriverTrips]);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  const sortedTrips = useMemo(() => {
    if (!trips?.length) return [];
    return [...trips].sort(
      (a, b) =>
        new Date(b.completedAt || b.createdAt || b.timestamp) -
        new Date(a.completedAt || a.createdAt || a.timestamp)
    );
  }, [trips]);

  const handleOpenTrip = useCallback((trip) => {
    if (!trip) {
      return;
    }

    navigation.navigate('DriverRequestDetailsScreen', { request: trip });
  }, [navigation]);

  const rightContent = (
    <TouchableOpacity
      style={styles.refreshButton}
      onPress={() => void loadTrips()}
      accessibilityRole="button"
      accessibilityLabel="Refresh trips"
    >
      <Ionicons
        name={loading ? 'refresh' : 'refresh-outline'}
        size={18}
        color={colors.text.primary}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Trip History"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        rightContent={rightContent}
      />

      <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryTitle}>All Previous Trips</Text>
            <Text style={styles.summarySubtitle}>
              {loading ? 'Loading...' : `${sortedTrips.length} trip${sortedTrips.length === 1 ? '' : 's'}`}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading trips...</Text>
          </View>
        ) : sortedTrips.length === 0 ? (
          <AppListEmpty
            style={styles.emptyState}
            iconName="car-outline"
            title="No trips yet"
            subtitle="Your completed and cancelled trips will appear here."
          />
        ) : (
          <FlatList
            data={sortedTrips}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <TripRow trip={item} onPress={handleOpenTrip} />}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + spacing.base },
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}
