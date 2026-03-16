// Request Cards Section component: renders its UI and handles related interactions.
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../styles/theme';
import { CARD_WIDTH } from './requestModalUtils';

export default function RequestCardsSection({
  loading,
  error,
  requests,
  onRefresh,
  flatListRef,
  renderRequestCard,
  onScroll,
  styles,
}) {
  return (
    <View style={styles.cardsContainer}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finding available requests...</Text>
        </View>
      ) : error && requests.length === 0 ? (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={64} color={colors.secondary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : requests.length > 0 ? (
        <FlatList
          ref={flatListRef}
          data={requests}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + spacing.lg}
          snapToAlignment="center"
          decelerationRate="fast"
          directionalLockEnabled
          scrollEnabled={requests.length > 1}
          bounces={false}
          alwaysBounceHorizontal={false}
          alwaysBounceVertical={false}
          contentContainerStyle={styles.cardsList}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRequestCard}
          onScroll={onScroll}
          scrollEventThrottle={16}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="location-outline" size={64} color={colors.text.subtle} />
          <Text style={styles.emptyStateTitle}>No requests available</Text>
          <Text style={styles.emptyStateSubtitle}>
            New requests will appear here when customers need pickups
          </Text>
        </View>
      )}
    </View>
  );
}
