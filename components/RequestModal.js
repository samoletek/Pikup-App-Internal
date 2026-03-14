import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  FlatList,
  Image,
  Modal,
  StatusBar,
  ActivityIndicator,
  Alert
} from 'react-native';
import MapboxMap from './mapbox/MapboxMap';
import Mapbox from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '../styles/theme';
import styles from './RequestModal.styles';
import { appConfig } from '../config/appConfig';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;
const MODAL_DISMISS_DRAG_THRESHOLD = 80;

const isScheduledRequest = (request = {}) =>
  Boolean(
    request?.scheduledTime ||
    request?.scheduled_time ||
    request?.dispatchRequirements?.scheduleType === 'scheduled' ||
    request?.dispatch_requirements?.scheduleType === 'scheduled'
  );

const shouldRenderRequestTimer = (request = {}) =>
  !isScheduledRequest(request) && Boolean(request?.expiresAt);

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
  const dragTranslateY = useRef(new Animated.Value(0)).current;
  const timerInterval = useRef(null);
  const routeRequestIdRef = useRef(null);
  const routeCacheRef = useRef(new Map());
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedRouteMarkers, setSelectedRouteMarkers] = useState(null);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        dragTranslateY.setValue(Math.max(0, gestureState.dy));
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldDismiss =
          gestureState.dy >= MODAL_DISMISS_DRAG_THRESHOLD || gestureState.vy > 1.2;

        if (shouldDismiss) {
          Animated.timing(dragTranslateY, {
            toValue: height,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            dragTranslateY.setValue(0);
            onClose?.();
          });
          return;
        }

        Animated.spring(dragTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 12,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 12,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      dragTranslateY.setValue(0);
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
      setSelectedRoute(null);
      setSelectedRouteMarkers(null);
      routeRequestIdRef.current = null;
    }
  }, [visible, dragTranslateY, slideAnim]);

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
    if (!visible || !showMap || requests.length === 0) {
      setSelectedRoute(null);
      setSelectedRouteMarkers(null);
      routeRequestIdRef.current = null;
      return;
    }

    const currentRequest = requests[selectedIndex];
    const pickup = currentRequest?.pickup?.coordinates;
    const dropoff = currentRequest?.dropoff?.coordinates;
    if (!pickup || !dropoff) {
      setSelectedRoute(null);
      setSelectedRouteMarkers(null);
      routeRequestIdRef.current = null;
      return;
    }

    const pickupPoint = [pickup.longitude, pickup.latitude];
    const dropoffPoint = [dropoff.longitude, dropoff.latitude];
    const fallbackRouteFeature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [pickupPoint, dropoffPoint],
      },
    };

    const requestId = String(currentRequest?.id || '');
    routeRequestIdRef.current = requestId;
    setSelectedRouteMarkers({ pickup: pickupPoint, dropoff: dropoffPoint });
    const cachedRoute = routeCacheRef.current.get(requestId);
    setSelectedRoute(cachedRoute || fallbackRouteFeature);

    if (mapRef.current) {
      const centerLongitude = (pickup.longitude + dropoff.longitude) / 2;
      const centerLatitude = (pickup.latitude + dropoff.latitude) / 2;
      mapRef.current.setCamera({
        centerCoordinate: [centerLongitude, centerLatitude],
        zoomLevel: 11.5,
        animationDuration: 500,
      });
    }

    const token = appConfig.mapbox.publicToken;
    if (!token) {
      return;
    }

    let cancelled = false;
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickup.longitude},${pickup.latitude};${dropoff.longitude},${dropoff.latitude}?geometries=geojson&overview=full&access_token=${token}`;

    const fetchRoute = async () => {
      try {
        const response = await fetch(directionsUrl);
        const data = await response.json();
        const geometry = data?.routes?.[0]?.geometry;
        if (!geometry || cancelled) {
          return;
        }
        if (routeRequestIdRef.current !== requestId) {
          return;
        }
        const resolvedRoute = {
          type: 'Feature',
          properties: {},
          geometry,
        };
        routeCacheRef.current.set(requestId, resolvedRoute);
        setSelectedRoute(resolvedRoute);
      } catch (_error) {
        // Keep the fallback straight line route when Directions API is unavailable.
      }
    };

    void fetchRoute();

    return () => {
      cancelled = true;
    };
  }, [visible, showMap, requests, selectedIndex]);

  const updateTimers = useCallback(() => {
    const newTimers = {};
    const now = new Date();

    requests.forEach(request => {
      if (!shouldRenderRequestTimer(request)) {
        return;
      }

      const expiryTime = new Date(request.expiresAt);
      const timeLeft = Math.max(0, expiryTime - now);

      if (timeLeft > 0) {
        const minutes = Math.floor(timeLeft / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        newTimers[request.id] = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      } else {
        newTimers[request.id] = 'Expired';
      }
    });

    setTimers(newTimers);
  }, [requests]);

  useEffect(() => {
    const hasTimedRequests = requests.some((request) => shouldRenderRequestTimer(request));

    if (visible && requests.length > 0 && hasTimedRequests) {
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
  }, [requests, updateTimers, visible]);

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
    const earnings = item.driverPayout || item.earnings || item.price || '$0.00';
    const hasScheduledTime = Boolean(item.scheduledTime);
    const scheduledLabel = hasScheduledTime
      ? new Date(item.scheduledTime).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
      : null;
    const timerValue = timers[item.id];
    const shouldShowTimer = Boolean(timerValue) && !hasScheduledTime;
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
            {shouldShowTimer && (
              <View style={styles.timerContainer}>
                <Ionicons name="timer-outline" size={16} color={colors.success} />
                <Text style={[
                  styles.timerText,
                  timerValue === 'Expired' && styles.expiredTimer
                ]}>
                  {timerValue}
                </Text>
              </View>
            )}
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

            <TouchableOpacity
              style={styles.detailsButton}
              onPress={handleViewDetails}
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
            transform: [{ translateY: Animated.add(slideAnim, dragTranslateY) }]
          }
        ]}
      >
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.handleArea} {...panResponder.panHandlers}>
            <View style={styles.modalHandle} />
          </View>
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
                <Mapbox.MarkerView
                  id="currentLocation"
                  coordinate={[currentLocation.longitude, currentLocation.latitude]}
                  anchor={{ x: 0.5, y: 0.5 }}
                  allowOverlap
                >
                  <View style={styles.currentLocationMarker}>
                    <View style={styles.currentLocationDot} />
                  </View>
                </Mapbox.MarkerView>
              )}

              {/* Selected request route */}
              {selectedRoute && (
                <Mapbox.ShapeSource id="scheduled-request-route-source" shape={selectedRoute}>
                  <Mapbox.LineLayer
                    id="scheduled-request-route-line"
                    style={{
                      lineColor: colors.primary,
                      lineWidth: 5,
                      lineCap: 'round',
                      lineJoin: 'round',
                      lineOpacity: 0.85,
                    }}
                  />
                </Mapbox.ShapeSource>
              )}

              {/* Selected route markers */}
              {selectedRouteMarkers?.pickup && (
                <Mapbox.MarkerView
                  id="scheduled-request-pickup"
                  coordinate={selectedRouteMarkers.pickup}
                  anchor={{ x: 0.5, y: 0.5 }}
                  allowOverlap
                >
                  <View style={[styles.routeMarkerCircle, { backgroundColor: colors.primaryDark }]} />
                </Mapbox.MarkerView>
              )}
              {selectedRouteMarkers?.dropoff && (
                <Mapbox.MarkerView
                  id="scheduled-request-dropoff"
                  coordinate={selectedRouteMarkers.dropoff}
                  anchor={{ x: 0.5, y: 0.5 }}
                  allowOverlap
                >
                  <View style={[styles.routeMarkerCircle, { backgroundColor: colors.success }]} />
                </Mapbox.MarkerView>
              )}

              {/* Request markers */}
              {requests.map((request, index) => (
                <Mapbox.MarkerView
                  key={request.id}
                  id={`request-marker-${request.id}`}
                  coordinate={[request.pickup.coordinates.longitude, request.pickup.coordinates.latitude]}
                  anchor={{ x: 0.5, y: 0.5 }}
                  allowOverlap
                >
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedIndex(index);
                      if (flatListRef.current) {
                        flatListRef.current.scrollToIndex({
                          index,
                          animated: true,
                          viewPosition: 0.5
                        });
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.markerCircle,
                        selectedIndex === index && styles.selectedMarkerCircle,
                      ]}
                    >
                      <View style={styles.markerCircleInner} />
                    </View>
                  </TouchableOpacity>
                </Mapbox.MarkerView>
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
              directionalLockEnabled
              scrollEnabled={requests.length > 1}
              bounces={false}
              alwaysBounceHorizontal={false}
              alwaysBounceVertical={false}
              contentContainerStyle={styles.cardsList}
              keyExtractor={(item) => item.id}
              renderItem={renderRequestCard}
              onScroll={handleScroll}
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
