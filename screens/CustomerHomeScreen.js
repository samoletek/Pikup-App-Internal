import React, { useEffect, useState, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Switch,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { usePayment } from "../contexts/PaymentContext";
import { useDemo } from "../contexts/DemoContext";
import CustomerSearchModal from "../components/CustomerSearchModal";
import SummaryDetailsModal from "../components/SummaryDetailsModal";
import VehicleSelectionModal from "../components/VehicleSelectionModal";
import PriceSummaryModal from "../components/PriceSummaryModal";
import DeliveryStatusTracker from "../components/DeliveryStatusTracker";
import MapboxLocationService from "../services/MapboxLocationService";
import MapboxMap from "../components/mapbox/MapboxMap";
import Mapbox from '@rnmapbox/maps';

export default function CustomerHomeScreen({ navigation }) {
  const { userType, createPickupRequest, getUserPickupRequests, getRequestById, uploadMultiplePhotos } = useAuth();
  const { defaultPaymentMethod, paymentMethods } = usePayment();
  const { isDemoMode, startDemo, stopDemo, currentStage, demoData, updateDemoData, startAutoCompletion } = useDemo();

  const [region, setRegion] = useState({
    latitude: 33.749,
    longitude: -84.388,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("Loading...");
  const [activeDelivery, setActiveDelivery] = useState(null);

  // Modal states
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  // New states for enhanced ride details
  const [calculatedDistance, setCalculatedDistance] = useState(null);
  const [estimatedDuration, setEstimatedDuration] = useState(null);
  const [rideId, setRideId] = useState(null);

  const searchModalRef = useRef(null);

  // Generate ride ID when component mounts
  useEffect(() => {
    setRideId(`ride_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  // Calculate distance and duration when locations change
  useEffect(() => {
    if (selectedLocations?.pickup && selectedLocations?.dropoff) {
      calculateRouteDetails();
    }
  }, [selectedLocations]);

  // Handle return from PaymentMethodsScreen
  useFocusEffect(
    React.useCallback(() => {
      // Check if we're returning from PaymentMethodsScreen with booking context
      const unsubscribe = navigation.addListener('focus', () => {
        // Get the route params
        const params = navigation.getState()?.routes?.find(route => route.name === 'CustomerHomeScreen')?.params;
        
        if (params?.returnFromPayment && params?.bookingContext) {
          // Restore the booking context
          const { bookingContext } = params;
          setSelectedLocations(bookingContext.selectedLocations);
          setSelectedVehicle(bookingContext.selectedVehicle);
          setSummaryData(bookingContext.summaryData);
          setCalculatedDistance(bookingContext.calculatedDistance);
          setEstimatedDuration(bookingContext.estimatedDuration);
          setRideId(bookingContext.rideId);
          
          // Re-open the price modal
          setPriceModalVisible(true);
          
          // Clear the return params
          navigation.setParams({ returnFromPayment: false, bookingContext: null });
        }
      });

      return unsubscribe;
    }, [navigation])
  );

  const calculateRouteDetails = async () => {
    if (!selectedLocations?.pickup || !selectedLocations?.dropoff) {
      return;
    }

    try {
      // Get coordinates - they should already be available from the search modal
      let pickupCoords = selectedLocations.pickup.coordinates;
      let dropoffCoords = selectedLocations.dropoff.coordinates;
      
      // Only geocode if we don't have coordinates
      if (!pickupCoords && selectedLocations.pickup.address) {
        try {
          pickupCoords = await MapboxLocationService.geocodeAddress(selectedLocations.pickup.address);
        } catch (error) {
          console.log('Could not geocode pickup address:', error.message);
        }
      }
      
      if (!dropoffCoords && selectedLocations.dropoff.address) {
        try {
          dropoffCoords = await MapboxLocationService.geocodeAddress(selectedLocations.dropoff.address);
        } catch (error) {
          console.log('Could not geocode dropoff address:', error.message);
        }
      }

      // If we still don't have coordinates, use fallback
      if (!pickupCoords || !dropoffCoords) {
        console.log('Missing coordinates, using fallback estimates');
        const estimatedDistance = Math.random() * 5 + 10; // 10-15 miles
        const estimatedTime = Math.random() * 10 + 20; // 20-30 minutes
        
        setCalculatedDistance(parseFloat(estimatedDistance.toFixed(1)));
        setEstimatedDuration(Math.round(estimatedTime));
        return;
      }

      // Get the actual route with traffic data
      const routeData = await MapboxLocationService.getRoute(
        {
          latitude: pickupCoords.latitude,
          longitude: pickupCoords.longitude
        },
        {
          latitude: dropoffCoords.latitude,
          longitude: dropoffCoords.longitude
        }
      );

      // Convert distance from meters to miles and duration from seconds to minutes
      const distanceInMiles = (routeData.distance.value * 0.000621371).toFixed(1);
      const durationInMinutes = Math.round(
        routeData.duration_in_traffic ? 
        routeData.duration_in_traffic.value / 60 : 
        routeData.duration.value / 60
      );

      setCalculatedDistance(parseFloat(distanceInMiles));
      setEstimatedDuration(durationInMinutes);

      console.log(`Real route calculated: ${distanceInMiles} miles, ${durationInMinutes} minutes (with traffic)`);
    } catch (error) {
      console.error('Error calculating real route details:', error);
      
      // Fallback to estimated values based on typical city distances
      const estimatedDistance = Math.random() * 5 + 10; // 10-15 miles
      const estimatedTime = Math.random() * 10 + 20; // 20-30 minutes
      
      setCalculatedDistance(parseFloat(estimatedDistance.toFixed(1)));
      setEstimatedDuration(Math.round(estimatedTime));
      
      console.log(`Using fallback estimates: ${estimatedDistance.toFixed(1)} miles, ${Math.round(estimatedTime)} minutes`);
    }
  };

  // Demo mode handlers
  const toggleDemoMode = () => {
    if (isDemoMode) {
      stopDemo();
    }
  };

  const handleStartDemoFlow = () => {
    // Start the demo flow with the search modal
    startDemo();
    // Open the search modal
    setSearchModalVisible(true);
  };

  useEffect(() => {
    getCurrentLocation();
    
    // Check for active deliveries
    const checkActiveDeliveries = async () => {
      try {
        const requests = await getUserPickupRequests();
        const activeRequest = requests.find(req => 
          ['accepted', 'inProgress', 'arrivedAtPickup', 'pickedUp', 'enRouteToDropoff', 'arrivedAtDropoff'].includes(req.status)
        );
        
        if (activeRequest) {
          setActiveDelivery(activeRequest);
        } else {
          setActiveDelivery(null);
        }
      } catch (error) {
        console.error('Error checking for active deliveries:', error);
      }
    };
    
    checkActiveDeliveries();
    
    // Set up a timer to check periodically
    const intervalCheck = setInterval(checkActiveDeliveries, 30000);
    
    return () => {
      clearInterval(intervalCheck);
    };
  }, []);

  const getCurrentLocation = async () => {
    try {
      setLocationStatus("Requesting permissions...");
      
      setLocationStatus("Getting location...");
      const location = await MapboxLocationService.getCurrentLocation();

      const newRegion = {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      setRegion(newRegion);
      setUserLocation({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      setLocationStatus(`Location found`);
    } catch (error) {
      console.error("Location error:", error);
      setLocationStatus(`Using default location`);
    }
  };

  // Add these new handler functions for DeliveryStatusTracker
  const handleDeliveryComplete = (deliveryData) => {
    setActiveDelivery(null);
    // Navigate to feedback screen
    navigation.navigate("DeliveryFeedbackScreen", {
      requestId: deliveryData.id
    });
  };

  const handleViewFullTracker = (requestId) => {
    navigation.navigate('DeliveryTrackingScreen', {
      requestId: requestId || (activeDelivery && activeDelivery.id),
      requestData: activeDelivery
    });
  };

  // Modal handlers - Updated to handle demo mode
  const handleSearchConfirm = (locationData) => {
    console.log(
      "Search confirmed with location data:",
      JSON.stringify(locationData, null, 2)
    );

    // Make sure we have all the required data
    if (!locationData.pickup || !locationData.dropoff) {
      Alert.alert(
        "Missing Information",
        "Please provide both pickup and dropoff locations."
      );
      return;
    }

    // The location data from CustomerSearchModal already has the correct structure
    // Just use it directly without transformation
    console.log("🔍 Setting selectedLocations to:", locationData);
    setSelectedLocations(locationData);

    // In demo mode, update the demo data
    if (isDemoMode && currentStage === 'SEARCH_LOCATION') {
      updateDemoData({
        pickup: locationData.pickup.address,
        dropoff: locationData.dropoff.address
      }, 'SUMMARY_DETAILS');
    }

    // Close current modal and open next one
    setSearchModalVisible(false);
    setTimeout(() => {
      setSummaryModalVisible(true);
    }, 300); // Small delay to allow animation to complete
  };

  const handleSummaryNext = async (summaryInfo) => {
    console.log("Summary next with data:", summaryInfo);
    console.log("🔍 selectedLocations at handleSummaryNext start:", selectedLocations);
    
    try {
      // If there are photos, upload them to Firebase Storage first
      if (summaryInfo.photos && summaryInfo.photos.length > 0) {
        setIsUploadingPhotos(true);
        console.log(`Uploading ${summaryInfo.photos.length} customer photos...`);
        
        // Create a temporary request ID for photo storage
        const tempRequestId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Upload photos to Firebase Storage using new path structure
        const uploadedPhotos = await uploadMultiplePhotos(
          summaryInfo.photos, 
          `photos/${tempRequestId}/pickup`
        );
        
        console.log('Customer photos uploaded successfully:', uploadedPhotos);
        
        // Add uploaded photo URLs to summary data
        summaryInfo.uploadedPhotos = uploadedPhotos;
        summaryInfo.tempRequestId = tempRequestId; // Store temp ID for later cleanup if needed
      }
      
      setSummaryData(summaryInfo);
      setIsUploadingPhotos(false);
      
      // In demo mode, update the demo data
      if (isDemoMode && currentStage === 'SUMMARY_DETAILS') {
        updateDemoData({
          itemDescription: summaryInfo.itemDescription,
          needsHelp: summaryInfo.needsHelp,
          specialInstructions: summaryInfo.specialInstructions
        }, 'VEHICLE_SELECTION');
      }

      // Close current modal and open next one
      console.log("🔍 selectedLocations before opening vehicle modal:", selectedLocations);
      setSummaryModalVisible(false);
      setVehicleModalVisible(true);
      
    } catch (error) {
      setIsUploadingPhotos(false);
      console.error('Error uploading customer photos:', error);
      Alert.alert(
        'Upload Error',
        'Failed to upload photos. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSearchClose = () => {
    setSearchModalVisible(false);
    // Don't clear selectedLocations here - only clear if user actually cancels
    // selectedLocations should persist when transitioning between modals
  };

  const handleSummaryClose = () => {
    setSummaryModalVisible(false);
  };

  const handleVehicleSelection = (vehicle) => {
    setSelectedVehicle(vehicle);
    
    // In demo mode, update the demo data
    if (isDemoMode && currentStage === 'VEHICLE_SELECTION') {
      updateDemoData({
        vehicle: vehicle
      }, 'PRICE_SUMMARY');
    }
    
    setVehicleModalVisible(false);
    setPriceModalVisible(true);
  };

  // Helper function to calculate total
  const calculateTotal = () => {
    const basePrice = parseFloat(
      selectedVehicle?.price?.replace("$", "") || "40.00"
    );
    const serviceFee = 2.99;
    const tax = basePrice * 0.08;
    return (basePrice + serviceFee + tax).toFixed(2);
  };

  // Handle navigation to payment methods screen with return capability
  const handleNavigateToPaymentMethods = () => {
    // Close the price modal first
    setPriceModalVisible(false);
    
    // Navigate to payment methods screen
    navigation.navigate("PaymentMethodsScreen", {
      // Pass return path so PaymentMethodsScreen knows where to return
      returnTo: 'PriceSummary',
      // Preserve all current booking data
      bookingContext: {
        selectedLocations,
        selectedVehicle,
        summaryData,
        calculatedDistance,
        estimatedDuration,
        rideId
      }
    });
  };

  const handleSchedulePickup = async (bookingData = null) => {
    console.log("Schedule pickup initiated with booking data:", bookingData);

    try {
      // Now selectedLocations already has the proper structure with nested address and coordinates
      const pickupRequestData = {
        // Use the properly structured location data
        pickup: selectedLocations?.pickup || {
          address: "",
          coordinates: null
        },
        dropoff: selectedLocations?.dropoff || {
          address: "",
          coordinates: null
        },
        item: {
          description: summaryData?.itemDescription || "",
          needsHelp: summaryData?.needsHelp || false,
          type: summaryData?.itemType || "Package"
        },
        // Customer photos uploaded to Firebase Storage
        customerPhotos: summaryData?.uploadedPhotos || [],
        vehicle: {
          type: selectedVehicle?.type || "",
          required: selectedVehicle?.required || false
        },
        pricing: selectedVehicle?.pricing || {
          base: parseFloat(selectedVehicle?.price?.replace("$", "") || "0"),
          distance: 0,
          weight: 0,
          helper: summaryData?.needsHelp ? 10 : 0,
          serviceFee: 2.99,
          tax: parseFloat(selectedVehicle?.price?.replace("$", "") || "0") * 0.08,
          total: parseFloat(calculateTotal())
        },
        payment: {
          paymentIntentId: bookingData?.paymentIntent?.id || null,
          paymentMethodId: bookingData?.paymentMethod?.id || null,
          total: parseFloat(calculateTotal()),
          status: "completed",
        },
        // Include scheduling information
        isScheduled: selectedLocations?.isScheduled || false,
        scheduledTime:
          selectedLocations?.isScheduled && selectedLocations?.scheduledDateTime
            ? selectedLocations.scheduledDateTime.dateTime.toISOString()
            : null,
        scheduledDateTime: selectedLocations?.scheduledDateTime || null,
        specialInstructions: summaryData?.specialInstructions || "",
        // Add enhanced ride details
        estimatedDistance: calculatedDistance ? `${calculatedDistance} mi` : null,
        estimatedTime: estimatedDuration ? `${estimatedDuration} min` : null,
        distance: calculatedDistance ? `${calculatedDistance} mi` : null,
        duration: estimatedDuration ? `${estimatedDuration} min` : null,
        rideId: rideId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // In demo mode, start auto-completion after price summary
      if (isDemoMode && currentStage === 'PRICE_SUMMARY') {
        setPriceModalVisible(false);
        startAutoCompletion();
        return;
      }

      console.log("Creating pickup request with data:", JSON.stringify(pickupRequestData, null, 2));

      // Save to Firebase
      const newRequest = await createPickupRequest(pickupRequestData);
      console.log("Pickup request created successfully:", newRequest);

      // Close the modal
      setPriceModalVisible(false);

      // Navigate to the next screen with the request data
      setTimeout(() => {
        try {
          console.log("Navigating directly to DeliveryTrackingScreen");
          navigation.navigate("DeliveryTrackingScreen", {
            requestId: newRequest.id,
            requestData: newRequest,
          });
        } catch (error) {
          console.error("Navigation error to DeliveryTrackingScreen:", error);
          // Fallback to RouteConfirmationScreen
          navigation.navigate("RouteConfirmationScreen", {
            selectedLocations,
            selectedVehicle,
            summaryData,
            requestId: newRequest.id,
            requestData: newRequest,
            paymentData: bookingData,
          });
        }
      }, 300);
    } catch (error) {
      console.error("Error creating pickup request:", error);

      // Show user-friendly error message
      Alert.alert(
        "Booking Error",
        "Sorry, we couldn't create your pickup request. Please try again.",
        [{ text: "OK" }]
      );
    }
  };



  const checkPaymentMethodBeforeBooking = () => {
    // Allow booking to proceed - payment method check will happen at payment screen
    return true;
  };

  const handleRequestPickup = () => {
    console.log("Request pickup pressed - checking payment method");

    if (!checkPaymentMethodBeforeBooking()) {
      return;
    }

    console.log("Payment method available - opening modal");
    setSearchModalVisible(true);
    setTimeout(() => {
      searchModalRef.current?.openExpanded();
    }, 100);
  };

  const handleSearchBarPress = () => {
    console.log("Search bar pressed - checking payment method");

    if (!checkPaymentMethodBeforeBooking()) {
      return;
    }

    console.log("Payment method available - opening modal");
    setSearchModalVisible(true);
    setTimeout(() => {
      searchModalRef.current?.openExpanded();
    }, 100);
  };

  // Render demo mode controls
  const renderDemoControls = () => {
    return (
      <View style={styles.demoContainer}>
        <View style={styles.demoHeader}>
          <Text style={styles.demoTitle}>Demo Mode</Text>
          <Switch
            value={isDemoMode}
            onValueChange={toggleDemoMode}
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={isDemoMode ? "#2196F3" : "#f4f3f4"}
          />
        </View>
        
        {!isDemoMode && (
          <TouchableOpacity 
            style={styles.demoButton}
            onPress={handleStartDemoFlow}
          >
            <Text style={styles.demoButtonText}>Start Demo Flow</Text>
          </TouchableOpacity>
        )}
        
        {isDemoMode && (
          <View style={styles.demoStageContainer}>
            <Text style={styles.demoStageText}>Current Stage: {currentStage}</Text>
            <Text style={styles.demoInstructions}>
              {currentStage === 'SEARCH_LOCATION' && 'Enter pickup and dropoff locations'}
              {currentStage === 'SUMMARY_DETAILS' && 'Enter item details and continue'}
              {currentStage === 'VEHICLE_SELECTION' && 'Select a vehicle type'}
              {currentStage === 'PRICE_SUMMARY' && 'Review and confirm price'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <MapboxMap
        style={styles.map}
        centerCoordinate={userLocation ? [userLocation.longitude, userLocation.latitude] : [-84.388, 33.749]}
        zoomLevel={14}
      >
        <Mapbox.UserLocation visible={true} />
      </MapboxMap>


      {/* Status Bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{locationStatus}</Text>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require("../assets/pikup-logo.png")}
          style={styles.headerLogo}
          accessible
          accessibilityLabel="PikUp"
        />
      </View>

      {/* Delivery Status Tracker - Only show when there's an active delivery */}
      {activeDelivery && (
        <View style={styles.trackerContainer}>
          <DeliveryStatusTracker 
            requestId={activeDelivery.id}
            onDeliveryComplete={isDemoMode ? null : handleDeliveryComplete}
            onViewFullTracker={() => handleViewFullTracker(activeDelivery.id)}
          />
        </View>
      )}

      {/* Search Bar */}
      <TouchableOpacity
        style={[styles.searchBar, activeDelivery && styles.searchBarWithTracker]}
        activeOpacity={0.8}
        onPress={handleSearchBarPress}
      >
        <Ionicons
          name="search"
          size={20}
          color="#999"
          style={styles.searchIcon}
        />
        <Text style={styles.searchPlaceholder}>
          Search for pickup locations
        </Text>
      </TouchableOpacity>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.requestButton}
          onPress={handleRequestPickup}
        >
          <Text style={styles.requestButtonText}>Request Pickup</Text>
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <CustomerSearchModal
        ref={searchModalRef}
        visible={searchModalVisible}
        onClose={handleSearchClose}
        onConfirm={handleSearchConfirm}
      />

      <SummaryDetailsModal
        visible={summaryModalVisible}
        onClose={handleSummaryClose}
        onNext={handleSummaryNext}
        selectedLocations={selectedLocations}
        isUploadingPhotos={isUploadingPhotos}
      />

      <VehicleSelectionModal
        visible={vehicleModalVisible}
        onClose={() => setVehicleModalVisible(false)}
        onNext={handleVehicleSelection}
        description={summaryData?.itemDescription || ""}
        selectedLocations={selectedLocations}
        summaryData={summaryData}
      />

      {/* UPDATED: PriceSummaryModal with new props */}
      <PriceSummaryModal
        visible={priceModalVisible}
        onClose={() => setPriceModalVisible(false)}
        onSchedulePickup={handleSchedulePickup}
        selectedVehicle={selectedVehicle}
        selectedLocations={selectedLocations}
        total={null} // Let PriceSummaryModal calculate its own total using server pricing
        isDemo={isDemoMode && currentStage === 'PRICE_SUMMARY'}
        // NEW PROPS FOR ENHANCED FUNCTIONALITY
        distance={calculatedDistance}
        duration={estimatedDuration}
        rideId={rideId}
        // Payment method navigation callback
        onNavigateToPaymentMethods={handleNavigateToPaymentMethods}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    zIndex: 10,
  },
  trackerContainer: {
    position: "absolute",
    top: 100,
    left: 0,
    right: 0,
    zIndex: 15,
  },
  headerLogo: {
    width: 350,
    aspectRatio: 5.08,
    height: undefined,
    resizeMode: "contain",
    alignSelf: "center",
  },

  searchBar: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    height: 50,
    backgroundColor: "rgba(30, 30, 50, 0.95)",
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  searchBarWithTracker: {
    top: 160, // Move search bar down when tracker is visible
  },
  searchIcon: {
    marginRight: 12,
  },
  searchPlaceholder: {
    color: "#999",
    fontSize: 16,
    flex: 1,
  },
  bottomSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  requestButton: {
    backgroundColor: "#A77BFF",
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
    shadowColor: "#A77BFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  requestButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  demoContainer: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 10,
    width: 200,
    zIndex: 1000,
  },
  demoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  demoTitle: {
    color: 'white',
    fontWeight: 'bold',
  },
  demoButton: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  demoButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  demoStageContainer: {
    marginTop: 10,
  },
  demoStageText: {
    color: 'white',
    fontSize: 12,
  },
  demoInstructions: {
    color: 'white',
    fontSize: 12,
  },
  statusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 10,
    zIndex: 1000,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#A77BFF',
    borderWidth: 3,
    borderColor: '#fff',
  },
});

// Improved dark map style to match your preview
const improvedDarkMapStyle = [
  {
    elementType: "geometry",
    stylers: [
      {
        color: "#1d2c4d",
      },
    ],
  },
  {
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#8ec3b9",
      },
    ],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [
      {
        color: "#1a3646",
      },
    ],
  },
  {
    featureType: "administrative.country",
    elementType: "geometry.stroke",
    stylers: [
      {
        color: "#4b6878",
      },
    ],
  },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#64779f",
      },
    ],
  },
  {
    featureType: "administrative.province",
    elementType: "geometry.stroke",
    stylers: [
      {
        color: "#4b6878",
      },
    ],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry.stroke",
    stylers: [
      {
        color: "#334e87",
      },
    ],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [
      {
        color: "#023e58",
      },
    ],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [
      {
        color: "#283d6a",
      },
    ],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#6f9ba5",
      },
    ],
  },
  {
    featureType: "poi",
    elementType: "labels.text.stroke",
    stylers: [
      {
        color: "#1d2c4d",
      },
    ],
  },
  {
    featureType: "poi.park",
    elementType: "geometry.fill",
    stylers: [
      {
        color: "#023e58",
      },
    ],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#3C7680",
      },
    ],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [
      {
        color: "#304a7d",
      },
    ],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#98a5be",
      },
    ],
  },
  {
    featureType: "road",
    elementType: "labels.text.stroke",
    stylers: [
      {
        color: "#1d2c4d",
      },
    ],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [
      {
        color: "#2c5aa0",
      },
    ],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [
      {
        color: "#255763",
      },
    ],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#b0d5ce",
      },
    ],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.stroke",
    stylers: [
      {
        color: "#023e58",
      },
    ],
  },
  {
    featureType: "transit",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#98a5be",
      },
    ],
  },
  {
    featureType: "transit",
    elementType: "labels.text.stroke",
    stylers: [
      {
        color: "#1d2c4d",
      },
    ],
  },
  {
    featureType: "transit.line",
    elementType: "geometry.fill",
    stylers: [
      {
        color: "#283d6a",
      },
    ],
  },
  {
    featureType: "transit.station",
    elementType: "geometry",
    stylers: [
      {
        color: "#3a4762",
      },
    ],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [
      {
        color: "#0e1626",
      },
    ],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#4e6d70",
      },
    ],
  },
];