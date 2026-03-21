import React, { memo } from 'react';
import { Alert, Animated, FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../styles/theme';
import { getDisplayPhotos, getScheduledLabel } from './requestModalUtils';
import {
  firstNonEmptyString,
  resolveCustomerAvatarFromRequest,
  resolveCustomerNameFromRequest,
  resolveCustomerRatingFromRequest,
} from '../../utils/participantIdentity';
import { TRIP_STATUS, normalizeTripStatus } from '../../constants/tripStatus';

function RequestCard({
  item,
  index,
  selectedIndex,
  styles,
  timers,
  onMessage,
  onAccept,
  onViewDetails,
}) {
  const isSelected = index === selectedIndex;
  const displayPhotos = getDisplayPhotos(item);
  const earnings = item.driverPayout || item.earnings || item.price || '$0.00';
  const hasScheduledTime = Boolean(item.scheduledTime);
  const scheduledLabel = getScheduledLabel(item.scheduledTime);
  const timerValue = timers[item.id];
  const shouldShowTimer = Boolean(timerValue) && !hasScheduledTime;
  const customerName = resolveCustomerNameFromRequest(item, 'Customer');
  const customerAvatarUrl = firstNonEmptyString(
    resolveCustomerAvatarFromRequest(item),
    typeof item?.customer?.photo === 'string' ? item.customer.photo : item?.customer?.photo?.uri,
    item?.customerAvatarUrl
  );
  const customerRating = resolveCustomerRatingFromRequest(item);
  const customerRatingLabel = Number.isFinite(customerRating)
    ? (Math.round(customerRating * 100) / 100).toString()
    : 'No ratings yet';
  const isAcceptedRequest = normalizeTripStatus(item?.status) === TRIP_STATUS.ACCEPTED;
  const acceptButtonLabel = isAcceptedRequest ? 'Accepted' : 'Accept';

  const handleViewDetails = () => {
    if (typeof onViewDetails === 'function') {
      onViewDetails(item);
      return;
    }

    const details = [
      `Pickup: ${item.pickup?.address || 'Not specified'}`,
      `Drop-off: ${item.dropoff?.address || 'Not specified'}`,
      hasScheduledTime ? `Scheduled: ${scheduledLabel}` : 'Type: ASAP',
    ].join('\n');

    Alert.alert('Request Details', details);
  };

  return (
    <Animated.View style={[styles.card, isSelected && styles.selectedCard]}>
      <LinearGradient
        colors={[colors.background.elevated, colors.background.panel]}
        style={styles.cardGradient}
      >
        <View style={styles.cardHeader}>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>{earnings}</Text>
            {(item.time || item.distance) && (
              <Text style={styles.timeDistance}>{[item.time, item.distance].filter(Boolean).join(' · ')}</Text>
            )}
            {item.vehicle?.type && (
              <View style={styles.vehicleTag}>
                <Ionicons name="car-outline" size={14} color={colors.warning} />
                <Text style={styles.vehicleType}>{item.vehicle.type}</Text>
              </View>
            )}
            {hasScheduledTime && (
              <View style={styles.scheduledTag}>
                <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                <Text style={styles.scheduledTagText}>{scheduledLabel}</Text>
              </View>
            )}
          </View>
          {shouldShowTimer && (
            <View style={styles.timerContainer}>
              <Ionicons name="timer-outline" size={16} color={colors.success} />
              <Text style={[styles.timerText, timerValue === 'Expired' && styles.expiredTimer]}>{timerValue}</Text>
            </View>
          )}
        </View>

        {(item.item?.type || item.item?.needsHelp) && (
          <View style={styles.typeContainer}>
            {item.item?.type && (
              <View style={styles.typeTag}>
                <Ionicons name="cube-outline" size={14} color={colors.primary} />
                <Text style={styles.itemType}>{item.item.type}</Text>
              </View>
            )}
            {item.item?.needsHelp && (
              <View style={styles.helpBadge}>
                <Ionicons name="hand-left-outline" size={12} color={colors.white} />
                <Text style={styles.helpText}>Help Needed</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.routeContainer}>
          <View style={styles.routePoints}>
            <View style={styles.routePoint}>
              <View style={styles.pickupDot} />
              <View style={styles.routePointContent}>
                <Text style={styles.pointLabel}>Pickup</Text>
                <Text style={styles.pointAddress} numberOfLines={1}>
                  {item.pickup?.address || 'Pickup location'}
                </Text>
              </View>
            </View>

            <View style={styles.routeLine} />

            <View style={styles.routePoint}>
              <View style={styles.dropoffDot} />
              <View style={styles.routePointContent}>
                <Text style={styles.pointLabel}>Drop-off</Text>
                <Text style={styles.pointAddress} numberOfLines={1}>
                  {item.dropoff?.address || 'Dropoff location'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {displayPhotos.length > 0 && (
          <View style={styles.photosContainer}>
            <Text style={styles.photosLabel}>Customer Photos</Text>
            <FlatList
              data={displayPhotos}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(photo, idx) => photo.id || idx.toString()}
              renderItem={({ item: photo }) => {
                const src =
                  typeof photo === 'string'
                    ? { uri: photo }
                    : photo?.url
                      ? { uri: photo.url }
                      : photo?.uri
                        ? { uri: photo.uri }
                        : null;

                if (!src) {
                  return null;
                }

                return (
                  <View style={styles.photoContainer}>
                    <Image source={src} style={styles.customerOrderPhoto} resizeMode="cover" />
                  </View>
                );
              }}
              contentContainerStyle={styles.photosList}
            />
          </View>
        )}

        <View style={styles.customerSection}>
          <View style={styles.customerInfo}>
            {customerAvatarUrl ? (
              <Image source={{ uri: customerAvatarUrl }} style={styles.customerPhoto} />
            ) : (
              <View style={styles.customerPhotoPlaceholder}>
                <Ionicons name="person" size={20} color={colors.text.muted} />
              </View>
            )}
            <View>
              <Text style={styles.customerName}>{customerName}</Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={12} color={colors.gold} />
                <Text style={styles.rating}>{customerRatingLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {!hasScheduledTime && (
            <TouchableOpacity
              style={styles.messageButton}
              onPress={() => onMessage && onMessage(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.detailsButton} onPress={handleViewDetails} activeOpacity={0.8}>
            <Text style={styles.detailsButtonText}>View Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, isAcceptedRequest && styles.acceptButtonDisabled]}
            onPress={() => !isAcceptedRequest && onAccept && onAccept(item)}
            activeOpacity={isAcceptedRequest ? 1 : 0.85}
            disabled={isAcceptedRequest}
          >
            <Text style={[styles.acceptButtonText, isAcceptedRequest && styles.acceptButtonTextDisabled]}>
              {acceptButtonLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

export default memo(RequestCard);
