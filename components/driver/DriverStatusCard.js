// Driver Status Card component: renders its UI and handles related interactions.
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DriverStatusCard({ statusConfig, ui }) {
  return (
    <TouchableOpacity
      activeOpacity={statusConfig.onPress ? 0.8 : 1}
      disabled={!statusConfig.onPress}
      style={[
        ui.statusCard,
        {
          backgroundColor: statusConfig.backgroundColor,
          borderColor: statusConfig.borderColor,
        },
      ]}
      onPress={statusConfig.onPress}
    >
      <View style={ui.statusLeft}>
        <Ionicons name={statusConfig.icon} size={22} color={statusConfig.iconColor} />
        <View style={ui.statusText}>
          <Text style={ui.statusTitle}>{statusConfig.title}</Text>
          <Text style={ui.statusSubtitle}>{statusConfig.subtitle}</Text>
        </View>
      </View>

      {statusConfig.ctaLabel ? (
        <View style={ui.statusCta}>
          <Text style={ui.statusCtaText}>{statusConfig.ctaLabel}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
