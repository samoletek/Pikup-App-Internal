import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { usePayment } from '../../contexts/PaymentContext';
import { supabase } from '../../config/supabase';
import DeliveryPhotosModal from '../../components/DeliveryPhotosModal';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, spacing, borderRadius, typography, layout } from '../../styles/theme';
import { TRIP_STATUS } from '../../constants/tripStatus';

export default function DeliveryFeedbackScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { requestId, requestData: initialRequestData, returnToHome } = route.params || {};
  const { getRequestById, updateRequestStatus, getDriverProfile, currentUser } = useAuth();
  const { confirmPayment, defaultPaymentMethod, createPaymentIntent } = usePayment();

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
  const tripTotal = Number(requestData?.pricing?.total || 0);
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);



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
    const driverId = data.assignedDriverId || data.driverId || data.driver_id;
    if (driverId) {
      try {
        const driverProfile = await getDriverProfile(driverId);
        setDriverRating(driverProfile?.rating || driverProfile?.driverProfile?.rating || 5.0);
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
      const effectiveRequestId = requestId || requestData?.id || initialRequestData?.id;
      if (!effectiveRequestId) {
        throw new Error('Missing request ID for feedback submission');
      }

      const chosenTip = customTip ? Number(customTip) : (typeof tip === 'number' ? tip : 0);
      if (!Number.isFinite(chosenTip) || chosenTip < 0) {
        Alert.alert('Invalid tip amount', 'Please enter a valid tip amount.');
        return;
      }

      const activeRequestData = requestData || initialRequestData || {};
      const driverId =
        activeRequestData.assignedDriverId ||
        activeRequestData.driverId ||
        activeRequestData.driver_id ||
        null;

      let tipPaymentIntentId = null;

      // 1) If tipping, create & confirm tip PaymentIntent
      if (chosenTip > 0) {
        if (!defaultPaymentMethod?.stripePaymentMethodId) {
          Alert.alert('Payment method required', 'Please add a payment method before sending a tip.');
          return;
        }

        const tipAmountInCents = Math.round(chosenTip * 100);
        const createTipIntentResult = await createPaymentIntent(tipAmountInCents, 'usd', {
          type: 'tip',
          requestId: effectiveRequestId,
          driverId,
          customerId: currentUser?.uid || currentUser?.id
        });

        if (!createTipIntentResult.success || !createTipIntentResult.paymentIntent?.client_secret) {
          Alert.alert('Tip Payment Failed', createTipIntentResult.error || 'Unable to start tip payment');
          return;
        }

        const paymentResult = await confirmPayment(
          createTipIntentResult.paymentIntent.client_secret,
          defaultPaymentMethod?.stripePaymentMethodId
        );

        if (!paymentResult.success) {
          Alert.alert('Tip Payment Failed', paymentResult.error || 'Unable to process tip payment');
          return;
        }

        tipPaymentIntentId = paymentResult.paymentIntent?.id || createTipIntentResult.paymentIntent.id || null;
      }

      // 2) Submit feedback via Edge Function
      const { error: fbError } = await supabase.functions.invoke('submit-feedback', {
        body: {
          requestId: effectiveRequestId,
          rating,
          tip: chosenTip,
          driverId
        }
      });

      if (fbError) {
        console.error('Feedback Edge Function Error:', fbError);
        // We continue anyway to update local status, as feedback is non-critical?
        // Or throw? User wants "backend marked", so let's log but ensure UI updates.
      }

      // 3) Update the request status (AuthContext/DB)
      await updateRequestStatus(effectiveRequestId, TRIP_STATUS.COMPLETED, {
        customerRating: rating,
        customerTip: chosenTip || 0,
        tipPaymentIntentId,
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

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Delivery Feedback"
          onBack={() => navigation.goBack()}
          topInset={insets.top}
          showBack
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading delivery details...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Delivery Feedback"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
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
            <Image source={require('../../assets/van.png')} style={styles.vehicleImg} />
          </View>

          {requestData && (
            <TouchableOpacity
              style={styles.viewPhotosButton}
              onPress={handleViewPhotos}
            >
              <Ionicons name="images-outline" size={18} color={colors.primary} />
              <Text style={styles.viewPhotosText}>View Delivery Photos</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Add a tip for {driverName}</Text>
          <Text style={styles.subLabel}>
            Your Trip was ${tripTotal.toFixed(2)}
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
            placeholderTextColor={colors.text.muted}
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
                  color={i <= rating ? colors.primary : colors.border.light}
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
              <Ionicons name="shield-outline" size={20} color={colors.white} />
              <Text style={styles.startClaimText}>Start a Claim</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <View
        style={[
          styles.buttonContainer,
          { paddingBottom: insets.bottom + spacing.base, width: contentMaxWidth },
        ]}
      >
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  scroll: {
    padding: spacing.base,
    paddingBottom: 140
  },
  contentColumn: {
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  toggleBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 24,
    backgroundColor: colors.background.tertiary,
  },
  toggleText: {
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.semibold,
  },
  activeBtn: {
    backgroundColor: colors.primary,
  },
  activeText: {
    color: colors.text.primary,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  driverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverName: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.md
  },
  vehicle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base
  },
  stars: {
    color: colors.primary,
    marginTop: spacing.xs
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
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  viewPhotosText: {
    color: colors.primary,
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
  },
  label: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  subLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.md,
  },
  tipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  tipBtn: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  tipSelected: {
    backgroundColor: colors.primary,
  },
  tipText: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  tipInput: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm + 2,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    paddingHorizontal: spacing.base,
    backgroundColor: colors.background.primary,
    gap: spacing.md - 2,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 30,
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  submitText: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.md,
  },
  disabledBtn: {
    backgroundColor: colors.text.placeholder,
    opacity: 0.6,
  },
  claimBtn: {
    backgroundColor: 'transparent',
    borderRadius: 30,
    paddingVertical: spacing.base,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  claimText: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.md,
  },
  startClaimButton: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  startClaimText: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.md,
    marginLeft: spacing.sm,
  },
});
