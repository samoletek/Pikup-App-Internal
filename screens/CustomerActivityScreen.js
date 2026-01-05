import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Animated,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapboxMap from '../components/mapbox/MapboxMap';
import Mapbox from '@rnmapbox/maps';
import { useAuth } from '../contexts/AuthContext';

export default function CustomerActivityScreen({ navigation, route }) {
  const [selectedTab, setSelectedTab] = useState('recent');
  const [fadeAnim] = useState(new Animated.Value(1));
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalTrips: 0, totalSpent: 0, avgRating: 0 });
  const [driverProfile, setDriverProfile] = useState(null);
  const [customerProfile, setCustomerProfile] = useState(null);
  
  // Get parameters from route if available (for demo mode)
  const { requestId, status, request, driverLocation, pickupPhotos } = route.params || {};
  
  // Get AuthContext
  const { getUserPickupRequests, currentUser, getUserProfile } = useAuth();
  
  // If we have a requestId and status, we're in an active trip
  const isActiveTrip = !!requestId && !!status;
  
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
  }, [request]);

  // Load customer profile to get rating
  useEffect(() => {
    if (currentUser && !customerProfile) {
      const loadCustomerProfile = async () => {
        try {
          const profile = await getUserProfile(currentUser.uid);
          setCustomerProfile(profile);
        } catch (error) {
          console.error('Error loading customer profile:', error);
        }
      };
      loadCustomerProfile();
    }
  }, [currentUser]);
  
  // Fetch user's trip history
  const fetchTrips = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userTrips = await getUserPickupRequests();
      
      // Transform Firebase data to match UI format
      const transformedTrips = userTrips.map(trip => {
        const completedAt = trip.completedAt || trip.createdAt;
        const date = new Date(completedAt);
        
        return {
          id: trip.id,
          date: formatDate(date),
          pickup: trip.pickup?.address || 'Unknown pickup',
          dropoff: trip.dropoff?.address || 'Unknown dropoff',
          item: trip.item?.description || 'Package',
          driver: trip.driverEmail?.split('@')[0] || 'Driver',
          driverRating: 5.0, // Default rating for old data
          amount: trip.pricing?.total ? `$${trip.pricing.total.toFixed(2)}` : '$0.00',
          status: trip.status,
          duration: calculateDuration(trip),
          distance: trip.vehicle?.distance || 'N/A',
          vehicleType: trip.vehicle?.type || 'Vehicle',
          helpProvided: trip.item?.needsHelp || false,
          completedAt: trip.completedAt,
          createdAt: trip.createdAt
        };
      });
      
      setTrips(transformedTrips);
      
      // Calculate real statistics
      const completedTrips = transformedTrips.filter(trip => trip.status === 'completed');
      const totalSpent = completedTrips.reduce((sum, trip) => {
        const amount = parseFloat(trip.amount.replace('$', ''));
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
      
      setStats({
        totalTrips: completedTrips.length,
        totalSpent: totalSpent,
        avgRating: customerProfile?.customerProfile?.rating || 5.0
      });
      
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If we're in an active trip, redirect to DeliveryTrackingScreen
    if (isActiveTrip && requestId && !['completed', 'cancelled'].includes(status)) {
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
  }, [isActiveTrip, requestId, status, navigation, currentUser]);

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
      return trips.filter(trip => !['completed', 'cancelled'].includes(trip.status));
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
    switch (status) {
      case 'pending': return '#FFA500';
      case 'accepted': return '#4A90E2';
      case 'completed': return '#00D4AA';
      case 'cancelled': return '#ff4444';
      case 'inProgress': return '#A77BFF';
      case 'arrivedAtPickup': return '#A77BFF';
      case 'pickedUp': return '#A77BFF';
      case 'enRouteToDropoff': return '#A77BFF';
      case 'arrivedAtDropoff': return '#00D4AA';
      default: return '#999';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return 'hourglass-outline';
      case 'accepted': return 'person-add';
      case 'completed': return 'checkmark-circle';
      case 'cancelled': return 'close-circle';
      case 'inProgress': return 'time';
      case 'arrivedAtPickup': return 'location';
      case 'pickedUp': return 'bag-check';
      case 'enRouteToDropoff': return 'car-sport';
      case 'arrivedAtDropoff': return 'home';
      default: return 'help-circle';
    }
  };
  
  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Finding driver';
      case 'accepted': return 'Driver assigned';
      case 'arrivedAtPickup': return 'Driver arrived for pickup';
      case 'pickedUp': return 'Items picked up';
      case 'enRouteToDropoff': return 'On the way to delivery';
      case 'arrivedAtDropoff': return 'Driver arrived at delivery';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
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
        <Ionicons name="cube-outline" size={16} color="#A77BFF" />
        <Text style={styles.itemText}>{trip.item}</Text>
        {trip.helpProvided && (
          <View style={styles.helpBadge}>
            <Ionicons name="hand-left" size={12} color="#00D4AA" />
            <Text style={styles.helpText}>Help Provided</Text>
          </View>
        )}
      </View>

      <View style={styles.tripDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="person" size={14} color="#999" />
          <Text style={styles.detailText}>{trip.driver}</Text>
          <Ionicons name="star" size={12} color="#FFD700" style={{ marginLeft: 4 }} />
          <Text style={styles.ratingText}>{trip.driverRating}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={14} color="#999" />
            <Text style={styles.detailText}>{trip.duration}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={14} color="#999" />
            <Text style={styles.detailText}>{trip.distance}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="car-outline" size={14} color="#999" />
            <Text style={styles.detailText}>{trip.vehicleType}</Text>
          </View>
        </View>
      </View>

      <View style={styles.tripActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={16} color="#A77BFF" />
          <Text style={styles.actionText}>Message Driver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="star-outline" size={16} color="#A77BFF" />
          <Text style={styles.actionText}>Rate Trip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="refresh-outline" size={16} color="#A77BFF" />
          <Text style={styles.actionText}>Book Again</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
  
  const renderActiveTrip = () => {
    if (!isActiveTrip) return null;
    
    const isPickupStage = status === 'arrivedAtPickup';
    const isDeliveryStage = status === 'arrivedAtDropoff';
    const isEnRoute = status === 'enRouteToDropoff';
    
    return (
      <View style={styles.activeTripContainer}>
        <View style={styles.activeTripHeader}>
          <View style={styles.tripStatusContainer}>
            <Ionicons 
              name={getStatusIcon(status)} 
              size={20} 
              color={getStatusColor(status)} 
            />
            <Text style={[styles.activeTripStatus, { color: getStatusColor(status) }]}>
              {getStatusText(status)}
            </Text>
          </View>
        </View>
        
        {isEnRoute && driverLocation && (
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              {driverLocation && (
                <Marker
                  coordinate={driverLocation}
                  title="Driver Location"
                >
                  <View style={styles.driverMarker}>
                    <Ionicons name="car-sport" size={16} color="#fff" />
                  </View>
                </Marker>
              )}
            </MapView>
          </View>
        )}
        
        <View style={styles.activeTripDetails}>
          <View style={styles.routeContainer}>
            <View style={styles.routePoint}>
              <View style={styles.pickupDot} />
              <View style={styles.addressContainer}>
                <Text style={styles.addressLabel}>Pickup</Text>
                <Text style={styles.addressText}>{request?.pickup?.address || '123 Main Street'}</Text>
              </View>
            </View>
            
            <View style={[styles.routeLine, isPickupStage ? styles.activeRouteLine : {}]} />
            
            <View style={styles.routePoint}>
              <View style={[styles.dropoffDot, isDeliveryStage ? styles.activeDropoffDot : {}]} />
              <View style={styles.addressContainer}>
                <Text style={styles.addressLabel}>Drop-off</Text>
                <Text style={styles.addressText}>{request?.dropoff?.address || '456 Oak Avenue'}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.driverInfoContainer}>
            <View style={styles.driverAvatarContainer}>
              <Ionicons name="person" size={24} color="#fff" />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{request?.driver?.name || 'Your Driver'}</Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.driverRatingText}>{driverProfile?.driverProfile?.rating || '5.0'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.contactButton}>
              <Ionicons name="call" size={20} color="#A77BFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactButton}>
              <Ionicons name="chatbubble" size={20} color="#A77BFF" />
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="filter" size={20} color="#A77BFF" />
        </TouchableOpacity>
      </View>

      {/* Summary Stats */}
      {!isActiveTrip && (
        <View style={styles.summaryContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalTrips}</Text>
            <Text style={styles.statLabel}>Total Trips</Text>
            <Ionicons name="trending-up" size={16} color="#00D4AA" />
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>${stats.totalSpent.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
            <Ionicons name="wallet" size={16} color="#A77BFF" />
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.avgRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Rating</Text>
            <Ionicons name="star" size={16} color="#FFD700" />
          </View>
        </View>
      )}

      {/* Tab Selector */}
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

      {/* Trip List */}
      <Animated.View style={[styles.listContainer, { opacity: fadeAnim }]}>
        {selectedTab === 'active' && isActiveTrip ? (
          renderActiveTrip()
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A77BFF" />
            <Text style={styles.loadingText}>Loading your trips...</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {getFilteredTrips().length > 0 ? (
              getFilteredTrips().map(renderTripCard)
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={60} color="#666" />
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
            <View style={styles.bottomSpacing} />
          </ScrollView>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: '#141426',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A3A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  statNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#141426',
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#A77BFF',
  },
  tabText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tripCard: {
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
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
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  tripAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tripDate: {
    color: '#999',
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
    backgroundColor: '#A77BFF',
    marginTop: 6,
    marginRight: 12,
  },
  dropoffDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00D4AA',
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
    backgroundColor: '#2A2A3B',
    marginLeft: 3,
    marginVertical: 2,
  },
  activeRouteLine: {
    backgroundColor: '#A77BFF',
  },
  addressContainer: {
    flex: 1,
  },
  addressLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 2,
  },
  addressText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A3A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  itemText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  helpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A3A2E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  helpText: {
    color: '#00D4AA',
    fontSize: 10,
    fontWeight: '600',
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
    color: '#999',
    fontSize: 12,
    marginLeft: 4,
  },
  ratingText: {
    color: '#999',
    fontSize: 12,
    marginLeft: 2,
  },
  tripActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#2A2A3B',
    paddingTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A3A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionText: {
    color: '#A77BFF',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  bottomSpacing: {
    height: 40,
  },
  
  // Active trip styles
  activeTripContainer: {
    flex: 1,
    padding: 20,
  },
  activeTripHeader: {
    marginBottom: 20,
  },
  activeTripStatus: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  mapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  driverMarker: {
    backgroundColor: '#A77BFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  activeTripDetails: {
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  driverInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A3A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  driverAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#A77BFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInfo: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  driverRatingText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  contactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(167, 123, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  photosContainer: {
    marginBottom: 20,
  },
  photosTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
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
    backgroundColor: '#A77BFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  feedbackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Loading and empty states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  emptyButton: {
    backgroundColor: '#A77BFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});