import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import MapboxMap from './mapbox/MapboxMap';
import Mapbox from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import { resolveDriverPayoutLabel } from '../services/PricingDisplay';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;
const CARD_HEIGHT = height * 0.35;
const TIMER_DEFAULT = '4:00';

export default function RequestModal({
  visible,
  requests = [],
  selectedRequest,
  currentLocation,
  loading = false,
  error = null,
  onClose,
  onAccept,
  onViewDetails,
  onMessage,
  onRefresh
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [timers, setTimers] = useState({});
  const [showMap, setShowMap] = useState(true);
  const flatListRef = useRef(null);
  const mapRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const timerInterval = useRef(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (selectedRequest && requests.length > 0) {
      const index = requests.findIndex(r => r.id === selectedRequest.id);
      if (index !== -1) {
        setSelectedIndex(index);
        if (flatListRef.current) {
          setTimeout(() => {
            flatListRef.current.scrollToIndex({
              index,
              animated: true,
              viewPosition: 0.5
            });
          }, 100);
        }
      }
    }
  }, [selectedRequest, requests]);

  useEffect(() => {
    if (showMap && requests.length > 0 && mapRef.current) {
      const currentRequest = requests[selectedIndex];
      if (currentRequest?.pickup?.coordinates) {
        mapRef.current?.setCamera({
          centerCoordinate: [
            currentRequest.pickup.coordinates.longitude,
            currentRequest.pickup.coordinates.latitude
          ],
          zoomLevel: 11,
          animationDuration: 500
        });
      }
    }
  }, [selectedIndex, showMap, requests]);

  useEffect(() => {
    if (visible && requests.length > 0) {
      timerInterval.current = setInterval(() => {
        updateTimers();
      }, 1000);
      updateTimers();
    } else {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    }

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    };
  }, [visible, requests]);

  const updateTimers = () => {
    const newTimers = {};
    const now = new Date();

    requests.forEach(request => {
      if (request.expiresAt) {
        const expiryTime = new Date(request.expiresAt);
        const timeLeft = Math.max(0, expiryTime - now);

        if (timeLeft > 0) {
          const minutes = Math.floor(timeLeft / (1000 * 60));
          const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
          newTimers[request.id] = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
          newTimers[request.id] = 'Expired';
        }
      } else {
        newTimers[request.id] = TIMER_DEFAULT;
      }
    });

    setTimers(newTimers);
  };

  const handleScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / (CARD_WIDTH + spacing.lg));
    setSelectedIndex(index);
  };

  const getDisplayPhotos = (item) => {
    if (Array.isArray(item.photos)) return item.photos;
    if (Array.isArray(item.item?.photos)) return item.item.photos;
    return [];
  };

  const renderRequestCard = ({ item, index }) => {
    const isSelected = index === selectedIndex;
    const displayPhotos = getDisplayPhotos(item);
    const earnings = resolveDriverPayoutLabel(item);
    const hasScheduledTime = Boolean(item.scheduledTime);
    const scheduledLabel = hasScheduledTime
      ? new Date(item.scheduledTime).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : null;

    return (
      <Animated.View style={[
        styles.card,
        isSelected && styles.selectedCard
      ]}>
        <LinearGradient
          colors={[colors.background.elevated, colors.background.panel]}
          style={styles.cardGradient}
        >
          {/* Header with Price and Timer */}
          <View style={styles.cardHeader}>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>{earnings}</Text>
              {(item.time || item.distance) && (
                <Text style={styles.timeDistance}>
                  {[item.time, item.distance].filter(Boolean).join(' · ')}
                </Text>
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
            <View style={styles.timerContainer}>
              <Ionicons name="timer-outline" size={16} color={colors.success} />
              <Text style={[
                styles.timerText,
                timers[item.id] === 'Expired' && styles.expiredTimer
              ]}>
                {timers[item.id] || TIMER_DEFAULT}
              </Text>
            </View>
          </View>

          {/* Item Type Badge */}
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

          {/* Route Information */}
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

          {/* Customer Photos */}
          {displayPhotos.length > 0 && (
            <View style={styles.photosContainer}>
              <Text style={styles.photosLabel}>Customer Photos</Text>
              <FlatList
                data={displayPhotos}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(photo, idx) => photo.id || idx.toString()}
                renderItem={({ item: photo }) => {
                  const src = typeof photo === 'string'
                    ? { uri: photo }
                    : photo?.url
                      ? { uri: photo.url }
                      : photo?.uri
                        ? { uri: photo.uri }
                        : null;

                  if (!src) return null;

                  return (
                    <View style={styles.photoContainer}>
                      <Image
                        source={src}
                        style={styles.customerOrderPhoto}
                        resizeMode="cover"
                      />
                    </View>
                  );
                }}
                contentContainerStyle={styles.photosList}
              />
            </View>
          )}

          {/* Customer Info */}
          <View style={styles.customerSection}>
            <View style={styles.customerInfo}>
              <Image
                source={
                  item.customer?.photo
                    ? { uri: typeof item.customer.photo === 'string' ? item.customer.photo : item.customer.photo.uri }
                    : require('../assets/profile.png')
                }
                style={styles.customerPhoto}
              />
              <View>
                <Text style={styles.customerName}>
                  {item.customer?.name || item.customerName || 'Customer'}
                </Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={12} color={colors.gold} />
                  <Text style={styles.rating}>{item.customer?.rating || '5.0'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.messageButton}
              onPress={() => onMessage && onMessage(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.detailsButton}
              onPress={() => onViewDetails && onViewDetails(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.detailsButtonText}>View Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => onAccept && onAccept(item)}
              activeOpacity={0.8}
            >
              <View style={styles.acceptButtonInner}>
                <Text style={styles.acceptButtonText}>Accept</Text>
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />

      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.backdropOverlay} />
      </TouchableOpacity>

      {/* Modal Content */}
      <Animated.View
        style={[
          styles.modalContainer,
          {
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.modalHandle} />
          <View style={styles.headerContent}>
            <Text style={styles.modalTitle}>Available Requests</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>

          {/* Request Count */}
          <View style={styles.countContainer}>
            <Text style={styles.countText}>
              {requests.length} request{requests.length !== 1 ? 's' : ''} nearby
            </Text>
          </View>
        </View>

        {/* Collapsible Map */}
        {showMap && (
          <View style={styles.mapContainer}>
            <MapboxMap
              ref={mapRef}
              style={styles.modalMap}
              centerCoordinate={currentLocation ? [
                currentLocation.longitude,
                currentLocation.latitude
              ] : [-84.3880, 33.7490]}
              zoomLevel={11}
              customMapStyle={Mapbox.StyleURL.Dark}
            >
              {/* Current location marker */}
              {currentLocation && (
                <Mapbox.PointAnnotation
                  id="currentLocation"
                  coordinate={[currentLocation.longitude, currentLocation.latitude]}
                >
                  <View style={styles.currentLocationMarker}>
                    <View style={styles.currentLocationDot} />
                  </View>
                </Mapbox.PointAnnotation>
              )}

              {/* Request markers */}
              {requests.map((request, index) => (
                <Mapbox.PointAnnotation
                  key={request.id}
                  id={request.id}
                  coordinate={[request.pickup.coordinates.longitude, request.pickup.coordinates.latitude]}
                  onSelected={() => {
                    setSelectedIndex(index);
                    if (flatListRef.current) {
                      flatListRef.current.scrollToIndex({
                        index,
                        animated: true,
                        viewPosition: 0.5
                      });
                    }
                  }}
                >
                  <View style={[
                    styles.markerContainer,
                    selectedIndex === index && styles.selectedMarker
                  ]}>
                    <Text style={styles.markerPrice}>{resolveDriverPayoutLabel(request)}</Text>
                    <View style={styles.markerArrow} />
                  </View>
                </Mapbox.PointAnnotation>
              ))}
            </MapboxMap>

            {/* Map toggle button */}
            <TouchableOpacity
              style={styles.mapToggle}
              onPress={() => setShowMap(!showMap)}
            >
              <Ionicons name="chevron-up" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        )}

        {/* Map toggle button when map is hidden */}
        {!showMap && (
          <TouchableOpacity
            style={styles.showMapButton}
            onPress={() => setShowMap(true)}
          >
            <Ionicons name="map" size={20} color={colors.primary} />
            <Text style={styles.showMapText}>Show Map</Text>
          </TouchableOpacity>
        )}

        {/* Cards */}
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
              contentContainerStyle={styles.cardsList}
              keyExtractor={(item) => item.id}
              renderItem={renderRequestCard}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl refreshing={loading} onRefresh={onRefresh} />
              }
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

        {/* Page Indicators */}
        {requests.length > 1 && (
          <View style={styles.pageIndicators}>
            {requests.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.pageIndicator,
                  index === selectedIndex && styles.activePageIndicator
                ]}
              />
            ))}
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlayDark,
  },
  backdropOverlay: {
    flex: 1,
    backgroundColor: colors.transparent,
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: height * 0.8,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.base,
  },
  modalHeader: {
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.strong,
    paddingBottom: spacing.base,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    color: colors.white,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  closeButton: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: spacing.base,
    backgroundColor: colors.overlayPrimarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countContainer: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    alignSelf: 'flex-start',
  },
  countText: {
    color: colors.success,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  cardsContainer: {
    flex: 1,
    paddingVertical: spacing.lg,
  },
  cardsList: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginRight: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  selectedCard: {
    transform: [{ scale: 1.02 }],
  },
  cardGradient: {
    flex: 1,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.base,
  },
  priceContainer: {
    flex: 1,
  },
  price: {
    color: colors.white,
    fontSize: typography.fontSize.xxl + 4,
    fontWeight: typography.fontWeight.bold,
  },
  timeDistance: {
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
    marginTop: spacing.xs,
  },
  vehicleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  vehicleType: {
    color: colors.warning,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.xs,
  },
  scheduledTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  scheduledTagText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.xs,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  timerText: {
    color: colors.success,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.xs,
  },
  expiredTimer: {
    color: colors.secondary,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
  },
  itemType: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.xs,
  },
  helpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  helpText: {
    color: colors.white,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.xs - 1,
  },
  routeContainer: {
    flex: 1,
    marginBottom: spacing.base,
  },
  routePoints: {
    flex: 1,
    justifyContent: 'space-between',
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginRight: spacing.md,
  },
  dropoffDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    marginRight: spacing.md,
  },
  routePointContent: {
    flex: 1,
  },
  pointLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginBottom: 2,
  },
  pointAddress: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  routeLine: {
    position: 'absolute',
    left: 6,
    top: 18,
    bottom: 18,
    width: 1,
    backgroundColor: colors.border.light,
  },
  customerSection: {
    marginBottom: spacing.lg,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.overlayPrimarySoft,
    backgroundColor: colors.background.input,
  },
  customerName: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    color: colors.gold,
    fontSize: typography.fontSize.base,
    marginLeft: spacing.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  messageButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  detailsButton: {
    backgroundColor: colors.overlayPrimarySoft,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
  },
  detailsButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  acceptButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  acceptButtonInner: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
  },
  acceptButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  emptyStateTitle: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
  },
  emptyStateSubtitle: {
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 20,
  },
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.base,
  },
  pageIndicator: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: spacing.xs,
    backgroundColor: colors.overlayPrimarySoft,
    marginHorizontal: spacing.xs,
  },
  activePageIndicator: {
    backgroundColor: colors.success,
    width: spacing.lg,
  },
  // Map styles
  mapContainer: {
    height: 200,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  modalMap: {
    height: 200,
    width: '100%',
  },
  mapToggle: {
    position: 'absolute',
    bottom: spacing.sm + 2,
    right: spacing.sm + 2,
    backgroundColor: colors.overlayDark,
    padding: spacing.sm,
    borderRadius: borderRadius.xl,
  },
  showMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  showMapText: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  // Marker styles
  markerContainer: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  selectedMarker: {
    backgroundColor: colors.primary,
    borderColor: colors.white,
    transform: [{ scale: 1.1 }],
  },
  markerPrice: {
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.sm,
  },
  markerArrow: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    backgroundColor: colors.transparent,
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: colors.transparent,
    borderRightColor: colors.transparent,
    borderTopColor: colors.background.tertiary,
  },
  currentLocationMarker: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: spacing.md,
    backgroundColor: colors.overlayPrimarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.info,
    borderWidth: 2,
    borderColor: colors.white,
  },
  // Photos styles
  photosContainer: {
    marginBottom: spacing.base,
  },
  photosLabel: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  photosList: {
    paddingRight: spacing.base,
  },
  photoContainer: {
    marginRight: spacing.sm,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  customerOrderPhoto: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.sm,
  },
  // Loading and error styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  loadingText: {
    color: colors.white,
    marginTop: spacing.base,
    fontSize: typography.fontSize.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    color: colors.white,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    fontSize: typography.fontSize.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
});
