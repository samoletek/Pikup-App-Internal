import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePayment } from "../contexts/PaymentContext";
import { useAuth } from "../contexts/AuthContext";
import AddPaymentMethodModal from "../components/AddPaymentMethodModal";

const { height } = Dimensions.get("window");

// Error messages for insurance failures
const ERROR_COPY = {
  INSURANCE_UNAVAILABLE: "Insurance is temporarily unavailable. Please try again.",
  ITEM_VALUE_REQUIRED: "Please enter the item value to get coverage.",
  INSURANCE_REQUIRED: "Insurance is required for this ride. Please try again."
};

const PriceSummaryModal = ({
  visible,
  onClose,
  onSchedulePickup,
  selectedVehicle,
  selectedLocations = {},
  total: providedTotal,
  isDemo = false,
  // New props for enhanced ride details
  distance,
  duration,
  rideId,
  // Navigation callback for payment methods
  onNavigateToPaymentMethods,
  // New prop for item value
  summaryData = {},
}) => {
  const [addPaymentModalVisible, setAddPaymentModalVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(height));
  const [processing, setProcessing] = useState(false);
  
  // NEW: Insurance state - always included by default
  const [includeCoverage, setIncludeCoverage] = useState(true);
  const [insuranceQuote, setInsuranceQuote] = useState(null);
  const [loadingInsurance, setLoadingInsurance] = useState(false);
  
  // Error handling for insurance failures
  const [insuranceError, setInsuranceError] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  
  // UX Improvements: Expandable sections
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);
  const [showTripDetails, setShowTripDetails] = useState(true);
  const [priceBreakdownAnim] = useState(new Animated.Value(0));
  const [tripDetailsAnim] = useState(new Animated.Value(1));
  const [toggleAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(1));

  const {
    defaultPaymentMethod,
    paymentMethods,
    createPaymentIntent,
    confirmPayment,
    getPriceEstimate,
    loading: paymentLoading,
  } = usePayment();

  const { currentUser, authFetch } = useAuth();
  const itemValue = summaryData?.itemValue || 500;

  // Payment service URL - configured for your backend
  const PAYMENT_SERVICE_URL = 'https://pikup-server.onrender.com';

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
      
      // Initialize toggle animation based on current state
      toggleAnim.setValue(includeCoverage ? 1 : 0);
      
      // Use pricing from VehicleSelectionModal - no additional API calls needed
    } else {
      Animated.spring(slideAnim, {
        toValue: height,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [visible]);

  // Auto-fetch insurance quote when modal opens and coverage is enabled
  useEffect(() => {
    if (visible && includeCoverage && !insuranceQuote) {
      fetchInsuranceQuote();
    }
  }, [visible, includeCoverage, insuranceQuote]);

  // Removed fetchDynamicPricing - using server pricing from VehicleSelectionModal
  // This prevents duplicate API calls that were causing 400 errors

  // No need to refetch pricing when coverage changes - recalculate locally
  // Server pricing is already available from VehicleSelectionModal

  const handleClose = () => {
    Animated.spring(slideAnim, {
      toValue: height,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      onClose();
    });
  };

  // Clean calculateTotal - no fallback insurance pricing
  const calculateTotal = () => {
    // Use pricing from vehicle selection (existing working logic)
    if (selectedVehicle?.pricing?.total) {
      const baseTotal = selectedVehicle.pricing.total;
      
      // Clean insurance logic: $0 if no coverage, real quote if coverage
      const coverageFee = includeCoverage && insuranceQuote?.premium 
        ? insuranceQuote.premium 
        : 0;
      
      const coverageTax = coverageFee * 0.08; // Tax only on actual coverage fee
      return (baseTotal + coverageFee + coverageTax).toFixed(2);
    }

    // Keep existing fallback for base pricing (no insurance fallback)
    if (providedTotal) {
      return providedTotal;
    }
    
    const basePrice = parseFloat(
      selectedVehicle?.price?.replace("$", "") || "40.00"
    );
    const serviceFee = 2.99;
    
    // Clean: only add insurance if we have a real quote
    const coverageFee = includeCoverage && insuranceQuote?.premium 
      ? insuranceQuote.premium 
      : 0;
    
    const tax = (basePrice + serviceFee + coverageFee) * 0.08;
    return (basePrice + serviceFee + coverageFee + tax).toFixed(2);
  };

  // Fetch insurance quote with proper error handling
  const fetchInsuranceQuote = async () => {
    setLoadingQuote(true);
    setInsuranceError(null);
    setLoadingInsurance(true);

    try {
      const response = await authFetch(`${PAYMENT_SERVICE_URL}/calculate-price`, {
        method: 'POST',
        body: JSON.stringify({
          vehicleType: selectedVehicle?.type,
          distance: selectedVehicle?.distance || distance,
          includeCoverage: true,
          itemValue: itemValue,
          origin: selectedLocations?.pickup?.formatted || selectedLocations?.pickup?.address,
          destination: selectedLocations?.dropoff?.formatted || selectedLocations?.dropoff?.address,
          userEmail: currentUser?.email,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setInsuranceError(ERROR_COPY[err.code] || "Unable to calculate price. Please try again.");
        setInsuranceQuote(null);
        return;
      }

      const result = await response.json();
      if (result.success && result.insurance) {
        setInsuranceQuote(result.insurance);
        console.log('Insurance quote received:', result.insurance);
      } else {
        setInsuranceError("Unable to get insurance quote. Please try again.");
        setInsuranceQuote(null);
      }
    } catch (error) {
      console.error('Insurance quote request failed:', error);
      setInsuranceError("Network error. Please check your connection and try again.");
      setInsuranceQuote(null);
    } finally {
      setLoadingInsurance(false);
      setLoadingQuote(false);
    }
  };

  const handleSchedule = async () => {
    // If in demo mode, skip payment processing
    if (isDemo) {
      handleClose();
      setTimeout(() => {
        onSchedulePickup();
      }, 400);
      return;
    }
    
    // Regular flow for non-demo mode
    // Check if user has a payment method
    if (!defaultPaymentMethod && paymentMethods.length === 0) {
      Alert.alert(
        "Payment Method Required",
        "Please add a payment method to schedule your pickup.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add Payment Method",
            onPress: () => setAddPaymentModalVisible(true),
          },
        ]
      );
      return;
    }

    setProcessing(true);
    console.log("Schedule button pressed");

    try {
      // Create payment intent with enhanced ride details
      const total = calculateTotal();
      const rideDetails = {
        vehicleType: selectedVehicle?.type,
        pickup: selectedLocations?.pickup,
        dropoff: selectedLocations?.dropoff,
        distance,
        duration,
        includeCoverage,
        rideId,
        timestamp: new Date().toISOString(),
        
        // Insurance always included - require quote data
        insurance: {
          included: true,
          ...(insuranceQuote ? {
            offerId: insuranceQuote.offerId,
            quoteId: insuranceQuote.quoteId,
            premium: insuranceQuote.premium,
            currency: insuranceQuote.currency || 'USD',
          } : {}),
        },
        itemValue: itemValue
      };

      const paymentIntentResult = await createPaymentIntent(
        parseFloat(total),
        'usd',
        rideDetails
      );

      if (!paymentIntentResult.success) {
        // Handle specific insurance error codes
        const error = paymentIntentResult.error;
        const errorCode = paymentIntentResult.errorCode;
        
        switch (errorCode) {
          case 'INSURANCE_UNAVAILABLE':
            Alert.alert(
              'Coverage Unavailable',
              'Please refresh the price and try again.',
              [{ text: 'Refresh', onPress: fetchInsuranceQuote }]
            );
            break;
          case 'ITEM_VALUE_REQUIRED':
            setInsuranceError(ERROR_COPY.ITEM_VALUE_REQUIRED);
            break;
          case 'INSURANCE_REQUIRED':
            Alert.alert('Error', ERROR_COPY.INSURANCE_REQUIRED);
            break;
          default:
            Alert.alert('Payment Error', error || 'Failed to create payment.');
        }
        return;
      }

      // Process payment directly without showing matching modal
      console.log("Processing payment...");

      try {
        // Confirm payment
        const paymentResult = await confirmPayment(
          paymentIntentResult.paymentIntent.client_secret,
          defaultPaymentMethod?.stripePaymentMethodId
        );

        if (!paymentResult.success) {
          throw new Error(paymentResult.error);
        }

        console.log("Payment successful, completing booking...");

        // Close price modal and proceed
        handleClose();

        // Wait for price modal animation to complete before navigation
        setTimeout(() => {
          console.log("Calling onSchedule - should save data and navigate");

          // Create enhanced booking data with payment info
          const bookingData = {
            selectedVehicle,
            selectedLocations,
            paymentIntent: paymentResult.paymentIntent,
            paymentMethod: defaultPaymentMethod,
            total,
            includeCoverage,
            distance,
            duration,
            rideId,
            serverPricing: selectedVehicle?.pricing,
            timestamp: new Date().toISOString(),
            // Include insurance data only if we have it
            ...(insuranceQuote ? { insurance: insuranceQuote, itemValue } : {})
          };

          onSchedulePickup(bookingData);
        }, 400);
      } catch (paymentError) {
        console.error("Payment failed:", paymentError);
        
        // Enhanced payment error handling with recovery options
        Alert.alert(
          "Payment Issue",
          paymentError.message ||
            "We couldn't process your payment. Please try again.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Update Payment Method",
              onPress: () => {
                // Open payment method selection/addition
                setAddPaymentModalVisible(true);
              }
            },
            {
              text: "Try Again",
              style: "default",
              onPress: () => {
                // Retry the payment with the same configuration
                setTimeout(() => handleSchedule(), 500);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error("Error scheduling pickup:", error);
      Alert.alert(
        "Booking Error",
        error.message ||
          "There was an issue scheduling your pickup. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setProcessing(false);
    }
  };

  const handlePaymentMethodPress = () => {
    if (paymentMethods.length === 0) {
      // Show choice between quick add or full payment methods screen
      Alert.alert(
        "Add Payment Method",
        "How would you like to add a payment method?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Quick Add",
            onPress: () => setAddPaymentModalVisible(true),
          },
          {
            text: "Manage Methods",
            onPress: () => {
              // Close this modal and navigate to payment methods screen
              handleClose();
              // Small delay to ensure modal closes before navigation
              setTimeout(() => {
                // This will be handled by the parent component
                if (onNavigateToPaymentMethods) {
                  onNavigateToPaymentMethods();
                }
              }, 300);
            },
          },
        ]
      );
    } else {
      // Navigate to payment methods screen to manage existing methods
      handleClose();
      setTimeout(() => {
        if (onNavigateToPaymentMethods) {
          onNavigateToPaymentMethods();
        }
      }, 300);
    }
  };

  const getPaymentMethodDisplay = () => {
    if (!defaultPaymentMethod) {
      return {
        icon: "add-circle-outline",
        text: "Add Payment Method",
        subtext: "Required for pickup",
      };
    }

    return {
      icon: "card",
      text: `${defaultPaymentMethod.brand?.toUpperCase()} •••• ${
        defaultPaymentMethod.last4
      }`,
      subtext: `Expires ${defaultPaymentMethod.expMonth}/${defaultPaymentMethod.expYear}`,
    };
  };

  // Handle coverage toggle - clean logic with animations
  const handleCoverageToggle = () => {
    const newValue = !includeCoverage;
    
    // Scale animation for feedback
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Toggle switch animation
    Animated.spring(toggleAnim, {
      toValue: newValue ? 1 : 0,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
    
    setIncludeCoverage(newValue);
    
    if (newValue) {
      // User wants coverage - fetch quote if we don't have one
      if (!insuranceQuote) {
        fetchInsuranceQuote();
      }
    } else {
      // User disabled coverage - keep quote for later but don't use it in pricing
      // (insuranceQuote stays in state in case they toggle back on)
    }
  };

  // Clean getPricingData with no fallback insurance
  const getPricingData = () => {
    if (selectedVehicle?.pricing) {
      const vehiclePricing = selectedVehicle.pricing;
      
      // Clean: only use insurance premium if coverage is enabled AND we have a quote
      const coverageFee = includeCoverage && insuranceQuote?.premium 
        ? insuranceQuote.premium 
        : 0;
      
      const subtotalWithCoverage = vehiclePricing.subtotal + coverageFee;
      const totalTax = (subtotalWithCoverage + vehiclePricing.serviceFee) * 0.08;
      const total = subtotalWithCoverage + vehiclePricing.serviceFee + totalTax;
      
      return {
        basePrice: vehiclePricing.baseFare + vehiclePricing.mileageCharge,
        serviceFee: vehiclePricing.serviceFee,
        coverageFee: coverageFee,
        tax: totalTax,
        surgeMultiplier: vehiclePricing.surgeMultiplier || 1,
        total: total.toFixed(2),
        driverEarnings: vehiclePricing.driverEarnings,
        breakdown: vehiclePricing.breakdown,
      };
    }

    // Fallback calculation (no insurance fallback)
    const basePrice = parseFloat(
      selectedVehicle?.price?.replace("$", "") || "40.00"
    );
    const serviceFee = 2.99;
    
    // Clean: only add insurance if we have a real quote
    const coverageFee = includeCoverage && insuranceQuote?.premium 
      ? insuranceQuote.premium 
      : 0;
    
    const subtotal = basePrice + serviceFee + coverageFee;
    const tax = subtotal * 0.08;

    return {
      basePrice,
      serviceFee,
      coverageFee,
      tax,
      surgeMultiplier: 1,
      total: calculateTotal(),
    };
  };

  const pricing = getPricingData();
  const paymentDisplay = getPaymentMethodDisplay();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      >
        <View style={styles.backdropOverlay} />
      </TouchableOpacity>

      {/* Modal Content */}
      <Animated.View
        style={[
          styles.modalContainer,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Price Summary</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* Trip Details */}
          <View style={styles.tripSection}>
            <TouchableOpacity 
              style={styles.sectionHeader}
              onPress={() => {
                const newValue = !showTripDetails;
                setShowTripDetails(newValue);
                Animated.timing(tripDetailsAnim, {
                  toValue: newValue ? 1 : 0,
                  duration: 300,
                  useNativeDriver: false,
                }).start();
              }}
            >
              <Text style={styles.sectionTitle}>Trip Details</Text>
              <Ionicons 
                name={showTripDetails ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#A77BFF" 
              />
            </TouchableOpacity>
            <Animated.View 
              style={[{
                opacity: tripDetailsAnim,
                maxHeight: tripDetailsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 200]
                })
              }]}
            >
              <View style={styles.locationRow}>
              <Ionicons name="radio-button-on" size={12} color="#00D4AA" />
              <Text style={styles.locationText}>
                {selectedLocations?.pickup?.address || "Pickup Location"}
              </Text>
            </View>
            <View style={styles.dotLine}>
              {[...Array(3)].map((_, i) => (
                <View key={i} style={styles.dot} />
              ))}
            </View>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={12} color="#A77BFF" />
              <Text style={styles.locationText}>
                {selectedLocations?.dropoff?.address || "Drop-off Location"}
              </Text>
            </View>
            {/* Show distance and duration if available */}
            {(distance || duration) && (
              <View style={styles.tripDetails}>
                {distance && (
                  <Text style={styles.tripDetailText}>
                    Distance: {distance} miles
                  </Text>
                )}
                {duration && (
                  <Text style={styles.tripDetailText}>
                    Duration: {duration} mins
                  </Text>
                )}
              </View>
            )}
            </Animated.View>
          </View>

          {/* Vehicle Info */}
          <View style={styles.vehicleSection}>
            <Text style={styles.sectionTitle}>Selected Vehicle</Text>
            <View style={styles.vehicleRow}>
              <Image
                source={selectedVehicle?.image}
                style={styles.vehicleImage}
              />
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleType}>
                  {selectedVehicle?.type || "Cargo Van"}
                </Text>
                <Text style={styles.vehicleEta}>
                  Arrives in {selectedVehicle?.arrival || "15 mins"}
                </Text>
              </View>
            </View>
          </View>

          {/* Coverage Always Included */}
          <View style={styles.coverageSection}>
            <View style={styles.coverageDisplay}>
              <View style={styles.coverageLeft}>
                <Ionicons
                  name="shield-checkmark"
                  size={24}
                  color="#00D4AA"
                />
                <View style={styles.coverageInfo}>
                  <Text style={styles.coverageTitle}>Item Protection</Text>
                  <Text style={styles.coverageDescription}>
                    Protecting items up to ${itemValue.toLocaleString()} during transport
                  </Text>
                </View>
              </View>
              <View style={styles.coverageRight}>
                <Text style={styles.coveragePrice}>
                  {loadingInsurance
                    ? "Getting quote..."
                    : insuranceError
                      ? "Unavailable"
                      : insuranceQuote?.premium
                        ? `$${insuranceQuote.premium.toFixed(2)}`
                        : "Included"}
                </Text>
                <Ionicons name="checkmark-circle" size={20} color="#00D4AA" />
              </View>
            </View>
            
            {loadingInsurance && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#A77BFF" />
                <Text style={styles.loadingText}>Getting insurance quote...</Text>
              </View>
            )}
            
            {/* Show error state if quote unavailable */}
            {!loadingInsurance && !insuranceQuote && (
              <View style={styles.errorContainer}>
                <Ionicons name="warning-outline" size={16} color="#FF6B6B" />
                <Text style={styles.errorText}>
                  Insurance coverage is temporarily unavailable. Please retry.
                </Text>
              </View>
            )}
          </View>

          {/* Insurance Error Banner */}
          {insuranceError && (
            <View style={styles.errorBanner}>
              <View style={styles.errorBannerContent}>
                <Ionicons name="warning-outline" size={20} color="#ff9b9b" />
                <Text style={styles.errorBannerText}>{insuranceError}</Text>
              </View>
              <TouchableOpacity onPress={fetchInsuranceQuote} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Price Breakdown */}
          <View style={styles.summaryBox}>
            <TouchableOpacity 
              style={styles.summaryHeader}
              onPress={() => {
                const newValue = !showPriceBreakdown;
                setShowPriceBreakdown(newValue);
                Animated.timing(priceBreakdownAnim, {
                  toValue: newValue ? 1 : 0,
                  duration: 300,
                  useNativeDriver: false,
                }).start();
              }}
            >
              <Text style={styles.sectionTitle}>Price Breakdown</Text>
              <View style={styles.summaryHeaderRight}>
                <Text style={styles.totalPrice}>${pricing.total}</Text>
                <Ionicons 
                  name={showPriceBreakdown ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color="#A77BFF" 
                />
              </View>
            </TouchableOpacity>

            <Animated.View 
              style={[{
                opacity: priceBreakdownAnim,
                maxHeight: priceBreakdownAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 300]
                })
              }]}
            >
              {pricing.surgeMultiplier > 1 && (
                <View style={styles.surgeIndicator}>
                  <Ionicons name="flash" size={16} color="#FF6B6B" />
                  <Text style={styles.surgeText}>
                    {pricing.surgeMultiplier}x surge
                  </Text>
                </View>
              )}

            <View style={styles.priceRow}>
              <Text style={styles.label}>Base Price</Text>
              <Text style={styles.price}>${pricing.basePrice.toFixed(2)}</Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.label}>Service Fee</Text>
              <Text style={styles.price}>${pricing.serviceFee.toFixed(2)}</Text>
            </View>

            {/* Only show insurance line if coverage is enabled AND we have a quote */}
            {includeCoverage && insuranceQuote?.premium > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.label}>Insurance</Text>
                <Text style={styles.price}>${insuranceQuote.premium.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.priceRow}>
              <Text style={styles.label}>Tax</Text>
              <Text style={styles.price}>${pricing.tax.toFixed(2)}</Text>
            </View>

            <View style={[styles.priceRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalPrice}>${pricing.total}</Text>
            </View>

            {/* Payment Method */}
            <TouchableOpacity
              style={styles.paymentRow}
              onPress={handlePaymentMethodPress}
            >
              <View style={styles.paymentLeft}>
                <Ionicons
                  name={paymentDisplay.icon}
                  size={20}
                  color={defaultPaymentMethod ? "#00D4AA" : "#A77BFF"}
                />
                <View style={styles.paymentInfo}>
                  <Text
                    style={[
                      styles.paymentText,
                      !defaultPaymentMethod && styles.addPaymentText,
                    ]}
                  >
                    {paymentDisplay.text}
                  </Text>
                  <Text style={styles.paymentSubtext}>
                    {paymentDisplay.subtext}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>

        {/* Schedule Button */}
        <TouchableOpacity
          style={[
            styles.scheduleButton,
            (processing || paymentLoading || !!insuranceError || loadingQuote) && styles.disabledButton,
          ]}
          onPress={handleSchedule}
          disabled={processing || paymentLoading || !!insuranceError || loadingQuote}
        >
          {processing || paymentLoading ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="time-outline" size={20} color="#fff" />
              <Text style={styles.scheduleButtonText}>Processing Payment</Text>
            </View>
          ) : (
            <>
              <Ionicons name="calendar-outline" size={20} color="#fff" />
              <Text style={styles.scheduleButtonText}>
                {isDemo ? "Continue Demo" : "Confirm Payment"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>


      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal
        visible={addPaymentModalVisible}
        onClose={() => setAddPaymentModalVisible(false)}
        onSuccess={(paymentMethod) => {
          setAddPaymentModalVisible(false);
          // Trigger schedule again after payment method is added
          setTimeout(handleSchedule, 500);
        }}
      />
    </Modal>
  );
};

export default PriceSummaryModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    backgroundColor: "#0A0A1F",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.95,
    minHeight: height * 0.85,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 15,
  },
  tripSection: {
    backgroundColor: "#141426",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2A2A3B",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  summaryHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  locationText: {
    color: "#eee",
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  dotLine: {
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: 4,
    marginLeft: 6,
  },
  dot: {
    width: 2,
    height: 2,
    backgroundColor: "#666",
    borderRadius: 1,
    marginVertical: 1,
  },
  tripDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2A2A3B",
  },
  tripDetailText: {
    color: "#aaa",
    fontSize: 13,
    marginBottom: 4,
  },
  vehicleSection: {
    backgroundColor: "#141426",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2A2A3B",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  vehicleImage: {
    width: 60,
    height: 30,
    resizeMode: "contain",
    marginRight: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleType: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  vehicleEta: {
    color: "#aaa",
    fontSize: 13,
  },
  coverageSection: {
    backgroundColor: "#141426",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2A2A3B",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  coverageToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coverageDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coverageLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  coverageInfo: {
    marginLeft: 12,
    flex: 1,
  },
  coverageTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  coverageDescription: {
    color: "#aaa",
    fontSize: 13,
    lineHeight: 18,
  },
  coverageRight: {
    alignItems: "flex-end",
  },
  coveragePrice: {
    color: "#A77BFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    backgroundColor: "#333",
    borderRadius: 14,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: "#00D4AA",
  },
  toggleCircle: {
    width: 24,
    height: 24,
    backgroundColor: "#fff",
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  toggleCircleActive: {
    alignSelf: "flex-end",
  },
  summaryBox: {
    backgroundColor: "#141426",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#2A2A3B",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  surgeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6B6B20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  surgeText: {
    color: "#FF6B6B",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  label: {
    color: "#ccc",
    fontSize: 14,
  },
  price: {
    color: "#fff",
    fontSize: 14,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#2A2A3B",
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  totalPrice: {
    color: "#A77BFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#2A2A3B",
  },
  paymentLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  paymentInfo: {
    marginLeft: 10,
    flex: 1,
  },
  paymentText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  addPaymentText: {
    color: "#A77BFF",
  },
  paymentSubtext: {
    color: "#999",
    fontSize: 12,
    marginTop: 2,
  },
  scheduleButton: {
    backgroundColor: "#A77BFF",
    borderRadius: 25,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#A77BFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: "#333",
    shadowOpacity: 0,
    elevation: 0,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2A2A3B',
  },
  scheduleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  toggleSwitchDisabled: {
    opacity: 0.6,
  },
  loadingText: {
    color: '#A77BFF',
    fontSize: 12,
    marginLeft: 6,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2A2A3B',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginLeft: 6,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#2a1b1b',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  errorBannerText: {
    color: '#ff9b9b',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  retryButton: {
    marginLeft: 12,
  },
  retryButtonText: {
    color: '#A77BFF',
    fontSize: 14,
    fontWeight: '600',
  },
});