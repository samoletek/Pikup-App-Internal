import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BaseModal from './BaseModal';
import { TRIP_STATUS } from '../constants/tripStatus';
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from '../styles/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

const TripItem = ({ trip }) => {
  const timestamp = trip.completedAt || trip.createdAt || trip.timestamp;
  const pickup = trip.pickupAddress || trip.pickup?.address || 'Pickup';
  const dropoff = trip.dropoffAddress || trip.dropoff?.address || 'Dropoff';
  const amount = Number(trip.driverEarnings || trip.pricing?.total * 0.7 || 0);
  const status = trip.status;

  return (
    <View style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <View style={styles.tripLeft}>
          <Text style={styles.tripDate}>{formatTripDate(timestamp)}</Text>
          <Text style={styles.tripTime}>{formatTripTime(timestamp)}</Text>
        </View>
        <View style={styles.tripRight}>
          <Text style={styles.tripAmount}>${amount.toFixed(2)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
              {getStatusLabel(status)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tripRoute}>
        <View style={styles.routePoint}>
          <Ionicons name="radio-button-on" size={10} color={colors.success} />
          <Text style={styles.routeText} numberOfLines={1}>{pickup}</Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routePoint}>
          <Ionicons name="location" size={10} color={colors.primary} />
          <Text style={styles.routeText} numberOfLines={1}>{dropoff}</Text>
        </View>
      </View>
    </View>
  );
};

export default function RecentTripsModal({ visible, onClose, trips, loading }) {
  const sortedTrips = React.useMemo(() => {
    if (!trips?.length) return [];
    return [...trips].sort(
      (a, b) =>
        new Date(b.completedAt || b.createdAt || b.timestamp) -
        new Date(a.completedAt || a.createdAt || a.timestamp)
    );
  }, [trips]);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      height={SCREEN_HEIGHT * 0.85}
      backgroundColor={colors.background.primary}
    >
      {(animateClose) => (
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <View style={styles.headerCenter}>
              <Text style={styles.title}>All Trips</Text>
              <Text style={styles.subtitle}>
                {loading ? 'Loading...' : `${sortedTrips.length} trip${sortedTrips.length !== 1 ? 's' : ''}`}
              </Text>
            </View>
            <TouchableOpacity onPress={animateClose} style={styles.closeButton}>
              <Ionicons name="chevron-down" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading trips...</Text>
            </View>
          ) : sortedTrips.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={48} color={colors.border.strong} />
              <Text style={styles.emptyTitle}>No trips yet</Text>
              <Text style={styles.emptySubtitle}>Your completed trips will appear here</Text>
            </View>
          ) : (
            <FlatList
              data={sortedTrips}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <TripItem trip={item} />}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.strong,
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xxs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  tripLeft: {
    flex: 1,
  },
  tripRight: {
    alignItems: 'flex-end',
  },
  tripDate: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  tripTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  tripAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success,
    marginBottom: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  tripRoute: {
    marginBottom: spacing.xs,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  routeText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  routeLine: {
    width: 1,
    height: spacing.md,
    backgroundColor: colors.text.subtle,
    marginLeft: 5,
    marginVertical: spacing.xxs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.base,
    color: colors.text.subtle,
    fontSize: typography.fontSize.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    marginTop: spacing.base,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  emptySubtitle: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});