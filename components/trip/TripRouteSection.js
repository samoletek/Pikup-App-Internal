// Trip Route Section component: renders its UI and handles related interactions.
import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../styles/theme';

const ROUTE_ICON_SIZE = typography.fontSize.md;

export default function TripRouteSection({ displayTrip, ui }) {
  return (
    <View style={ui.sectionCard}>
      <Text style={ui.sectionTitle}>Route</Text>
      <View style={ui.routeRow}>
        <Ionicons
          name="arrow-up-circle-outline"
          size={ROUTE_ICON_SIZE}
          color={colors.primary}
        />
        <Text style={ui.routeText}>{displayTrip.pickupAddress}</Text>
      </View>
      <View style={ui.routeDivider} />
      <View style={ui.routeRow}>
        <Ionicons
          name="arrow-down-circle-outline"
          size={ROUTE_ICON_SIZE}
          color={colors.success}
        />
        <Text style={ui.routeText}>{displayTrip.dropoffAddress}</Text>
      </View>
    </View>
  );
}
