import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapboxMap from '../../components/mapbox/MapboxMap';
import Mapbox from '@rnmapbox/maps';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, borderRadius, typography } from '../../styles/theme';
import { TRIP_STATUS, normalizeTripStatus } from '../../constants/tripStatus';

const TERMINAL_TRIP_STATUSES = [TRIP_STATUS.COMPLETED, TRIP_STATUS.CANCELLED];
const IN_TRANSIT_TRIP_STATUSES = [
  TRIP_STATUS.IN_PROGRESS,
  TRIP_STATUS.ARRIVED_AT_PICKUP,
  TRIP_STATUS.PICKED_UP,
  TRIP_STATUS.EN_ROUTE_TO_DROPOFF
];

export default function CustomerActivityScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState('recent');
  const [fadeAnim] = useState(new Animated.Value(1));
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalTrips: 0, totalSpent: 0, avgRating: 0 });
  const [driverProfile, setDriverProfile] = useState(null);
  const [customerProfile, setCustomerProfile] = useState(null);
  
  // Get parameters from route if available (for demo mode)
  const { requestId, status, request, driverLocation, pickupPhotos } = route.params || {};
  const normalizedRouteStatus = normalizeTripStatus(status);
  
  // Get AuthContext
  const { getUserPickupRequests, currentUser, getUserProfile } = useAuth();
  const currentUserId = currentUser?.id || currentUser?.uid;
  
  // If we have a requestId and status, we're in an active trip
  const hasTripInRoute = !!requestId && !!status;
  const isActiveTrip = hasTripInRoute && !TERMINAL_TRIP_STATUSES.includes(normalizedRouteStatus);
  
  // Load driver profile when we have an active trip
  useEffect(() => {
    if (request?.assignedDriverId && !driverProfile) {
      const loadDriverProfile = async () => {
        try {
          const profile = await getUserProfile(request.assignedDriverId);
          setDriverProfile(profile);
        } catch (error) {
          console.error('Error loading driver profile:', error);
        }
      };
      loadDriverProfile();
    }
  }, [request, driverProfile, getUserProfile]);

  // Load customer profile to get rating
  useEffect(() => {
    if (currentUserId && !customerProfile) {
      const loadCustomerProfile = async () => {
        try {
          const profile = await getUserProfile(currentUserId);
          setCustomerProfile(profile);
        } catch (error) {
          console.error('Error loading customer profile:', error);
        }
      };
      loadCustomerProfile();
    }
  }, [currentUserId, customerProfile, getUserProfile]);

  useEffect(() => {
    if (!customerProfile) return;
    const nextRating = Number(customerProfile?.customerProfile?.rating || customerProfile?.rating || 5.0);
    setStats((prev) => ({ ...prev, avgRating: nextRating }));
  }, [customerProfile]);
  
  // Fetch user's trip history
  const fetchTrips = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userTrips = await getUserPickupRequests();
      
      // Transform trip data into stable UI shape
      const transformedTrips = userTrips.map((trip) => {
        const completedAt = trip.completedAt || trip.completed_at || null;
        const createdAt = trip.createdAt || trip.created_at || completedAt;
        const timestamp = completedAt || createdAt || new Date().toISOString();
        const date = new Date(timestamp);
        const amountValue = Number(trip.pricing?.total ?? trip.price ?? 0) || 0;
        const normalizedStatus = normalizeTripStatus(trip.status);

        return {
          id: trip.id,
          date: formatDate(date),
          pickup: trip.pickup?.address || trip.pickupAddress || 'Unknown pickup',
          dropoff: trip.dropoff?.address || trip.dropoffAddress || 'Unknown dropoff',
          item: trip.item?.description || 'Package',
          driver: (trip.assignedDriverEmail || trip.driverEmail || 'Driver').split('@')[0],
          driverRating: 5.0, // Default rating for old data
          amountValue,
          amount: `$${amountValue.toFixed(2)}`,
          status: normalizedStatus,
          duration: calculateDuration({ createdAt, completedAt }),
          distance: trip.vehicle?.distance || trip.distance_miles || 'N/A',
          vehicleType: trip.vehicleType || trip.vehicle?.type || 'Vehicle',
          helpProvided: trip.item?.needsHelp || trip.needs_help || false,
          completedAt,
          createdAt
        };
      });
      
      setTrips(transformedTrips);
      
      // Calculate real statistics
      const completedTrips = transformedTrips.filter((trip) => trip.status === TRIP_STATUS.COMPLETED);
      const totalSpent = completedTrips.reduce((sum, trip) => sum + trip.amountValue, 0);
      
      setStats({
        totalTrips: completedTrips.length,
        totalSpent,
        avgRating: Number(customerProfile?.customerProfile?.rating || customerProfile?.rating || 5.0)
      });
      
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If we're in an active trip, redirect to DeliveryTrackingScreen
    if (hasTripInRoute && !TERMINAL_TRIP_STATUSES.includes(normalizedRouteStatus)) {
      navigation.replace('DeliveryTrackingScreen', {
        requestId,
        requestData: request
      });
      return;
    }
    
    // Otherwise, show the active tab if there's an active trip
    if (isActiveTrip) {
      setSelectedTab('active');
    }
    
    // Fetch trips when component mounts
    fetchTrips();
  }, [isActiveTrip, hasTripInRoute, normalizedRouteStatus, requestId, request, navigation, currentUser]);

  // Helper function to format date
  const formatDate = (date) => {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays === 2) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  // Helper function to calculate duration
  const calculateDuration = (trip) => {
    if (trip.completedAt && trip.createdAt) {
      const start = new Date(trip.createdAt);
      const end = new Date(trip.completedAt);
      const diffMinutes = Math.round((end - start) / (1000 * 60));
      return `${diffMinutes} min`;
    }
    return 'N/A';
  };

  const animateTransition = (newTab) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.5,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    setSelectedTab(newTab);
  };

  // Filter trips based on selected tab
  const getFilteredTrips = () => {
    if (selectedTab === 'active') {
      return trips.filter((trip) => !TERMINAL_TRIP_STATUSES.includes(normalizeTripStatus(trip.status)));
    } else if (selectedTab === 'recent') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return trips.filter(trip => {
        const tripDate = new Date(trip.completedAt || trip.createdAt);
        return tripDate >= oneWeekAgo;
      }).slice(0, 10); // Limit to 10 most recent
    } else if (selectedTab === 'all') {
      return trips;
    }
    return trips;
  };

  const getStatusColor = (status) => {
    const normalizedStatus = normalizeTripStatus(status);
    if (normalizedStatus === TRIP_STATUS.PENDING) return colors.warning;
    if (normalizedStatus === TRIP_STATUS.ACCEPTED) return colors.primary;
    if (normalizedStatus === TRIP_STATUS.COMPLETED) return colors.success;
    if (normalizedStatus === TRIP_STATUS.CANCELLED) return colors.error;
    if (IN_TRANSIT_TRIP_STATUSES.includes(normalizedStatus)) return colors.primary;
    if (normalizedStatus === TRIP_STATUS.ARRIVED_AT_DROPOFF) return colors.success;
    return colors.text.muted;
  };

  const getStatusIcon = (status) => {
    const normalizedStatus = normalizeTripStatus(status);
    switch (normalizedStatus) {
      case TRIP_STATUS.PENDING: return 'hourglass-outline';
      case TRIP_STATUS.ACCEPTED: return 'person-add';
      case TRIP_STATUS.COMPLETED: return 'checkmark-circle';
      case TRIP_STATUS.CANCELLED: return 'close-circle';
      case TRIP_STATUS.IN_PROGRESS: return 'time';
      case TRIP_STATUS.ARRIVED_AT_PICKUP: return 'location';
      case TRIP_STATUS.PICKED_UP: return 'bag-check';
      case TRIP_STATUS.EN_ROUTE_TO_DROPOFF: return 'car-sport';
      case TRIP_STATUS.ARRIVED_AT_DROPOFF: return 'home';
      default: return 'help-circle';
    }
  };
  
  const getStatusText = (status) => {
    const normalizedStatus = normalizeTripStatus(status);
    switch (normalizedStatus) {
      case TRIP_STATUS.PENDING: return 'Finding driver';
      case TRIP_STATUS.ACCEPTED: return 'Driver assigned';
      case TRIP_STATUS.ARRIVED_AT_PICKUP: return 'Driver arrived for pickup';
      case TRIP_STATUS.PICKED_UP: return 'Items picked up';
      case TRIP_STATUS.EN_ROUTE_TO_DROPOFF: return 'On the way to delivery';
      case TRIP_STATUS.ARRIVED_AT_DROPOFF: return 'Driver arrived at delivery';
      case TRIP_STATUS.COMPLETED: return 'Completed';
      case TRIP_STATUS.CANCELLED: return 'Cancelled';
      default:
        return typeof normalizedStatus === 'string' && normalizedStatus.length > 0
          ? normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)
          : 'Unknown';
    }
  };

  const renderTripCard = (trip) => (
    <TouchableOpacity key={trip.id} style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <View style={styles.tripStatusContainer}>
          <Ionicons 
            name={getStatusIcon(trip.status)} 
            size={16} 
            color={getStatusColor(trip.status)} 
          />
          <Text style={[styles.tripStatus, { color: getStatusColor(trip.status) }]}>
            {getStatusText(trip.status)}
          </Text>
        </View>
        <Text style={styles.tripAmount}>{trip.amount}</Text>
      </View>

      <Text style={styles.tripDate}>{trip.date}</Text>

      <View style={styles.routeContainer}>
        <View style={styles.routePoint}>
          <View style={styles.pickupDot} />
          <View style={styles.addressContainer}>
            <Text style={styles.addressLabel}>Pickup</Text>
            <Text style={styles.addressText}>{trip.pickup}</Text>
          </View>
        </View>
        
        <View style={styles.routeLine} />
        
        <View style={styles.routePoint}>
          <View style={styles.dropoffDot} />
          <View style={styles.addressContainer}>
            <Text style={styles.addressLabel}>Drop-off</Text>
            <Text style={styles.addressText}>{trip.dropoff}</Text>
          </View>
        </View>
      </View>

      <View style={styles.itemContainer}>
        <Ionicons name="cube-outline" size={16} color={colors.primary} />
        <Text style={styles.itemText}>{trip.item}</Text>
        {trip.helpProvided && (
          <View style={styles.helpBadge}>
            <Ionicons name="hand-left" size={12} color={colors.success} />
            <Text style={styles.helpText}>Help Provided</Text>
          </View>
        )}
      </View>

      <View style={styles.tripDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="person" size={14} color={colors.text.muted} />
          <Text style={styles.detailText}>{trip.driver}</Text>
          <Ionicons name="star" size={12} color={colors.warning} style={{ marginLeft: spacing.xs }} />
          <Text style={styles.ratingText}>{trip.driverRating}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={14} color={colors.text.muted} />
            <Text style={styles.detailText}>{trip.duration}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={14} color={colors.text.muted} />
            <Text style={styles.detailText}>{trip.distance}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="car-outline" size={14} color={colors.text.muted} />
            <Text style={styles.detailText}>{trip.vehicleType}</Text>
          </View>
        </View>
      </View>

      <View style={styles.tripActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
          <Text style={styles.actionText}>Message Driver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="star-outline" size={16} color={colors.primary} />
          <Text style={styles.actionText}>Rate Trip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="refresh-outline" size={16} color={colors.primary} />
          <Text style={styles.actionText}>Book Again</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
  
  const renderActiveTrip = () => {
    if (!isActiveTrip) return null;
    
    const isPickupStage = normalizedRouteStatus === TRIP_STATUS.ARRIVED_AT_PICKUP;
    const isDeliveryStage = normalizedRouteStatus === TRIP_STATUS.ARRIVED_AT_DROPOFF;
    const isEnRoute = normalizedRouteStatus === TRIP_STATUS.EN_ROUTE_TO_DROPOFF;
    const driverLatitude = Number(driverLocation?.latitude);
    const driverLongitude = Number(driverLocation?.longitude);
    const hasDriverLocation = Number.isFinite(driverLatitude) && Number.isFinite(driverLongitude);
    
    return (
      <View style={styles.activeTripContainer}>
        <View style={styles.activeTripHeader}>
          <View style={styles.tripStatusContainer}>
            <Ionicons 
              name={getStatusIcon(normalizedRouteStatus)} 
              size={20} 
              color={getStatusColor(normalizedRouteStatus)} 
            />
            <Text style={[styles.activeTripStatus, { color: getStatusColor(normalizedRouteStatus) }]}>
              {getStatusText(normalizedRouteStatus)}
            </Text>
          </View>
        </View>
        
        {isEnRoute && hasDriverLocation && (
          <View style={styles.mapContainer}>
            <MapboxMap
              style={styles.map}
              centerCoordinate={[driverLongitude, driverLatitude]}
              zoomLevel={14}
              customMapStyle={Mapbox.StyleURL.Dark}
            >
              <Mapbox.PointAnnotation
                id="activity-driver-location"
                coordinate={[driverLongitude, driverLatitude]}
              >
                  <View style={styles.driverMarker}>
                    <Ionicons name="car-sport" size={16} color={colors.white} />
                  </View>
              </Mapbox.PointAnnotation>
            </MapboxMap>
          </View>
        )}
        
        <View style={styles.activeTripDetails}>
          <View style={styles.routeContainer}>
            <View style={styles.routePoint}>
              <View style={styles.pickupDot} />
              <View style={styles.addressContainer}>
                <Text style={styles.addressLabel}>Pickup</Text>
                <Text style={styles.addressText}>{request?.pickup?.address || request?.pickupAddress || '123 Main Street'}</Text>
              </View>
            </View>
            
            <View style={[styles.routeLine, isPickupStage ? styles.activeRouteLine : {}]} />
            
            <View style={styles.routePoint}>
              <View style={[styles.dropoffDot, isDeliveryStage ? styles.activeDropoffDot : {}]} />
              <View style={styles.addressContainer}>
                <Text style={styles.addressLabel}>Drop-off</Text>
                <Text style={styles.addressText}>{request?.dropoff?.address || request?.dropoffAddress || '456 Oak Avenue'}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.driverInfoContainer}>
            <View style={styles.driverAvatarContainer}>
              <Ionicons name="person" size={24} color={colors.white} />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{request?.driver?.name || 'Your Driver'}</Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={14} color={colors.warning} />
                <Text style={styles.driverRatingText}>{driverProfile?.driverProfile?.rating || '5.0'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.contactButton}>
              <Ionicons name="call" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactButton}>
              <Ionicons name="chatbubble" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          
          {pickupPhotos && pickupPhotos.length > 0 && (
            <View style={styles.photosContainer}>
              <Text style={styles.photosTitle}>Pickup Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                {pickupPhotos.map((photo, index) => (
                  <View key={index} style={styles.photoItem}>
                    <Image source={{ uri: photo }} style={styles.photo} />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
          
          {isDeliveryStage && (
            <TouchableOpacity 
              style={styles.feedbackButton}
              onPress={() => navigation.navigate('DeliveryFeedbackScreen', { requestId, requestData: request })}
            >
              <Text style={styles.feedbackButtonText}>Leave Feedback</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Summary Stats - Top */}
      {!isActiveTrip && (
        <View style={[styles.summaryContainer, { paddingTop: insets.top + 10 }]}>
          <View style={styles.statCard}>
            <Ionicons name="trending-up" size={16} color={colors.success} />
            <Text style={styles.statNumber}>{stats.totalTrips}</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="wallet" size={16} color={colors.primary} />
            <Text style={styles.statNumber}>${stats.totalSpent.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Spent</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="star" size={16} color={colors.gold} />
            <Text style={styles.statNumber}>{stats.avgRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>
      )}

      {/* Trip List - Main content area */}
      <Animated.View style={[styles.listContainer, { opacity: fadeAnim }, isActiveTrip && { paddingTop: insets.top + 10 }]}>
        {selectedTab === 'active' && isActiveTrip ? (
          renderActiveTrip()
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your trips...</Text>
          </View>
        ) : getFilteredTrips().length > 0 ? (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {getFilteredTrips().map(renderTripCard)}
            <View style={styles.bottomSpacing} />
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={60} color={colors.text.subtle} />
            <Text style={styles.emptyTitle}>No trips found</Text>
            <Text style={styles.emptyText}>
              {selectedTab === 'recent' ? 'No recent trips to show' :
               'You haven\'t made any trips yet'}
            </Text>
            {selectedTab === 'all' && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('CustomerHomeScreen')}
              >
                <Text style={styles.emptyButtonText}>Book Your First Trip</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>

      {/* Bottom Controls - Tab Selector */}
      <View style={[styles.bottomControlsContainer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.tabContainer}>
          {isActiveTrip && (
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'active' && styles.activeTab]}
              onPress={() => animateTransition('active')}
            >
              <Text style={[styles.tabText, selectedTab === 'active' && styles.activeTabText]}>
                Active
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'recent' && styles.activeTab]}
            onPress={() => animateTransition('recent')}
          >
            <Text style={[styles.tabText, selectedTab === 'recent' && styles.activeTabText]}>
              Recent
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'all' && styles.activeTab]}
            onPress={() => animateTransition('all')}
          >
            <Text style={[styles.tabText, selectedTab === 'all' && styles.activeTabText]}>
              All Trips
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  statNumber: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  statLabel: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
  bottomControlsContainer: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  activeTabText: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  listContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  tripCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripStatus: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm - 2,
  },
  tripAmount: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  tripDate: {
    color: colors.text.tertiary,
    fontSize: 13,
    marginBottom: 16,
  },
  routeContainer: {
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  pickupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: 12,
  },
  dropoffDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginTop: 6,
    marginRight: 12,
  },
  activeDropoffDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 10,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: colors.border.strong,
    marginLeft: 3,
    marginVertical: 2,
  },
  activeRouteLine: {
    backgroundColor: colors.primary,
  },
  addressContainer: {
    flex: 1,
  },
  addressLabel: {
    color: colors.text.tertiary,
    fontSize: 12,
    marginBottom: 2,
  },
  addressText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  itemText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
    flex: 1,
  },
  helpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.successSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  helpText: {
    color: colors.success,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: 4,
  },
  tripDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    color: colors.text.tertiary,
    fontSize: 12,
    marginLeft: 4,
  },
  ratingText: {
    color: colors.text.tertiary,
    fontSize: 12,
    marginLeft: 2,
  },
  tripActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
    paddingTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: 6,
  },
  bottomSpacing: {
    height: 20,
  },
  
  // Active trip styles
  activeTripContainer: {
    flex: 1,
    padding: spacing.lg,
  },
  activeTripHeader: {
    marginBottom: spacing.lg,
  },
  activeTripStatus: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginLeft: spacing.sm,
  },
  mapContainer: {
    height: 200,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  driverMarker: {
    backgroundColor: colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  activeTripDetails: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  driverInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.lg,
  },
  driverAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInfo: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  driverRatingText: {
    color: colors.gold,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: 4,
  },
  contactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlayPrimarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  photosContainer: {
    marginBottom: spacing.lg,
  },
  photosTitle: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  photosScroll: {
    flexDirection: 'row',
  },
  photoItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  feedbackButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  feedbackButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  
  // Loading and empty states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.md,
    marginTop: spacing.base,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.md,
    textAlign: 'center',
    lineHeight: typography.fontSize.md * typography.lineHeight.normal,
    marginBottom: 30,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
});
