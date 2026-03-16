// Navigation Screen State component: renders its UI and handles related interactions.
import React from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/theme';

export default function NavigationScreenState({
  isLoading,
  locationError,
  onRetry,
  ui,
  loadingText = 'Loading navigation...',
}) {
  if (isLoading) {
    return (
      <View style={ui.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={ui.loadingText}>{loadingText}</Text>
      </View>
    );
  }

  if (locationError) {
    return (
      <View style={ui.errorContainer}>
        <Ionicons name="warning" size={48} color={colors.error} />
        <Text style={ui.errorText}>{locationError}</Text>
        <TouchableOpacity
          style={ui.retryButton}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry navigation loading"
        >
          <Text style={ui.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}
