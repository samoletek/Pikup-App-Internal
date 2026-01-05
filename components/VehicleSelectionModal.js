import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  PanResponder,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.95;
const COLLAPSED_HEIGHT = SCREEN_HEIGHT * 0.35; // Much smaller - 35% of screen

const vehicles = [
  {
    type: 'Cargo Van',
    image: require('../assets/van.png'),
    items: [
      'Sofa or Loveseat',
      'Queen Mattress & Bed Frame',
      'Up to 15 Medium Boxes',
      'Large TV (boxed)',
      'Office Desk & Chair',
      'Bicycle or Treadmill',
      'Dinning Chairs & Coffee Table',
    ],
  },
  {
    type: 'Pickup Truck',
    image: require('../assets/pickup.png'),
    items: [
      'Loveseat or Small Couch',
      'Small to Medium Sized Mattress',
      'Up to 10 Medium Boxes',
      'Medium TV (boxed)',
      'Office Desk & Chair',
      'Bicycle or Treadmill',
      'Dinning Chairs & Coffee Table',
    ],
  },
];

const VehicleSelectionModal = ({ 
  visible, 
  onClose, 
  onNext, 
  description = '', 
  selectedLocations = null,
  summaryData = null 
}) => {
  const [index, setIndex] = useState(0);
  const [recommended, setRecommended] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Pricing states
  const [vehiclePricing, setVehiclePricing] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [distance, setDistance] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  
  const translateY = useRef(new Animated.Value(MODAL_HEIGHT)).current;

  console.log('VehicleSelectionModal render - visible:', visible);

  // Fetch pricing when modal becomes visible
  useEffect(() => {
    console.log('🔄 VehicleSelectionModal useEffect - visible:', visible);
    console.log('🔄 selectedLocations:', selectedLocations);
    console.log('🔄 Pickup exists:', !!selectedLocations?.pickup);
    console.log('🔄 Dropoff exists:', !!selectedLocations?.dropoff);
    
    if (visible && selectedLocations?.pickup && selectedLocations?.dropoff) {
      console.log('✅ Conditions met, fetching vehicle pricing...');
      fetchVehiclePricing();
    } else {
      console.log('❌ Conditions NOT met for fetching pricing');
      // Clear pricing data when conditions aren't met to prevent stale data
      if (!visible || !selectedLocations?.pickup || !selectedLocations?.dropoff) {
        setVehiclePricing({});
        setLoadingPrices(false);
      }
    }
  }, [visible, selectedLocations]);

  // Set AI recommendation based on description
  useEffect(() => {
    const desc = description.toLowerCase();
    if (
      desc.includes('sofa') ||
      desc.includes('dresser') ||
      desc.includes('bed') ||
      desc.includes('tv')
    ) {
      setRecommended('Pickup Truck');
    } else if (desc.includes('boxes') || desc.includes('bags')) {
      setRecommended('Cargo Van');
    } else {
      setRecommended('Cargo Van');
    }
  }, [description]);

  const fetchVehiclePricing = async () => {
    if (!visible || !selectedLocations?.pickup || !selectedLocations?.dropoff) {
      console.log('Cannot fetch pricing - modal not visible or missing location data:', {
        visible,
        selectedLocations
      });
      return;
    }

    setLoadingPrices(true);
    try {
      console.log('🚗 Fetching pricing for locations:', selectedLocations);
      
      // Convert pickup and dropoff addresses to coordinates if needed
      const pickupCoords = selectedLocations.pickup?.coordinates || {
        latitude: 33.749, // Default Atlanta coords - should be replaced with actual geocoding
        longitude: -84.388
      };
      
      const dropoffCoords = selectedLocations.dropoff?.coordinates || {
        latitude: 33.749, // Default Atlanta coords - should be replaced with actual geocoding  
        longitude: -84.388
      };

      const PAYMENT_SERVICE_URL = 'https://pikup-server.onrender.com';
      
      const requestBody = {
        pickupLocation: pickupCoords,
        destinationLocation: dropoffCoords,
        vehicleTypes: ['Cargo Van', 'Pickup Truck'],
        helpNeeded: summaryData?.needsHelp || false,
        itemWeight: 'medium',
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay()
      };
      
      console.log('🚀 Making pricing API request:', requestBody);
      
      const response = await fetch(`${PAYMENT_SERVICE_URL}/calculate-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📡 API Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error response:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Full API response:', result);
      
      if (result.success && result.prices) {
        console.log('💰 Pricing API success:', result);
        console.log('💰 Setting vehicle pricing:', result.prices);
        setVehiclePricing(result.prices);
        setDistance(result.distance || 0);
        setEstimatedTime(result.estimatedTime || 0);
      } else {
        console.error('❌ API returned error:', result.error || 'Failed to get pricing');
        console.error('❌ Full result object:', result);
        throw new Error(result.error || 'Failed to get pricing');
      }
      
    } catch (error) {
      console.error('Error fetching vehicle pricing:', error);
      
      // Fallback to estimated pricing based on new algorithm
      const fallbackPricing = {
        'Cargo Van': {
          baseFare: 30.00,
          mileageCharge: 20.00,
          total: 58.50,
          surgeMultiplier: 1.0
        },
        'Pickup Truck': {
          baseFare: 27.00,
          mileageCharge: 15.00,
          total: 49.14,
          surgeMultiplier: 1.0
        }
      };
      
      setVehiclePricing(fallbackPricing);
      setDistance(10.0);
      setEstimatedTime(25);
    } finally {
      setLoadingPrices(false);
    }
  };

  useEffect(() => {
    if (visible) {
      translateY.setValue(SCREEN_HEIGHT - COLLAPSED_HEIGHT);
      setIsExpanded(false);
    } else {
      setIndex(0);
      setIsExpanded(false);
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        translateY.setOffset(translateY._value);
        translateY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const newValue = gestureState.dy;
        if (newValue >= -(SCREEN_HEIGHT - COLLAPSED_HEIGHT - 100)) {
          translateY.setValue(newValue);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();

        const currentY = translateY._value;
        const velocity = gestureState.vy;
        
        let finalY;
        let shouldExpand;
        let shouldClose = false;

        if (velocity > 1.5) {
          if (currentY > SCREEN_HEIGHT - COLLAPSED_HEIGHT - 100) {
            finalY = MODAL_HEIGHT;
            shouldClose = true;
          } else {
            finalY = SCREEN_HEIGHT - COLLAPSED_HEIGHT;
            shouldExpand = false;
          }
        } else if (velocity < -1.5) {
          finalY = 100;
          shouldExpand = true;
        } else {
          const expandedThreshold = (100 + SCREEN_HEIGHT - COLLAPSED_HEIGHT) / 2;
          const closeThreshold = SCREEN_HEIGHT - COLLAPSED_HEIGHT + 50;
          
          if (currentY < expandedThreshold) {
            finalY = 100;
            shouldExpand = true;
          } else if (currentY > closeThreshold) {
            finalY = MODAL_HEIGHT;
            shouldClose = true;
          } else {
            finalY = SCREEN_HEIGHT - COLLAPSED_HEIGHT;
            shouldExpand = false;
          }
        }

        if (shouldClose) {
          Animated.spring(translateY, {
            toValue: finalY,
            useNativeDriver: false,
            tension: 100,
            friction: 8,
          }).start(() => {
            setTimeout(() => {
              translateY.setValue(MODAL_HEIGHT);
              onClose();
            }, 0);
          });
        } else {
          setTimeout(() => setIsExpanded(shouldExpand), 0);
          Animated.spring(translateY, {
            toValue: finalY,
            useNativeDriver: false,
            tension: 100,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const expandModal = () => {
    setIsExpanded(true);
    Animated.spring(translateY, {
      toValue: 100,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  };

  const closeModal = () => {
    Animated.spring(translateY, {
      toValue: MODAL_HEIGHT,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start(() => {
      setTimeout(() => {
        translateY.setValue(MODAL_HEIGHT);
        onClose();
        setIndex(0);
        setIsExpanded(false);
      }, 0);
    });
  };

  const handleNext = () => {
    const selectedVehicle = vehicles[index];
    const selectedPricing = vehiclePricing[selectedVehicle.type];
    
    if (!selectedPricing) {
      console.error('No pricing available for', selectedVehicle.type);
      // Don't proceed without pricing
      Alert.alert('Error', 'Pricing information is not available. Please try again.');
      return;
    }
    
    const vehicleWithPricing = {
      ...selectedVehicle,
      pricing: selectedPricing, // Pass the full pricing object from server
      distance: distance,
      estimatedTime: estimatedTime,
      price: `${selectedPricing.total.toFixed(2)}`, // For backward compatibility
      priceDisplay: `${selectedPricing.total.toFixed(2)}`
    };
    
    console.log('Selected vehicle with server pricing:', vehicleWithPricing);
    onNext(vehicleWithPricing);
    closeModal();
  };

  useEffect(() => {
    return () => {
      translateY.removeAllListeners();
      translateY.stopAnimation();
    };
  }, []);

  if (!visible) {
    console.log('Modal not visible, returning null');
    return null;
  }

  const current = vehicles[index];

  return (
    <>
      <TouchableWithoutFeedback onPress={closeModal}>
        <Animated.View 
          style={[
            styles.backdrop,
            {
              opacity: translateY.interpolate({
                inputRange: [100, SCREEN_HEIGHT - COLLAPSED_HEIGHT],
                outputRange: [0.5, 0],
                extrapolate: 'clamp',
              }),
            }
          ]} 
        />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.modal,
          {
            transform: [{ translateY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {!isExpanded && (
          <View style={styles.collapsedContainer}>
            {/* Vehicle Preview */}
            <TouchableOpacity 
              style={styles.collapsedHeader}
              onPress={expandModal}
              activeOpacity={0.8}
            >
              <View style={styles.collapsedContent}>
                <Image source={current.image} style={styles.collapsedVehicleImg} />
                <View style={styles.collapsedInfo}>
                  <Text style={styles.collapsedVehicleType}>{current.type}</Text>
                  {loadingPrices ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#A77BFF" />
                      <Text style={styles.loadingText}>Calculating...</Text>
                    </View>
                  ) : (
                    <Text style={styles.collapsedPrice}>
                      {vehiclePricing[current.type] 
                        ? `$${vehiclePricing[current.type].total.toFixed(2)}`
                        : (visible ? 'Loading...' : 'Calculating...')
                      }
                    </Text>
                  )}
                  {recommended === current.type && (
                    <Text style={styles.collapsedRecommended}>✨ AI Recommended</Text>
                  )}
                </View>
                <View style={styles.collapsedArrow}>
                  <Ionicons name="chevron-up" size={20} color="#aaa" />
                </View>
              </View>
            </TouchableOpacity>

            {/* Vehicle Selector */}
            <View style={styles.vehicleSelector}>
              <TouchableOpacity
                style={[styles.vehicleOption, index === 0 && styles.vehicleOptionSelected]}
                onPress={() => setIndex(0)}
              >
                <Text style={[styles.vehicleOptionText, index === 0 && styles.vehicleOptionTextSelected]}>
                  Cargo Van
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.vehicleOption, index === 1 && styles.vehicleOptionSelected]}
                onPress={() => setIndex(1)}
              >
                <Text style={[styles.vehicleOptionText, index === 1 && styles.vehicleOptionTextSelected]}>
                  Pickup Truck
                </Text>
              </TouchableOpacity>
            </View>

            {/* Collapsed Confirm Button */}
            <TouchableOpacity style={styles.collapsedConfirmButton} onPress={handleNext}>
              <Text style={styles.collapsedConfirmText}>Confirm {current.type}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>

            {/* Expand Hint */}
            <TouchableOpacity style={styles.expandHint} onPress={expandModal}>
              <Ionicons name="chevron-up" size={16} color="#666" />
              <Text style={styles.expandHintText}>Tap here to see what fits</Text>
              <Ionicons name="chevron-up" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        )}

        {isExpanded && (
          <ScrollView 
            style={styles.expandedContent} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.title}>Select Vehicle Type</Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.card}>
              <View style={styles.carouselContainer}>
                <TouchableOpacity
                  style={[styles.carouselButton, index === 0 && styles.carouselButtonDisabled]}
                  disabled={index === 0}
                  onPress={() => setIndex(index - 1)}
                >
                  <Ionicons 
                    name="chevron-back" 
                    size={24} 
                    color={index === 0 ? "#666" : "#fff"} 
                  />
                </TouchableOpacity>

                <View style={styles.vehicleContainer}>
                  <Image source={current.image} style={styles.vehicleImg} />
                  <Text style={styles.vehicleType}>{current.type}</Text>
                  
                  {recommended === current.type && (
                    <View style={styles.recommendedTag}>
                      <Ionicons name="sparkles" size={12} color="#fff" />
                      <Text style={styles.recommendedText}>AI Recommended</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.carouselButton, index === vehicles.length - 1 && styles.carouselButtonDisabled]}
                  disabled={index === vehicles.length - 1}
                  onPress={() => setIndex(index + 1)}
                >
                  <Ionicons 
                    name="chevron-forward" 
                    size={24} 
                    color={index === vehicles.length - 1 ? "#666" : "#fff"} 
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.detailsContainer}>
                <View style={styles.priceContainer}>
                  <Ionicons name="card-outline" size={16} color="#A77BFF" />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Estimated Price</Text>
                    {loadingPrices ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#A77BFF" />
                        <Text style={styles.loadingText}>Calculating...</Text>
                      </View>
                    ) : (
                      <View>
                        <Text style={styles.priceValue}>
                          {vehiclePricing[current.type] 
                            ? `$${vehiclePricing[current.type].total.toFixed(2)}`
                            : (visible ? 'Loading...' : 'Calculating...')
                          }
                        </Text>
                        {vehiclePricing[current.type] && distance > 0 && (
                          <Text style={styles.priceDetails}>
                            {distance} miles • {estimatedTime} min
                            {vehiclePricing[current.type].surgeMultiplier > 1 && 
                              ` • ${vehiclePricing[current.type].surgeMultiplier}x surge`
                            }
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.itemsSection}>
                <Text style={styles.itemsTitle}>Perfect for these items:</Text>
                <View style={styles.itemsGrid}>
                  {current.items.map((item, i) => (
                    <View key={i} style={styles.itemRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#00D4AA" />
                      <Text style={styles.itemText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Text style={styles.nextButtonText}>Select {current.type}</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 998,
  },
  modal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: MODAL_HEIGHT,
    backgroundColor: '#0A0A1F',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
  },
  collapsedContainer: {
    paddingBottom: 10,
  },
  collapsedHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  collapsedContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collapsedVehicleImg: {
    width: 50,
    height: 25,
    resizeMode: 'contain',
    marginRight: 12,
  },
  collapsedInfo: {
    flex: 1,
  },
  collapsedVehicleType: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  collapsedPrice: {
    color: '#A77BFF',
    fontSize: 13,
    fontWeight: '500',
  },
  collapsedRecommended: {
    color: '#00D4AA',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    color: '#A77BFF',
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '500',
  },
  priceDetails: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  collapsedArrow: {
    marginLeft: 10,
  },
  vehicleSelector: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 15,
    backgroundColor: '#141426',
    borderRadius: 12,
    padding: 4,
  },
  vehicleOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  vehicleOptionSelected: {
    backgroundColor: '#A77BFF',
  },
  vehicleOptionText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  vehicleOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  collapsedConfirmButton: {
    backgroundColor: '#A77BFF',
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    shadowColor: '#A77BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  collapsedConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 20,
    backgroundColor: '#141426',
    borderRadius: 15,
    marginTop: 5,
  },
  expandHintText: {
    color: '#666',
    fontSize: 12,
    marginHorizontal: 8,
    fontStyle: 'italic',
  },
  expandedContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  carouselContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  carouselButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1F1F2F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselButtonDisabled: {
    backgroundColor: '#0F0F1F',
  },
  vehicleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  vehicleImg: {
    width: 140,
    height: 70,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  vehicleType: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  recommendedTag: {
    backgroundColor: '#A77BFF',
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  recommendedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  detailsContainer: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailTextContainer: {
    marginLeft: 8,
  },
  detailLabel: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 2,
  },
  detailValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F2F',
    padding: 12,
    borderRadius: 10,
  },
  priceValue: {
    color: '#A77BFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemsSection: {
    marginBottom: 20,
  },
  itemsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  itemsGrid: {
    flexDirection: 'column',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemText: {
    color: '#eee',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  nextButton: {
    backgroundColor: '#A77BFF',
    paddingVertical: 16,
    borderRadius: 25,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#A77BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VehicleSelectionModal;