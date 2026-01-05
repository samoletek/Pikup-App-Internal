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

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;
const CARD_HEIGHT = height * 0.35; // Increased for photos

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
      // Slide up animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      // Slide down animation
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

  // Animate map to selected request when carousel changes
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

  // Timer management
  useEffect(() => {
    if (visible && requests.length > 0) {
      // Start timer interval
      timerInterval.current = setInterval(() => {
        updateTimers();
      }, 1000);

      // Initial timer calculation
      updateTimers();
    } else {
      // Clear timer when modal is hidden
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
        newTimers[request.id] = '4:00'; // Default 4 minutes
      }
    });

    setTimers(newTimers);
  };

  const handleScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / (CARD_WIDTH + 20));
    setSelectedIndex(index);
  };

  const renderRequestCard = ({ item, index }) => {
    const isSelected = index === selectedIndex;
    
    return (
      <Animated.View style={[
        styles.card,
        isSelected && styles.selectedCard
      ]}>
        <LinearGradient
          colors={['rgba(26, 26, 46, 0.98)', 'rgba(30, 30, 56, 0.98)']}
          style={styles.cardGradient}
        >
          {/* Header with Price and Timer */}
          <View style={styles.cardHeader}>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>{item.price}</Text>
              <Text style={styles.timeDistance}>{item.time} • {item.distance}</Text>
              {item.vehicle?.type && (
                <View style={styles.vehicleTag}>
                  <Ionicons name="car-outline" size={14} color="#FFB800" />
                  <Text style={styles.vehicleType}>{item.vehicle.type}</Text>
                </View>
              )}
            </View>
            <View style={styles.timerContainer}>
              <Ionicons name="timer-outline" size={16} color="#00D4AA" />
              <Text style={[
                styles.timerText,
                timers[item.id] === 'Expired' && styles.expiredTimer
              ]}>
                {timers[item.id] || '4:00'}
              </Text>
            </View>
          </View>

          {/* Item Type Badge */}
          <View style={styles.typeContainer}>
            <View style={styles.typeTag}>
              <Ionicons name="cube-outline" size={14} color="#A77BFF" />
              <Text style={styles.itemType}>{item.item.type}</Text>
            </View>
            {item.item.needsHelp && (
              <View style={styles.helpBadge}>
                <Ionicons name="hand-left-outline" size={12} color="#fff" />
                <Text style={styles.helpText}>Help Needed</Text>
              </View>
            )}
          </View>

          {/* Route Information */}
          <View style={styles.routeContainer}>
            <View style={styles.routePoints}>
              <View style={styles.routePoint}>
                <View style={styles.pickupDot} />
                <View style={styles.routePointContent}>
                  <Text style={styles.pointLabel}>Pickup</Text>
                  <Text style={styles.pointAddress} numberOfLines={1}>
                    {item.pickup.address}
                  </Text>
                </View>
              </View>
              
              <View style={styles.routeLine} />
              
              <View style={styles.routePoint}>
                <View style={styles.dropoffDot} />
                <View style={styles.routePointContent}>
                  <Text style={styles.pointLabel}>Drop-off</Text>
                  <Text style={styles.pointAddress} numberOfLines={1}>
                    {item.dropoff.address}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Customer Photos */}
          {item.photos && item.photos.length > 0 && (
            <View style={styles.photosContainer}>
              <Text style={styles.photosLabel}>Customer Photos</Text>
              <FlatList
                data={item.photos}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(photo, index) => photo.id || index.toString()}
                renderItem={({ item: photo }) => (
                  <TouchableOpacity
                    style={styles.photoContainer}
                    onPress={() => {/* Could add full screen view later */}}
                  >
                    <Image 
                      source={{ uri: photo.url }} 
                      style={styles.customerOrderPhoto}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.photosList}
              />
            </View>
          )}

          {/* Customer Info */}
          <View style={styles.customerSection}>
            <View style={styles.customerInfo}>
              <Image source={item.customer.photo} style={styles.customerPhoto} />
              <View>
                <Text style={styles.customerName}>{item.customer.name}</Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={12} color="#FFD700" />
                  <Text style={styles.rating}>{item.customer.rating}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.messageButton}
              onPress={() => onMessage && onMessage(item)}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#A77BFF" />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.detailsButton}
              onPress={() => onViewDetails && onViewDetails(item)}
            >
              <Text style={styles.detailsButtonText}>View Details</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.acceptButton}
              onPress={() => onAccept && onAccept(item)}
            >
              <LinearGradient
                colors={['#00D4AA', '#00B894']}
                style={styles.acceptButtonGradient}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </LinearGradient>
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
              <Ionicons name="close" size={24} color="#fff" />
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
                    <Text style={styles.markerPrice}>{request.price}</Text>
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
              <Ionicons name="chevron-up" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Map toggle button when map is hidden */}
        {!showMap && (
          <TouchableOpacity 
            style={styles.showMapButton}
            onPress={() => setShowMap(true)}
          >
            <Ionicons name="map" size={20} color="#A77BFF" />
            <Text style={styles.showMapText}>Show Map</Text>
          </TouchableOpacity>
        )}

        {/* Cards */}
        <View style={styles.cardsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#A77BFF" />
              <Text style={styles.loadingText}>Finding available requests...</Text>
            </View>
          ) : error && requests.length === 0 ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={64} color="#ff6b6b" />
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
              snapToInterval={CARD_WIDTH + 20}
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
              <Ionicons name="location-outline" size={64} color="#666" />
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdropOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0A0A1F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalHeader: {
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countContainer: {
    backgroundColor: 'rgba(0, 212, 170, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  countText: {
    color: '#00D4AA',
    fontSize: 14,
    fontWeight: '600',
  },
  cardsContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  cardsList: {
    paddingHorizontal: 20,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginRight: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  selectedCard: {
    transform: [{ scale: 1.02 }],
  },
  cardGradient: {
    flex: 1,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  priceContainer: {
    flex: 1,
  },
  price: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  timeDistance: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  vehicleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 184, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  vehicleType: {
    color: '#FFB800',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 170, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerText: {
    color: '#00D4AA',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  expiredTimer: {
    color: '#ff6b6b',
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(167, 123, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  itemType: {
    color: '#A77BFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  helpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D4AA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  helpText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 3,
  },
  routeContainer: {
    flex: 1,
    marginBottom: 16,
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
    backgroundColor: '#A77BFF',
    marginRight: 12,
  },
  dropoffDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00D4AA',
    marginRight: 12,
  },
  routePointContent: {
    flex: 1,
  },
  pointLabel: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 2,
  },
  pointAddress: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  routeLine: {
    position: 'absolute',
    left: 6,
    top: 18,
    bottom: 18,
    width: 1,
    backgroundColor: '#444',
  },
  customerSection: {
    marginBottom: 20,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  customerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    color: '#FFD700',
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(167, 123, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  messageButtonText: {
    color: '#A77BFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  detailsButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  detailsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  acceptButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  pageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 4,
  },
  activePageIndicator: {
    backgroundColor: '#00D4AA',
    width: 20,
  },
  // Map styles
  mapContainer: {
    height: 200,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  modalMap: {
    height: 200,
    width: '100%',
  },
  mapToggle: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 20,
  },
  showMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 123, 255, 0.2)',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  showMapText: {
    color: '#A77BFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Marker styles
  markerContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  selectedMarker: {
    backgroundColor: '#A77BFF',
    borderColor: '#fff',
    transform: [{ scale: 1.1 }],
  },
  markerPrice: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  markerArrow: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1a1a2e',
  },
  currentLocationMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4285F4',
    borderWidth: 2,
    borderColor: '#fff',
  },
  // Photos styles
  photosContainer: {
    marginBottom: 16,
  },
  photosLabel: {
    color: '#A77BFF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  photosList: {
    paddingRight: 16,
  },
  photoContainer: {
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  customerOrderPhoto: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  // Loading and error styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: '#A77BFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});