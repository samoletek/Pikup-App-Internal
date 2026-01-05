import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Animated,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function IncomingRequestModal({ 
  visible, 
  request, 
  onAccept, 
  onDecline,
  onMessage 
}) {
  const [timeRemaining, setTimeRemaining] = useState(120); // 2 minutes
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    if (visible && request) {
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        })
      ]).start();

      // Start countdown timer
      setTimeRemaining(120);
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Auto-decline when timer reaches 0
            console.log('Auto-declining request due to timeout');
            handleDecline();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start();

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [visible, request]);

  const handleAccept = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    onAccept(request);
  };

  const handleDecline = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    onDecline();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} min${mins !== 1 ? 's' : ''} remaining`;
  };

  const getItemTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'furniture':
        return 'bed-outline';
      case 'package':
        return 'cube-outline';
      case 'groceries':
        return 'cart-outline';
      case 'electronics':
        return 'laptop-outline';
      default:
        return 'cube-outline';
    }
  };

  if (!request) return null;

  // Fix: Look for photos in the correct location and handle different formats
  const displayPhotos = Array.isArray(request?.photos)
    ? request.photos
    : Array.isArray(request?.item?.photos)
    ? request.item.photos
    : [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: fadeAnim
          }
        ]}
      >
        <Animated.View 
          style={[
            styles.container,
            {
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Header with Modern Design */}
          <View style={styles.header}>
            <View style={styles.handleBar} />
            <Text style={styles.title}>Incoming Request</Text>
          </View>

          {/* Main Content */}
          <View style={styles.content}>
            {/* Earnings and Category Row */}
            <View style={styles.earningsRow}>
              <Text style={styles.earningsAmount}>{request.price || '$0.00'}</Text>
              <View style={styles.categoryBadge}>
                <Ionicons 
                  name={getItemTypeIcon(request.item?.type)} 
                  size={14} 
                  color="#8B5CF6" 
                  style={styles.categoryIcon}
                />
                <Text style={styles.categoryText}>{request.item?.type || 'Item'}</Text>
              </View>
            </View>

            {/* Timer with Progress Indicator */}
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
              <View style={styles.timerBar}>
                <View 
                  style={[
                    styles.timerProgress,
                    { width: `${(timeRemaining / 120) * 100}%` }
                  ]} 
                />
              </View>
            </View>

            {/* Locations with Enhanced Design */}
            <View style={styles.locationsContainer}>
              {/* Pickup */}
              <View style={styles.locationCard}>
                <View style={styles.locationRow}>
                  <View style={styles.locationIconContainer}>
                    <View style={styles.pickupDot} />
                  </View>
                  <View style={styles.locationInfo}>
                    <View style={styles.locationHeader}>
                      <Text style={styles.locationTime}>{request.pickup?.time || request.time || '7 min'}</Text>
                      <Text style={styles.locationDot}>•</Text>
                      <Text style={styles.locationDistance}>{request.pickup?.distance || request.distance || '2 mi'}</Text>
                    </View>
                    <Text style={styles.locationAddress} numberOfLines={2}>
                      {request.pickup?.address || 'Pickup location'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Connecting Line */}
              <View style={styles.connectionLine} />

              {/* Dropoff */}
              <View style={styles.locationCard}>
                <View style={styles.locationRow}>
                  <View style={styles.locationIconContainer}>
                    <View style={styles.dropoffDot} />
                  </View>
                  <View style={styles.locationInfo}>
                    <View style={styles.locationHeader}>
                      <Text style={styles.locationTime}>{request.dropoff?.time || '11 min'}</Text>
                      <Text style={styles.locationDot}>•</Text>
                      <Text style={styles.locationDistance}>{request.dropoff?.distance || request.distance || '4.4 mi'}</Text>
                    </View>
                    <Text style={styles.locationAddress} numberOfLines={2}>
                      {request.dropoff?.address || 'Dropoff location'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Item Description */}
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionText} numberOfLines={2}>
                {request.item?.description || 'No description provided'}
              </Text>
            </View>

            {/* Item Photos */}
            {displayPhotos.length > 0 ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.photosContainer}
              >
                {displayPhotos.map((photo, index) => {
                  // Handle different photo formats
                  const src = typeof photo === 'string'
                    ? { uri: photo }
                    : photo?.url
                    ? { uri: photo.url }
                    : photo?.uri
                    ? { uri: photo.uri }
                    : null;
                  
                  if (!src) return null;
                  
                  return (
                    <View key={index} style={styles.photoWrapper}>
                      <Image source={src} style={styles.itemPhoto} />
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              // Mock photos for demonstration
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.photosContainer}
              >
                {[1, 2, 3].map((_, index) => (
                  <View key={index} style={styles.photoWrapper}>
                    <View style={styles.mockPhoto}>
                      <Ionicons name="image-outline" size={24} color="#666" />
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Customer Info */}
            <View style={styles.customerContainer}>
              <View style={styles.customerLeft}>
                <View style={styles.customerPhotoContainer}>
                  <Image 
                    source={
                      request.customer?.photo 
                        ? { uri: request.customer.photo }
                        : require('../assets/profile.png')
                    }
                    style={styles.customerPhoto}
                  />
                </View>
                <View style={styles.customerInfo}>
                  <Text style={styles.customerName}>
                    {request.customerName || (request.customerEmail ? request.customerEmail.split('@')[0] : 'Customer')}
                  </Text>
                  <View style={styles.ratingContainer}>
                    {[...Array(5)].map((_, i) => (
                      <Ionicons 
                        key={i}
                        name="star" 
                        size={12} 
                        color={i < Math.floor(request.customer?.rating || 5) ? '#FFD700' : '#333'} 
                      />
                    ))}
                    <Text style={styles.ratingText}>
                      {request.customer?.rating || '5.0'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.customerRight}>
                <Text style={styles.requestCount}>
                  Driver Assistance Requested
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              {/* Message Button */}
              <TouchableOpacity 
                style={styles.messageButton}
                onPress={() => onMessage(request)}
                activeOpacity={0.8}
              >
                <Ionicons name="paper-plane-outline" size={24} color="#8B5CF6" />
              </TouchableOpacity>

              {/* Decline Button */}
              <TouchableOpacity 
                style={styles.declineButton}
                onPress={handleDecline}
                activeOpacity={0.8}
              >
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>

              {/* Accept Button */}
              <TouchableOpacity 
                style={styles.acceptButton}
                onPress={handleAccept}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  style={styles.acceptGradient}
                >
                  <Text style={styles.acceptText}>Accept</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    maxHeight: '90%',
    // Modern modal outline
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderBottomWidth: 0,
    shadowColor: '#8B5CF6',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  categoryIcon: {
    marginRight: 6,
  },
  categoryText: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '600',
  },
  timerContainer: {
    marginBottom: 20,
  },
  timerText: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 8,
  },
  timerBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  timerProgress: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 2,
  },
  locationsContainer: {
    marginBottom: 20,
  },
  locationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationIconContainer: {
    width: 32,
    alignItems: 'center',
    paddingTop: 2,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#8B5CF6',
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  dropoffDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00D4AA',
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 170, 0.3)',
  },
  connectionLine: {
    width: 2,
    height: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.4)',
    marginLeft: 17,
    marginVertical: 8,
    borderRadius: 1,
  },
  locationInfo: {
    flex: 1,
    paddingLeft: 12,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationTime: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  locationDot: {
    color: '#666',
    fontSize: 14,
    marginHorizontal: 8,
  },
  locationDistance: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  locationAddress: {
    color: '#bbb',
    fontSize: 14,
    lineHeight: 20,
  },
  descriptionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  descriptionText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  photosContainer: {
    marginBottom: 16,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  photoWrapper: {
    marginRight: 8,
  },
  itemPhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  mockPhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
  },
  customerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  customerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerPhotoContainer: {
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  customerPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  customerInfo: {
    marginLeft: 12,
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
  ratingText: {
    color: '#aaa',
    fontSize: 12,
    marginLeft: 4,
  },
  customerRight: {
    alignItems: 'flex-end',
  },
  requestCount: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  messageButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  declineButton: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a3e',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  declineText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  acceptGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});