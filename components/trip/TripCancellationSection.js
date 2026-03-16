// Trip Cancellation Section component: renders its UI and handles related interactions.
import React from 'react';
import { Text, View } from 'react-native';
import {
  formatDateTime,
  formatReason,
} from '../../utils/tripDetails/formatStatusUtils';

export default function TripCancellationSection({ displayTrip, ui }) {
  return (
    <View style={ui.sectionCard}>
      <Text style={ui.sectionTitle}>Cancellation</Text>
      <View style={ui.infoRow}>
        <Text style={ui.infoLabel}>Reason</Text>
        <Text style={ui.infoValue}>
          {formatReason(displayTrip.cancellationReason)}
        </Text>
      </View>
      <View style={ui.infoRow}>
        <Text style={ui.infoLabel}>Cancelled At</Text>
        <Text style={ui.infoValue}>{formatDateTime(displayTrip.cancelledAt)}</Text>
      </View>
    </View>
  );
}
