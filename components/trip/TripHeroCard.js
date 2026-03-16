// Trip Hero Card component: renders its UI and handles related interactions.
import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '../../styles/theme';

const STATUS_ICON_SIZE = typography.fontSize.sm + 2;

export default function TripHeroCard({ displayTrip, ui }) {
  return (
    <LinearGradient
      colors={[colors.background.panel, colors.background.tertiary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={ui.heroCard}
    >
      <View style={ui.heroTopRow}>
        <View
          style={[
            ui.statusChip,
            { backgroundColor: displayTrip.statusChipBackground },
          ]}
        >
          <Ionicons
            name={displayTrip.statusIcon}
            size={STATUS_ICON_SIZE}
            color={displayTrip.statusTextColor}
          />
          <Text style={[ui.statusChipText, { color: displayTrip.statusTextColor }]}>
            {displayTrip.statusLabel}
          </Text>
        </View>

        <Text style={ui.amountText}>{displayTrip.amountLabel}</Text>
      </View>

      <Text style={ui.heroDateText}>{displayTrip.createdLabel}</Text>
      <Text style={ui.heroIdText}>Trip ID: {displayTrip.idShort}</Text>
    </LinearGradient>
  );
}
