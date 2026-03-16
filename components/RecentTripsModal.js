// Recent trips modal: shows completed/cancelled trips with earnings and route summary.
import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BaseModal from './BaseModal';
import AppCard from './ui/AppCard';
import AppListEmpty from './ui/AppListEmpty';
import { TRIP_STATUS } from '../constants/tripStatus';
import { colors } from '../styles/theme';
import styles from './RecentTripsModal.styles';

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
  const statusColor = getStatusColor(status);

  return (
    <AppCard style={styles.tripCard} padded={false}>
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
    </AppCard>
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
            <AppListEmpty
              style={styles.emptyState}
              iconName="car-outline"
              title="No trips yet"
              subtitle="Your completed trips will appear here"
            />
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
