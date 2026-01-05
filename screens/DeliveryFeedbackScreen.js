import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  SafeAreaView,
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { usePayment } from '../contexts/PaymentContext';
import DeliveryPhotosModal from '../components/DeliveryPhotosModal';

export default function DeliveryFeedbackScreen({ route, navigation }) {
  const { requestId, requestData: initialRequestData, returnToHome } = route.params || {};
  const { getRequestById, updateRequestStatus, getUserProfile, currentUser } = useAuth();
  const { confirmPayment, defaultPaymentMethod } = usePayment();
  
  const [delivered, setDelivered] = useState(true);
  const [tip, setTip] = useState(null);
  const [customTip, setCustomTip] = useState('');
  const [rating, setRating] = useState(5);
  const [requestData, setRequestData] = useState(initialRequestData || null);
  const [loading, setLoading] = useState(!initialRequestData);
  const [driverName, setDriverName] = useState('Your Driver');
  const [vehicleInfo, setVehicleInfo] = useState('Vehicle');
  const [driverRating, setDriverRating] = useState(5.0);
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Payment service URL - matches PriceSummaryModal
  const PAYMENT_SERVICE_URL = 'https://pikup-server.onrender.com';
  
  useEffect(() => {
    const loadData = async () => {
      if (requestId && !initialRequestData) {
        fetchRequestData();
      } else if (initialRequestData) {
        // Use initial request data if provided
        await processRequestData(initialRequestData);
        setLoading(false);
      } else {
        setLoading(false);
      }
    };
    
    loadData();
  }, [requestId, initialRequestData]);
  
  const processRequestData = async (data) => {
    // Extract driver name from email if available
    if (data.assignedDriverEmail) {
      const driverNameFromEmail = data.assignedDriverEmail.split('@')[0];
      setDriverName(driverNameFromEmail);
    } else if (data.driverEmail) {
      const driverNameFromEmail = data.driverEmail.split('@')[0];
      setDriverName(driverNameFromEmail);
    }
    
    // Set vehicle info if available
    if (data.vehicleType) {
      setVehicleInfo(data.vehicleType);
    }

    // Load driver profile for rating
    if (data.assignedDriverId) {
      try {
        const driverProfile = await getUserProfile(data.assignedDriverId);
        setDriverRating(driverProfile?.driverProfile?.rating || 5.0);
      } catch (error) {
        console.error('Error loading driver rating:', error);
        setDriverRating(5.0);
      }
    }
  };
  
  const fetchRequestData = async () => {
    try {
      setLoading(true);
      const data = await getRequestById(requestId);
      setRequestData(data);
      await processRequestData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching request data:', error);
      Alert.alert('Error', 'Failed to load delivery information');
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return; // Prevent double submissions
    
    try {
      setSubmitting(true);
      if (requestId) {
        // Calculate chosen tip amount
        const chosenTip = customTip ? Number(customTip) : (typeof tip === 'number' ? tip : 0);

        // 1) If tipping, create & confirm tip PaymentIntent
        if (chosenTip > 0) {
          const resp = await fetch(`${PAYMENT_SERVICE_URL}/tips/create-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rideId: requestId,
              assignedDriverId: requestData.assignedDriverId,
              tipAmountUsd: chosenTip,
              userId: currentUser?.uid,
              userEmail: currentUser?.email
            }),
          });
          
          const data = await resp.json();
          if (!resp.ok || !data?.clientSecret) {
            throw new Error(data?.error || 'Could not start tip payment');
          }

          // Use existing confirmPayment function
          const paymentResult = await confirmPayment(
            data.clientSecret,
            defaultPaymentMethod?.stripePaymentMethodId
          );
          
          if (!paymentResult.success) {
            Alert.alert('Tip Payment Failed', paymentResult.error || 'Unable to process tip payment');
            return;
          }
        }

        // 2) Update the request with feedback (this preserves all ride details)
        await updateRequestStatus(requestId, 'completed', {
          customerRating: rating,
          customerTip: chosenTip || 0,
          feedbackSubmitted: true,
          updatedAt: new Date().toISOString()
        });
        
        Alert.alert(
          'Thank You!',
          chosenTip > 0 ? 'Your tip was sent and feedback submitted!' : 'Feedback submitted!',
          [
            { 
              text: 'OK', 
              onPress: () => navigation.navigate('CustomerTabs') 
            }
          ]
        );
      } else {
        // Mock flow for testing or demo
        console.log({
          delivered,
          tip: customTip || tip,
          rating
        });
        
        // If returnToHome is true, navigate back to CustomerTabs
        if (returnToHome) {
          navigation.navigate('CustomerTabs');
        } else {
          // Otherwise just go back
          navigation.goBack();
        }
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert('Error', error.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartClaim = () => {
    navigation.navigate('CustomerClaimsScreen');
  };

  const handleViewPhotos = () => {
    setShowPhotosModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Was Your Item Delivered Safely?</Text>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, delivered && styles.activeBtn]}
            onPress={() => setDelivered(true)}
          >
            <Text style={[styles.toggleText, delivered && styles.activeText]}>Yes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !delivered && styles.activeBtn]}
            onPress={() => setDelivered(false)}
          >
            <Text style={[styles.toggleText, !delivered && styles.activeText]}>No</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.driverRow}>
            <View>
              <Text style={styles.driverName}>{driverName}</Text>
              <Text style={styles.vehicle}>{vehicleInfo}</Text>
              <Text style={styles.stars}>★★★★★ {driverRating.toFixed(1)}</Text>
            </View>
            <Image source={require('../assets/van.png')} style={styles.vehicleImg} />
          </View>
          
          {requestData && (
            <TouchableOpacity 
              style={styles.viewPhotosButton}
              onPress={handleViewPhotos}
            >
              <Ionicons name="images-outline" size={18} color="#A77BFF" />
              <Text style={styles.viewPhotosText}>View Delivery Photos</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Add a tip for {driverName}</Text>
          <Text style={styles.subLabel}>
            Your Trip was ${requestData?.pricing?.total?.toFixed(2) || '0.00'}
          </Text>

          <View style={styles.tipRow}>
            {[1, 3, 5].map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.tipBtn, tip === val && styles.tipSelected]}
                onPress={() => {
                  setTip(val);
                  setCustomTip('');
                }}
              >
                <Text style={styles.tipText}>${val}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            placeholder="Enter Custom Amount"
            placeholderTextColor="#888"
            value={customTip}
            onChangeText={(val) => {
              setCustomTip(val);
              setTip(null);
            }}
            keyboardType="numeric"
            style={styles.tipInput}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Rate Your Trip</Text>
          <Text style={styles.subLabel}>
            {requestData ? 
              new Date(requestData.createdAt || new Date()).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              }) : 
              'Your recent delivery'
            }
          </Text>

          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <TouchableOpacity key={i} onPress={() => setRating(i)}>
                <Ionicons
                  name="star"
                  size={32}
                  color={i <= rating ? '#a77bff' : '#444'}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {!delivered && (
          <TouchableOpacity 
            style={styles.startClaimButton}
            onPress={handleStartClaim}
          >
            <Ionicons name="shield-outline" size={20} color="#fff" />
            <Text style={styles.startClaimText}>Start a Claim</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.submitBtn, submitting && styles.disabledBtn]} 
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? 'Processing...' : 'Submit Feedback'}
          </Text>
        </TouchableOpacity>
        
        {delivered && (
          <TouchableOpacity 
            style={styles.claimBtn} 
            onPress={handleStartClaim}
          >
            <Text style={styles.claimText}>Start a Claim</Text>
          </TouchableOpacity>
        )}
      </View>

      {requestData && (
        <DeliveryPhotosModal
          visible={showPhotosModal}
          onClose={() => setShowPhotosModal(false)}
          pickupPhotos={requestData.pickupPhotos || []}
          deliveryPhotos={requestData.dropoffPhotos || []}
          requestDetails={requestData}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0A0A1F' 
  },
  scroll: { 
    padding: 16, 
    paddingBottom: 140 
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  toggleBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: '#1F1F2F',
  },
  toggleText: {
    color: '#ccc',
    fontWeight: '600',
  },
  activeBtn: {
    backgroundColor: '#a77bff',
  },
  activeText: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#141427',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  driverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverName: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 16 
  },
  vehicle: { 
    color: '#ccc', 
    fontSize: 13 
  },
  stars: { 
    color: '#a77bff', 
    marginTop: 4 
  },
  vehicleImg: { 
    width: 80, 
    height: 50, 
    resizeMode: 'contain' 
  },
  viewPhotosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#2A2A3B',
  },
  viewPhotosText: {
    color: '#A77BFF',
    marginLeft: 6,
    fontSize: 14,
  },
  label: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  subLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 12,
  },
  tipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tipBtn: {
    backgroundColor: '#1F1F2F',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  tipSelected: {
    backgroundColor: '#a77bff',
  },
  tipText: {
    color: '#fff',
    fontWeight: '600',
  },
  tipInput: {
    backgroundColor: '#1F1F2F',
    borderRadius: 10,
    padding: 10,
    color: '#fff',
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    gap: 10,
  },
  submitBtn: {
    backgroundColor: '#a77bff',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledBtn: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  claimBtn: {
    backgroundColor: 'transparent',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a77bff',
  },
  claimText: {
    color: '#a77bff',
    fontWeight: '600',
    fontSize: 16,
  },
  startClaimButton: {
    backgroundColor: '#1E1E38',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  startClaimText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
});
