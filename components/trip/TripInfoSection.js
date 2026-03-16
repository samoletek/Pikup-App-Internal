// Trip Info Section component: renders its UI and handles related interactions.
import React from 'react';
import { Text, View } from 'react-native';

export default function TripInfoSection({ rows, ui }) {
  return (
    <View style={ui.sectionCard}>
      <Text style={ui.sectionTitle}>Trip Information</Text>
      {rows.map((row) => (
        <View key={row.label} style={ui.infoRow}>
          <Text style={ui.infoLabel}>{row.label}</Text>
          <Text style={ui.infoValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}
