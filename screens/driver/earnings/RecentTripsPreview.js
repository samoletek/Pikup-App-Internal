import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../styles/theme';

export default function RecentTripsPreview({
  styles,
  recentTrips,
  onViewAll,
  onOpenTrip = null,
}) {
  return (
    <View style={styles.historySection}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Recent Trips</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {recentTrips.length > 0 ? (
        recentTrips.map((trip) => (
          <TouchableOpacity
            key={trip.id}
            onPress={onOpenTrip ? () => onOpenTrip(trip) : undefined}
            activeOpacity={onOpenTrip ? 0.85 : 1}
            disabled={!onOpenTrip}
          >
            <View style={styles.tripCard}>
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

              {(trip.distance || trip.duration) ? (
                <View style={styles.tripStats}>
                  {trip.distance ? (
                    <View style={styles.tripStatItem}>
                      <Ionicons name="car" size={12} color={colors.text.subtle} />
                      <Text style={styles.tripStatText}>{trip.distance}</Text>
                    </View>
                  ) : null}
                  {trip.duration ? (
                    <View style={styles.tripStatItem}>
                      <Ionicons name="time" size={12} color={colors.text.subtle} />
                      <Text style={styles.tripStatText}>{trip.duration}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyTripsState}>
          <Ionicons name="file-tray-outline" size={28} color={colors.border.strong} />
          <Text style={styles.emptyTripsTitle}>No completed trips yet</Text>
        </View>
      )}
    </View>
  );
}
