import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import DeliveryPhotosModal from './DeliveryPhotosModal';

const { width } = Dimensions.get('window');

export default function DeliveryStatusTracker({ 
  requestId, 
  onDeliveryComplete,
  onViewFullTracker,
  expanded = false
}) {
  const { getRequestById } = useAuth();
  
  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [activePhotoType, setActivePhotoType] = useState('pickup');
  const [isExpanded, setIsExpanded] = useState(expanded);

  // Status steps in order with modern labels
  const statusSteps = [
    { key: 'accepted', label: 'Driver Confirmed', icon: 'checkmark-circle', description: 'Driver is preparing for your pickup' },
    { key: 'inProgress', label: 'On the way to you', icon: 'car-sport', description: 'Driver is heading to your location' },
    { key: 'arrivedAtPickup', label: 'Driver arrived', icon: 'location', description: 'Driver has arrived at pickup location' },
    { key: 'pickedUp', label: 'Package collected', icon: 'cube', description: 'Your items are secured for transport' },
    { key: 'enRouteToDropoff', label: 'On the way to destination', icon: 'navigate', description: 'Your package is in transit' },
    { key: 'arrivedAtDropoff', label: 'Arrived at destination', icon: 'home', description: 'Driver has arrived at delivery location' },
    { key: 'completed', label: 'Delivered', icon: 'checkmark-circle', description: 'Your delivery is complete' },
  ];

  useEffect(() => {
    if (requestId) {
      fetchRequestData();
      
      // Set up polling for updates every 15 seconds
      const interval = setInterval(() => {
        fetchRequestData(false); // Don't show loading indicator for refreshes
      }, 15000);
      
      setRefreshInterval(interval);
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [requestId]);

  // When delivery is completed, notify parent component
  useEffect(() => {
    if (requestData && requestData.status === 'completed' && onDeliveryComplete) {
      onDeliveryComplete(requestData);
      
      // Stop polling when delivery is complete
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    }
  }, [requestData]);

  const fetchRequestData = async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    
    try {
      const data = await getRequestById(requestId);
      setRequestData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching request data:', err);
      setError('Unable to load delivery status');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchRequestData();
  };

  const handleViewPhotos = (type) => {
    setActivePhotoType(type);
    setShowPhotosModal(true);
  };

  const getCurrentStatusIndex = () => {
    if (!requestData || !requestData.status) return 0;
    
    const currentStatus = requestData.status;
    const index = statusSteps.findIndex(step => step.key === currentStatus);
    return index >= 0 ? index : 0;
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const formatETA = () => {
    if (!requestData) return '-- min';
    
    // Calculate ETA based on status
    const currentStatus = getCurrentStatusIndex();
    
    if (currentStatus === 0) return '10-15 min';
    if (currentStatus === 1) return '5-10 min';
    if (currentStatus === 2) return 'Arrived';
    if (currentStatus === 3) return '15-20 min';
    if (currentStatus === 4) return '5-10 min';
    if (currentStatus === 5) return 'Arrived';
    return 'Delivered';
  };

  const renderCompactView = () => {
    if (!requestData) return null;
    
    const currentIndex = getCurrentStatusIndex();
    const currentStep = statusSteps[currentIndex] || statusSteps[0];
    
    return (
      <TouchableOpacity style={styles.compactContainer} onPress={onViewFullTracker || toggleExpanded}>
        <View style={styles.compactContent}>
          <View style={styles.compactIconContainer}>
            <Ionicons name={currentStep.icon} size={16} color="#fff" />
          </View>
          <View style={styles.compactTextContainer}>
            <Text style={styles.compactStatus}>{currentStep.label}</Text>
            <Text style={styles.compactInfo}>
              {requestData.item?.description || 'Your delivery'} • ETA: {formatETA()}
            </Text>
          </View>
        </View>
        <View style={styles.tapIndicator}>
          <Ionicons name="chevron-forward" size={16} color="#999" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderStatusStep = (step, index) => {
    const currentIndex = getCurrentStatusIndex();
    const isActive = index <= currentIndex;
    const isCurrent = index === currentIndex;
    
    return (
      <View key={step.key} style={styles.statusStep}>
        <View style={styles.statusIconContainer}>
          <View style={[
            styles.statusDot,
            isActive ? styles.activeDot : styles.inactiveDot,
            isCurrent ? styles.currentDot : null
          ]}>
            <Ionicons 
              name={step.icon} 
              size={16} 
              color={isActive ? '#fff' : '#666'} 
            />
          </View>
          
          {index < statusSteps.length - 1 && (
            <View style={[
              styles.statusLine,
              index < currentIndex ? styles.activeLine : styles.inactiveLine
            ]} />
          )}
        </View>
        
        <View style={styles.statusTextContainer}>
          <Text style={[
            styles.statusLabel,
            isActive ? styles.activeLabel : styles.inactiveLabel,
            isCurrent ? styles.currentLabel : null
          ]}>
            {step.label}
          </Text>
          
          {isCurrent && (
            <Text style={styles.statusDescription}>{step.description}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderPhotoButtons = () => {
    const hasPickupPhotos = requestData?.pickupPhotos && requestData.pickupPhotos.length > 0;
    const hasDeliveryPhotos = requestData?.dropoffPhotos && requestData.dropoffPhotos.length > 0;
    const currentIndex = getCurrentStatusIndex();
    
    if (currentIndex < 3 || (!hasPickupPhotos && !hasDeliveryPhotos)) {
      return null;
    }
    
    return (
      <View style={styles.photoButtonsContainer}>
        {hasPickupPhotos && (
          <TouchableOpacity 
            style={styles.photoButton}
            onPress={() => handleViewPhotos('pickup')}
          >
            <Ionicons name="camera" size={16} color="#A77BFF" />
            <Text style={styles.photoButtonText}>Pickup Photos</Text>
          </TouchableOpacity>
        )}
        
        {hasDeliveryPhotos && (
          <TouchableOpacity 
            style={styles.photoButton}
            onPress={() => handleViewPhotos('delivery')}
          >
            <Ionicons name="images" size={16} color="#A77BFF" />
            <Text style={styles.photoButtonText}>Delivery Photos</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderDriverInfo = () => {
    if (!requestData || !requestData.assignedDriverEmail) {
      return null;
    }
    
    const driverName = requestData.assignedDriverEmail.split('@')[0];
    
    return (
      <View style={styles.driverInfoContainer}>
        <View style={styles.driverInfo}>
          <View style={styles.driverAvatar}>
            <Ionicons name="person" size={18} color="#fff" />
          </View>
          <View style={styles.driverTextInfo}>
            <Text style={styles.driverName}>{driverName}</Text>
            <Text style={styles.vehicleInfo}>
              {requestData.vehicleType || 'Vehicle'} • {requestData.vehiclePlate || 'Plate'}
            </Text>
          </View>
          <View style={styles.driverRating}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.ratingText}>4.9</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading && !requestData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#A77BFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <TouchableOpacity style={styles.errorContainer} onPress={handleRefresh}>
        <Ionicons name="alert-circle" size={16} color="#ff4444" />
        <Text style={styles.errorText}>Tap to retry</Text>
      </TouchableOpacity>
    );
  }

  if (!isExpanded) {
    return renderCompactView();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Delivery Status</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Ionicons name="refresh" size={18} color="#A77BFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.collapseButton} onPress={toggleExpanded}>
            <Ionicons name="chevron-up" size={18} color="#A77BFF" />
          </TouchableOpacity>
        </View>
      </View>
      
      {renderDriverInfo()}
      
      <View style={styles.statusContainer}>
        {statusSteps.map(renderStatusStep)}
      </View>
      
      
      {renderPhotoButtons()}
      
      {requestData && (
        <DeliveryPhotosModal
          visible={showPhotosModal}
          onClose={() => setShowPhotosModal(false)}
          pickupPhotos={requestData.pickupPhotos || []}
          deliveryPhotos={requestData.dropoffPhotos || []}
          requestDetails={requestData}
          activeTab={activePhotoType}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#141426',
    borderRadius: 12,
    padding: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#2A2A3B',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  compactContainer: {
    backgroundColor: '#141426',
    borderRadius: 25,
    padding: 10,
    marginVertical: 10,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: '#2A2A3B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#A77BFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  compactTextContainer: {
    flex: 1,
  },
  compactStatus: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  compactInfo: {
    color: '#999',
    fontSize: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(167, 123, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  collapseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(167, 123, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInfoContainer: {
    backgroundColor: '#1E1E38',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#A77BFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverTextInfo: {
    flex: 1,
    marginLeft: 10,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  vehicleInfo: {
    fontSize: 12,
    color: '#ccc',
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  tapIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 8,
  },
  statusContainer: {
    marginBottom: 16,
  },
  statusStep: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statusIconContainer: {
    alignItems: 'center',
    marginRight: 12,
  },
  statusDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeDot: {
    backgroundColor: '#A77BFF',
  },
  inactiveDot: {
    backgroundColor: '#2A2A3B',
  },
  currentDot: {
    borderWidth: 2,
    borderColor: '#A77BFF',
  },
  statusTextContainer: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeLabel: {
    color: '#fff',
  },
  inactiveLabel: {
    color: '#666',
  },
  currentLabel: {
    fontWeight: 'bold',
  },
  statusDescription: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  statusLine: {
    width: 2,
    height: 24,
  },
  activeLine: {
    backgroundColor: '#A77BFF',
  },
  inactiveLine: {
    backgroundColor: '#2A2A3B',
  },
  liveTrackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A77BFF',
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 16,
  },
  liveTrackingText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  photoButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(167, 123, 255, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  photoButtonText: {
    color: '#A77BFF',
    marginLeft: 6,
    fontSize: 14,
  },
  loadingContainer: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141426',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#2A2A3B',
    flexDirection: 'row',
    marginHorizontal: 10,
    marginVertical: 10,
  },
  loadingText: {
    color: '#ccc',
    marginLeft: 10,
    fontSize: 14,
  },
  errorContainer: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141426',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#2A2A3B',
    flexDirection: 'row',
    marginHorizontal: 10,
    marginVertical: 10,
  },
  errorText: {
    color: '#ff4444',
    marginLeft: 10,
    fontSize: 14,
  },
}); 