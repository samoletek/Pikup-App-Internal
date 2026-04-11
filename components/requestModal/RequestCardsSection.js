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
  mode = 'available',
  requests,
  onRefresh,
  flatListRef,
  renderRequestCard,
  onScroll,
  styles,
}) {
  const isAcceptedMode = mode === 'accepted';
  const isScheduledMode = mode === 'scheduled';
  const isVerticalList = isAcceptedMode || isScheduledMode;
  const loadingLabel = isAcceptedMode
    ? 'Loading accepted requests...'
    : isScheduledMode
      ? 'Loading scheduled requests...'
      : 'Finding available requests...';
  const emptyStateTitle = isAcceptedMode
    ? 'No accepted requests'
    : isScheduledMode
      ? 'No scheduled requests'
      : 'No requests available';
  const emptyStateSubtitle = isAcceptedMode
    ? 'Accepted scheduled trips will appear here'
    : isScheduledMode
      ? 'Scheduled pickup requests will appear here'
      : 'New requests will appear here when customers need pickups';

  return (
    <View style={[styles.cardsContainer, isVerticalList && styles.cardsContainerVertical]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{loadingLabel}</Text>
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
        isVerticalList ? (
          <FlatList
            key={`request-list-${mode}`}
            ref={flatListRef}
            style={styles.cardsListVerticalScroll}
            data={requests}
            showsVerticalScrollIndicator
            bounces
            alwaysBounceVertical={false}
            scrollEnabled
            nestedScrollEnabled
            overScrollMode="never"
            contentContainerStyle={[styles.cardsListVertical, styles.cardsListVerticalScrollable]}
            keyExtractor={(item, index) => String(item?.id || `request-${index}`)}
            renderItem={({ item, index }) => (
              <View>
                {renderRequestCard({ item, index })}
              </View>
            )}
            ListFooterComponent={<View style={styles.cardsListVerticalFooterSpacer} />}
          />
        ) : (
          <FlatList
            key={`request-list-${mode}`}
            ref={flatListRef}
            data={requests}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator
            snapToInterval={CARD_WIDTH + spacing.lg}
            snapToAlignment="center"
            decelerationRate="fast"
            directionalLockEnabled
            scrollEnabled={requests.length > 1}
            bounces
            alwaysBounceHorizontal
            contentContainerStyle={styles.cardsList}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderRequestCard}
            onScroll={onScroll}
            scrollEventThrottle={16}
          />
        )
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="location-outline" size={64} color={colors.text.subtle} />
          <Text style={styles.emptyStateTitle}>{emptyStateTitle}</Text>
          <Text style={styles.emptyStateSubtitle}>{emptyStateSubtitle}</Text>
        </View>
      )}
    </View>
  );
}
