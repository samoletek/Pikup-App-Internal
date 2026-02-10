import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  TextInput,
  Alert,
  Animated,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useStripeIdentity } from '@stripe/stripe-identity-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabase';
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from '../../styles/theme';
import BaseModal from '../../components/BaseModal';
import MapboxLocationService from '../../services/MapboxLocationService';

const steps = [
  {
    title: 'Welcome to PikUp',
    subtitle: 'Start earning by delivering packages on your route',
    icon: 'car-sport',
    color: colors.primary,
  },
  {
    title: 'Identity Verification',
    subtitle: 'We need to verify your identity to ensure safety',
    icon: 'shield-checkmark',
    color: colors.success,
  },
  {
    title: 'Personal Info',
    subtitle: 'Tell us a bit about yourself',
    icon: 'person',
    color: colors.warning,
  },
  {
    title: 'Address',
    subtitle: 'Where do you live?',
    icon: 'location',
    color: colors.secondary,
  },
  {
    title: 'Vehicle Info',
    subtitle: 'What will you be driving?',
    icon: 'car',
    color: colors.info,
  },
  {
    title: 'Payment Setup',
    subtitle: 'How you get paid',
    icon: 'card',
    color: colors.primary,
  },
];

const US_STATES = [
  { label: 'Alabama', value: 'AL' },
  { label: 'Alaska', value: 'AK' },
  { label: 'Arizona', value: 'AZ' },
  { label: 'Arkansas', value: 'AR' },
  { label: 'California', value: 'CA' },
  { label: 'Colorado', value: 'CO' },
  { label: 'Connecticut', value: 'CT' },
  { label: 'Delaware', value: 'DE' },
  { label: 'Florida', value: 'FL' },
  { label: 'Georgia', value: 'GA' },
  { label: 'Hawaii', value: 'HI' },
  { label: 'Idaho', value: 'ID' },
  { label: 'Illinois', value: 'IL' },
  { label: 'Indiana', value: 'IN' },
  { label: 'Iowa', value: 'IA' },
  { label: 'Kansas', value: 'KS' },
  { label: 'Kentucky', value: 'KY' },
  { label: 'Louisiana', value: 'LA' },
  { label: 'Maine', value: 'ME' },
  { label: 'Maryland', value: 'MD' },
  { label: 'Massachusetts', value: 'MA' },
  { label: 'Michigan', value: 'MI' },
  { label: 'Minnesota', value: 'MN' },
  { label: 'Mississippi', value: 'MS' },
  { label: 'Missouri', value: 'MO' },
  { label: 'Montana', value: 'MT' },
  { label: 'Nebraska', value: 'NE' },
  { label: 'Nevada', value: 'NV' },
  { label: 'New Hampshire', value: 'NH' },
  { label: 'New Jersey', value: 'NJ' },
  { label: 'New Mexico', value: 'NM' },
  { label: 'New York', value: 'NY' },
  { label: 'North Carolina', value: 'NC' },
  { label: 'North Dakota', value: 'ND' },
  { label: 'Ohio', value: 'OH' },
  { label: 'Oklahoma', value: 'OK' },
  { label: 'Oregon', value: 'OR' },
  { label: 'Pennsylvania', value: 'PA' },
  { label: 'Rhode Island', value: 'RI' },
  { label: 'South Carolina', value: 'SC' },
  { label: 'South Dakota', value: 'SD' },
  { label: 'Tennessee', value: 'TN' },
  { label: 'Texas', value: 'TX' },
  { label: 'Utah', value: 'UT' },
  { label: 'Vermont', value: 'VT' },
  { label: 'Virginia', value: 'VA' },
  { label: 'Washington', value: 'WA' },
  { label: 'West Virginia', value: 'WV' },
  { label: 'Wisconsin', value: 'WI' },
  { label: 'Wyoming', value: 'WY' },
];

// Helper functions
const formatName = (text) => text.replace(/[^a-zA-Z\s-]/g, '');

const formatPhoneNumber = (value) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

const formatDateOfBirth = (value) => {
  if (!value) return value;
  const dob = value.replace(/[^\d]/g, '');
  const dobLength = dob.length;
  if (dobLength < 3) return dob;
  if (dobLength < 5) {
    return `${dob.slice(0, 2)}/${dob.slice(2)}`;
  }
  return `${dob.slice(0, 2)}/${dob.slice(2, 4)}/${dob.slice(4, 8)}`;
};

const formatZipCode = (value) => value.replace(/[^\d]/g, '').slice(0, 5);

const formatYear = (value) => value.replace(/[^\d]/g, '').slice(0, 4);

const formatLicensePlate = (value) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const ONBOARDING_DRAFT_STORAGE_PREFIX = 'driver_onboarding_draft_v1';
const VALID_VERIFICATION_STATUSES = ['pending', 'completed', 'failed', 'canceled'];

const getDraftStorageKey = (userId) => `${ONBOARDING_DRAFT_STORAGE_PREFIX}:${userId}`;

const initialFormData = {
  firstName: '',
  lastName: '',
  phoneNumber: '',
  dateOfBirth: '',
  ssn: '',
  address: {
    line1: '',
    city: '',
    state: '',
    postalCode: '',
  },
  vehicleInfo: {
    make: '',
    model: '',
    year: '',
    licensePlate: '',
    color: '',
  },
};

const normalizeStep = (value) => {
  const parsedStep = Number(value);
  if (!Number.isFinite(parsedStep)) {
    return 0;
  }
  return Math.max(0, Math.min(steps.length - 1, Math.floor(parsedStep)));
};

const normalizeVerificationStatus = (value) => {
  if (VALID_VERIFICATION_STATUSES.includes(value)) {
    return value;
  }
  return 'pending';
};

const mergeFormDataWithDefaults = (candidate) => {
  if (!candidate || typeof candidate !== 'object') {
    return initialFormData;
  }

  return {
    ...initialFormData,
    ...candidate,
    address: {
      ...initialFormData.address,
      ...(candidate.address || {}),
    },
    vehicleInfo: {
      ...initialFormData.vehicleInfo,
      ...(candidate.vehicleInfo || {}),
    },
  };
};

const getDraftTimestamp = (draft) => {
  const raw = draft?.updatedAt || draft?.savedAt || draft?.updated_at;
  const parsed = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const pickLatestDraft = (localDraft, remoteDraft) => {
  if (!localDraft) return remoteDraft || null;
  if (!remoteDraft) return localDraft;
  return getDraftTimestamp(remoteDraft) > getDraftTimestamp(localDraft)
    ? remoteDraft
    : localDraft;
};

export default function DriverOnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width, height: screenHeight } = useWindowDimensions();
  const { currentUser, updateDriverPaymentProfile } = useAuth();
  const userId = currentUser?.uid || currentUser?.id;
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [verificationSessionId, setVerificationSessionId] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState('pending'); // pending, completed, failed, canceled
  const [formData, setFormData] = useState(initialFormData);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const statePickerRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const lastSavedDraftRef = useRef(null);
  const lastRemoteSyncSignatureRef = useRef(null);

  // MIGRATION: Payment Service replaced by stubs
  // const PAYMENT_SERVICE_URL = 'https://pikup-server.onrender.com';

  // Stripe Identity hook setup
  const fetchVerificationSessionParams = async () => {
    try {
      console.log('Fetching verification session params via Edge Function...');
      if (!currentUser?.uid && !currentUser?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('create-verification-session', {
        body: {
          userId: currentUser.uid || currentUser.id,
          email: currentUser.email,
        }
      });

      if (error) {
        // Try to parse the error body if it exists
        if (error.context && error.context.json) {
          const body = await error.context.json();
          console.error('Edge Function Error Body:', body);
        }
        console.error('Edge Function error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      if (!data?.id || !data?.client_secret) {
        console.error('Invalid data returned:', data);
        throw new Error('Invalid verification session data returned: ' + JSON.stringify(data));
      }

      console.log('Edge Function Response Data:', JSON.stringify(data, null, 2));

      if (!data.ephemeral_key_secret) {
        console.error('MISSING ephemeral_key_secret in response!');
        // Note: We don't block here to see if it works anyway, but log clearly
      }

      const logo = Image.resolveAssetSource(require('../../assets/pikup-logo.png'));

      return {
        sessionId: data.id,
        ephemeralKeySecret: data.ephemeral_key_secret,
        brandLogo: logo,
      };

    } catch (error) {
      console.error('Error fetching verification params:', error);
      Alert.alert('Verification Error', 'Could not initialize verification. Please try again.');
      throw error;
    }
  };

  const { status, present, loading: identityLoading } = useStripeIdentity(fetchVerificationSessionParams);

  // Handle verification status changes from Stripe Identity SDK
  useEffect(() => {
    console.log('🔐 Stripe Identity status changed:', status);

    if (status === 'FlowCompleted') {
      console.log('✅ Verification completed successfully!');
      setVerificationStatus('completed');

      // Optionally persist to database
      if (verificationSessionId && currentUser) {
        supabase
          .from('drivers')
          .update({
            identity_verified: true,
            verification_session_id: verificationSessionId,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentUser.uid || currentUser.id)
          .then(({ error }) => {
            if (error) console.error('Failed to update driver verification status:', error);
            else console.log('✅ Driver verification status saved to DB');
          });
      }
    } else if (status === 'FlowCanceled') {
      console.log('⚠️ Verification was canceled by user');
      setVerificationStatus('canceled');
    } else if (status === 'FlowFailed') {
      console.log('❌ Verification failed');
      setVerificationStatus('failed');
      Alert.alert('Verification Failed', 'Please try again or contact support.');
    }
  }, [status, verificationSessionId, currentUser]);

  const [showStatePicker, setShowStatePicker] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const addressSearchTimeout = useRef(null);

  useEffect(() => {
    MapboxLocationService.getCurrentLocation()
      .then(loc => { if (loc) setUserLocation(loc); })
      .catch(() => {});
  }, []);

  const closeStatePicker = () => {
    if (statePickerRef.current) {
      statePickerRef.current.close();
    } else {
      setShowStatePicker(false);
    }
  };

  const searchAddress = (query) => {
    if (addressSearchTimeout.current) clearTimeout(addressSearchTimeout.current);

    if (!query || query.length < 2) {
      setAddressSuggestions([]);
      return;
    }

    addressSearchTimeout.current = setTimeout(async () => {
      try {
        setIsLoadingAddress(true);
        const accessToken = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN;
        let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
          `access_token=${accessToken}&country=us&types=address,place&limit=5&autocomplete=true&fuzzy_match=true`;

        if (userLocation) {
          url += `&proximity=${userLocation.longitude},${userLocation.latitude}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.features?.length > 0) {
          setAddressSuggestions(data.features);
        } else {
          setAddressSuggestions([]);
        }
      } catch (error) {
        console.error('Address search error:', error);
      } finally {
        setIsLoadingAddress(false);
      }
    }, 200);
  };

  const handleAddressSelect = (feature) => {
    Keyboard.dismiss();
    const context = feature.context || [];

    const line1 = feature.address
      ? `${feature.address} ${feature.text}`
      : feature.place_name?.split(',')[0] || feature.text;

    const city = context.find(c => c.id.startsWith('place'))?.text || '';
    const stateEntry = context.find(c => c.id.startsWith('region'));
    const state = stateEntry?.short_code?.replace('US-', '') || '';
    const zip = context.find(c => c.id.startsWith('postcode'))?.text || '';

    updateFormData('address.line1', line1);
    if (city) updateFormData('address.city', city);
    if (state) updateFormData('address.state', state);
    if (zip) updateFormData('address.postalCode', zip);

    setAddressSuggestions([]);
  };

  const buildDraftSnapshot = () => ({
    currentStep: normalizeStep(currentStep),
    verificationStatus: normalizeVerificationStatus(verificationStatus),
    formData: {
      ...mergeFormDataWithDefaults(formData),
      // Do not persist SSN in local/remote onboarding drafts.
      ssn: '',
    },
  });

  useEffect(() => {
    let isMounted = true;

    const hydrateOnboardingDraft = async () => {
      if (!userId) {
        if (isMounted) {
          setIsDraftHydrated(true);
        }
        return;
      }

      try {
        const draftStorageKey = getDraftStorageKey(userId);
        const [storedDraftRaw, remoteDraftResult] = await Promise.all([
          AsyncStorage.getItem(draftStorageKey),
          supabase
            .from('drivers')
            .select('metadata')
            .eq('id', userId)
            .maybeSingle(),
        ]);

        let localDraft = null;
        if (storedDraftRaw) {
          try {
            localDraft = JSON.parse(storedDraftRaw);
          } catch (parseError) {
            console.error('Failed to parse onboarding draft from storage:', parseError);
          }
        }

        const remoteDraft = remoteDraftResult?.data?.metadata?.onboardingDraft || null;
        const latestDraft = pickLatestDraft(localDraft, remoteDraft);

        if (!latestDraft || !isMounted) {
          return;
        }

        const restoredStep = normalizeStep(latestDraft.currentStep);
        const restoredVerificationStatus = normalizeVerificationStatus(
          latestDraft.verificationStatus
        );
        const restoredFormData = {
          ...mergeFormDataWithDefaults(latestDraft.formData),
          ssn: '',
        };

        setCurrentStep(restoredStep);
        setVerificationStatus(restoredVerificationStatus);
        setFormData(restoredFormData);
        progressAnim.setValue(restoredStep / (steps.length - 1));

        lastSavedDraftRef.current = JSON.stringify({
          currentStep: restoredStep,
          verificationStatus: restoredVerificationStatus,
          formData: restoredFormData,
        });
        lastRemoteSyncSignatureRef.current = `${restoredStep}:${restoredVerificationStatus}`;
      } catch (error) {
        console.error('Failed to hydrate onboarding draft:', error);
      } finally {
        if (isMounted) {
          setIsDraftHydrated(true);
        }
      }
    };

    hydrateOnboardingDraft();

    return () => {
      isMounted = false;
    };
  }, [userId, progressAnim]);

  useEffect(() => {
    if (!isDraftHydrated || !userId) {
      return undefined;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const draftSnapshot = buildDraftSnapshot();
      const draftSnapshotString = JSON.stringify(draftSnapshot);

      if (draftSnapshotString === lastSavedDraftRef.current) {
        return;
      }

      lastSavedDraftRef.current = draftSnapshotString;

      const draftPayload = {
        ...draftSnapshot,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      const draftStorageKey = getDraftStorageKey(userId);

      try {
        await AsyncStorage.setItem(draftStorageKey, JSON.stringify(draftPayload));
      } catch (error) {
        console.error('Failed to persist onboarding draft locally:', error);
      }

      const remoteSyncSignature = `${draftSnapshot.currentStep}:${draftSnapshot.verificationStatus}`;
      if (remoteSyncSignature === lastRemoteSyncSignatureRef.current) {
        return;
      }

      try {
        await updateDriverPaymentProfile?.(userId, {
          onboardingStep: draftSnapshot.currentStep,
          onboardingDraft: draftPayload,
          onboardingLastSavedAt: draftPayload.updatedAt,
        });
        lastRemoteSyncSignatureRef.current = remoteSyncSignature;
      } catch (error) {
        console.error('Failed to sync onboarding draft with Supabase:', error);
      }
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    currentStep,
    verificationStatus,
    formData,
    isDraftHydrated,
    userId,
    updateDriverPaymentProfile,
  ]);

  const updateFormData = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const validateStep = () => {
    switch (currentStep) {
      case 2: // Personal Info
        return (
          formData.firstName.length >= 2 &&
          formData.lastName.length >= 2 &&
          formData.phoneNumber.length >= 14 &&
          formData.dateOfBirth.length === 10
        );
      case 3: // Address
        return (
          formData.address.line1.length > 5 &&
          formData.address.city.length > 2 &&
          formData.address.state &&
          formData.address.postalCode.length === 5
        );
      case 4: // Vehicle Info
        return (
          formData.vehicleInfo.make.length > 2 &&
          formData.vehicleInfo.model.length > 2 &&
          formData.vehicleInfo.year.length === 4 &&
          formData.vehicleInfo.licensePlate.length >= 2
        );
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (!validateStep()) {
      Alert.alert('Missing Information', 'Please fill in all required fields correctly.');
      return;
    }

    if (currentStep === steps.length - 1) {
      await handleCreateConnectAccount();
    } else {
      // Animate progress
      Animated.timing(progressAnim, {
        toValue: (currentStep + 1) / (steps.length - 1),
        duration: 300,
        useNativeDriver: false,
      }).start();

      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      // Animate progress
      Animated.timing(progressAnim, {
        toValue: (currentStep - 1) / (steps.length - 1),
        duration: 300,
        useNativeDriver: false,
      }).start();

      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleCreateConnectAccount = async () => {
    setLoading(true);
    try {
      console.warn('MIGRATION: Driver Onboarding disabled. Needs Supabase & Stripe Connect implementation.');

      Alert.alert(
        'Onboarding Update',
        'Driver onboarding is currently being upgraded. Please check back later.',
        [{ text: 'OK' }]
      );

      // Stop execution here
      return;

      /* LEGACY CODE REMOVED
      // Real API Calls... 
      */
    } catch (error) {
      console.error('Error in onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.welcomeContent}>
            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <Ionicons name="cash-outline" size={20} color={colors.success} />
                <Text style={styles.benefitText}>Earn up to $25/hour</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="time-outline" size={20} color={colors.success} />
                <Text style={styles.benefitText}>Flexible schedule</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="card-outline" size={20} color={colors.success} />
                <Text style={styles.benefitText}>Weekly payouts</Text>
              </View>
            </View>
          </View>
        );

      case 1: // Identity Verification
        return (
          <View style={styles.formContent}>
            <View style={styles.verificationFeatures}>
              <View style={styles.verificationItem}>
                <View style={styles.verificationIcon}>
                  <Ionicons name="camera-outline" size={24} color={colors.success} />
                </View>
                <View style={styles.verificationContent}>
                  <Text style={styles.verificationTitle}>Photo ID</Text>
                  <Text style={styles.verificationText}>
                    Take a photo of your government-issued ID
                  </Text>
                </View>
              </View>

              <View style={styles.verificationItem}>
                <View style={styles.verificationIcon}>
                  <Ionicons name="person-circle-outline" size={24} color={colors.success} />
                </View>
                <View style={styles.verificationContent}>
                  <Text style={styles.verificationTitle}>Selfie Verification</Text>
                  <Text style={styles.verificationText}>
                    Take a selfie to match with your ID
                  </Text>
                </View>
              </View>

              <View style={styles.verificationItem}>
                <View style={styles.verificationIcon}>
                  <Ionicons name="lock-closed-outline" size={24} color={colors.success} />
                </View>
                <View style={styles.verificationContent}>
                  <Text style={styles.verificationTitle}>Secure & Private</Text>
                  <Text style={styles.verificationText}>
                    Your data is encrypted and secure
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.verifyButton,
                identityLoading && styles.verifyButtonDisabled,
                verificationStatus === 'completed' && styles.verifyButtonSuccess
              ]}
              onPress={() => present()}
              disabled={verificationStatus === 'completed' || identityLoading}
            >
              {identityLoading ? (
                <View style={styles.buttonLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={[styles.verifyButtonText, { marginLeft: 8 }]}>Preparing verification...</Text>
                </View>
              ) : verificationStatus === 'completed' ? (
                <View style={styles.buttonLoadingContainer}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                  <Text style={[styles.verifyButtonText, { marginLeft: 8 }]}>Identity verified successfully!</Text>
                </View>
              ) : (
                <Text style={styles.verifyButtonText}>Start Verification</Text>
              )}
            </TouchableOpacity>

            {/* DEV BYPASS REMOVED */}
          </View>
        );

      case 2: // Personal Info
        return (
          <View style={styles.formContent}>
            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>First Name *</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    formData.firstName.length > 0 && formData.firstName.length < 2 && styles.textInputError
                  ]}
                  value={formData.firstName}
                  onChangeText={(value) => updateFormData('firstName', formatName(value))}
                  placeholder="John"
                  placeholderTextColor={colors.text.placeholder}
                  autoCapitalize="words"
                  maxLength={30}
                />
                {formData.firstName.length > 0 && formData.firstName.length < 2 && (
                  <Text style={styles.inputHint}>Min 2 characters</Text>
                )}
              </View>
              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Last Name *</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    formData.lastName.length > 0 && formData.lastName.length < 2 && styles.textInputError
                  ]}
                  value={formData.lastName}
                  onChangeText={(value) => updateFormData('lastName', formatName(value))}
                  placeholder="Doe"
                  placeholderTextColor={colors.text.placeholder}
                  autoCapitalize="words"
                  maxLength={30}
                />
                {formData.lastName.length > 0 && formData.lastName.length < 2 && (
                  <Text style={styles.inputHint}>Min 2 characters</Text>
                )}
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Phone Number *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.phoneNumber}
                onChangeText={(value) => updateFormData('phoneNumber', formatPhoneNumber(value))}
                placeholder="(555) 123-4567"
                placeholderTextColor={colors.text.placeholder}
                keyboardType="phone-pad"
                maxLength={14}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Date of Birth *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.dateOfBirth}
                onChangeText={(value) => updateFormData('dateOfBirth', formatDateOfBirth(value))}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={colors.text.placeholder}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>
        );

      case 3: // Address
        return (
          <View style={styles.formContent}>
            <View style={[styles.inputContainer, { zIndex: 10 }]}>
              <Text style={styles.inputLabel}>Street Address *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.address.line1}
                onChangeText={(value) => {
                  updateFormData('address.line1', value);
                  searchAddress(value);
                }}
                placeholder="Start typing an address..."
                placeholderTextColor={colors.text.placeholder}
                autoCapitalize="words"
              />
              {isLoadingAddress && (
                <View style={styles.addressLoadingIndicator}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
              {addressSuggestions.length > 0 && (
                <ScrollView
                  style={styles.suggestionsContainer}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {addressSuggestions.map((feature) => (
                    <TouchableOpacity
                      key={feature.id}
                      style={styles.suggestionItem}
                      onPress={() => handleAddressSelect(feature)}
                    >
                      <Ionicons name="location-outline" size={18} color={colors.text.subtle} style={{ marginRight: 10 }} />
                      <Text style={styles.suggestionText} numberOfLines={2}>
                        {feature.place_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, { flex: 2, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>City *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.address.city}
                  onChangeText={(value) => updateFormData('address.city', value)}
                  placeholder="Atlanta"
                  placeholderTextColor={colors.text.placeholder}
                  autoCapitalize="words"
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>State *</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowStatePicker(true)}
                >
                  <Text style={formData.address.state ? styles.pickerButtonText : styles.pickerButtonPlaceholder}>
                    {formData.address.state || 'Select'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.text.subtle} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>ZIP Code *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.address.postalCode}
                onChangeText={(value) => updateFormData('address.postalCode', formatZipCode(value))}
                placeholder="30309"
                placeholderTextColor={colors.text.placeholder}
                keyboardType="numeric"
                maxLength={5}
              />
              {formData.address.postalCode.length > 0 && formData.address.postalCode.length < 5 && (
                <Text style={styles.inputHint}>ZIP must be 5 digits</Text>
              )}
            </View>

            {/* State Picker Modal */}
            <BaseModal
              ref={statePickerRef}
              visible={showStatePicker}
              onClose={() => setShowStatePicker(false)}
              height={screenHeight * 0.5}
              backgroundColor={colors.background.tertiary}
            >
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select State</Text>
              </View>
              <ScrollView style={styles.pickerList} contentContainerStyle={{ paddingBottom: 40 }}>
                {formData.address.state ? (
                  <TouchableOpacity
                    style={styles.pickerItem}
                    onPress={() => {
                      updateFormData('address.state', '');
                      closeStatePicker();
                    }}
                  >
                    <Text style={[styles.pickerItemText, { color: colors.text.subtle }]}>Clear selection</Text>
                    <Ionicons name="close-circle-outline" size={20} color={colors.text.subtle} />
                  </TouchableOpacity>
                ) : null}
                {US_STATES.map((state) => (
                  <TouchableOpacity
                    key={state.value}
                    style={[
                      styles.pickerItem,
                      formData.address.state === state.value && styles.pickerItemSelected
                    ]}
                    onPress={() => {
                      updateFormData('address.state', state.value);
                      closeStatePicker();
                    }}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      formData.address.state === state.value && styles.pickerItemTextSelected
                    ]}>
                      {state.label}
                    </Text>
                    {formData.address.state === state.value && (
                      <Ionicons name="checkmark" size={20} color={colors.success} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </BaseModal>
          </View>
        );

      case 4: // Vehicle Info
        return (
          <View style={styles.formContent}>
            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Make *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.vehicleInfo.make}
                  onChangeText={(value) => updateFormData('vehicleInfo.make', value)}
                  placeholder="Toyota"
                  placeholderTextColor={colors.text.placeholder}
                  autoCapitalize="words"
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Model *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.vehicleInfo.model}
                  onChangeText={(value) => updateFormData('vehicleInfo.model', value)}
                  placeholder="Camry"
                  placeholderTextColor={colors.text.placeholder}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Year *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.vehicleInfo.year}
                  onChangeText={(value) => updateFormData('vehicleInfo.year', formatYear(value))}
                  placeholder="2020"
                  placeholderTextColor={colors.text.placeholder}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Color</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.vehicleInfo.color}
                  onChangeText={(value) => updateFormData('vehicleInfo.color', value)}
                  placeholder="White"
                  placeholderTextColor={colors.text.placeholder}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>License Plate *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.vehicleInfo.licensePlate}
                onChangeText={(value) => updateFormData('vehicleInfo.licensePlate', formatLicensePlate(value))}
                placeholder="ABC123"
                placeholderTextColor={colors.text.placeholder}
                autoCapitalize="characters"
                maxLength={8}
              />
              {formData.vehicleInfo.licensePlate.length > 0 && formData.vehicleInfo.licensePlate.length < 2 && (
                <Text style={styles.inputHint}>Min 2 characters</Text>
              )}
            </View>
          </View>
        );

      case 5: // Payment Setup
        return (
          <View style={styles.finalContent}>
            <View style={styles.securityFeatures}>
              <View style={styles.securityItem}>
                <Ionicons name="shield-checkmark" size={20} color={colors.success} />
                <Text style={styles.securityText}>Bank-level security</Text>
              </View>
              <View style={styles.securityItem}>
                <Ionicons name="flash" size={20} color={colors.success} />
                <Text style={styles.securityText}>Fast payments</Text>
              </View>
              <View style={styles.securityItem}>
                <Ionicons name="lock-closed" size={20} color={colors.success} />
                <Text style={styles.securityText}>Encrypted data</Text>
              </View>
            </View>

            <View style={styles.finalNote}>
              <Text style={styles.finalNoteText}>
                You'll be redirected to complete a quick verification process. This usually takes 2-3 minutes.
              </Text>
            </View>

            {/* DEV BYPASS REMOVED */}

          </View >
        );

      default:
        return null;
    }
  };

  const renderProgressBar = () => {
    const progressWidth = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBackground}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <Text style={styles.progressText}>
          {currentStep + 1} of {steps.length}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topChrome}>
        <View style={[styles.topChromeInner, { maxWidth: contentMaxWidth }]}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (currentStep > 0) {
                  prevStep();
                } else {
                  navigation.goBack();
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{steps[currentStep].title}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="close" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          {renderProgressBar()}
        </View>
      </View>

      {/* Content */}
      <View style={styles.contentArea}>
        <View style={[styles.stepContainer, { maxWidth: contentMaxWidth }]}>
          <View style={[styles.stepIcon, { backgroundColor: `${steps[currentStep].color}20` }]}>
            <Ionicons
              name={steps[currentStep].icon}
              size={32}
              color={steps[currentStep].color}
            />
          </View>

          <Text style={styles.stepTitle}>{steps[currentStep].title}</Text>
          <Text style={styles.stepSubtitle}>{steps[currentStep].subtitle}</Text>

          {renderStepContent()}
        </View>
      </View>

      {/* Bottom Actions */}
      <View
        style={[
          styles.bottomActions,
          {
            paddingBottom: Math.max(insets.bottom, spacing.md),
            maxWidth: contentMaxWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        {currentStep > 0 && (
          <TouchableOpacity style={styles.backActionButton} onPress={prevStep}>
            <Text style={styles.backActionText}>Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextButton,
            currentStep === 0 && styles.nextButtonFull,
            loading && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.nextButtonText}>Setting up...</Text>
            </View>
          ) : (
            <Text style={styles.nextButtonText}>
              {currentStep === steps.length - 1 ? 'Complete Setup' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  topChrome: {
    backgroundColor: colors.background.primary,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 5,
  },
  topChromeInner: {
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  progressBackground: {
    height: 4,
    backgroundColor: colors.border.strong,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  contentArea: {
    flex: 1,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
  },
  stepContainer: {
    flex: 1,
    width: '100%',
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  stepIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.tertiary,
    marginBottom: spacing.xl + spacing.sm,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Welcome content
  welcomeContent: {
    width: '100%',
    alignItems: 'center',
  },
  welcomeIconContainer: {
    width: 120,
    height: 120,
    backgroundColor: colors.background.elevated,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 16,
    textAlign: 'center',
  },
  welcomeDescription: {
    fontSize: 16,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  benefitsList: {
    width: '100%',
    paddingHorizontal: spacing.base,
    marginTop: spacing.lg,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  benefitText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },

  // Form content
  formContent: {
    width: '100%',
    paddingTop: spacing.lg,
  },
  formDescription: {
    fontSize: 16,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  inputLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },

  // Final content
  finalContent: {
    width: '100%',
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  finalIconContainer: {
    width: 100,
    height: 100,
    backgroundColor: colors.background.elevated,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  finalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 16,
    textAlign: 'center',
  },
  finalDescription: {
    fontSize: 16,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  securityFeatures: {
    width: '100%',
    marginBottom: 32,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  securityText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.md,
  },
  finalNote: {
    backgroundColor: colors.background.elevated,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.strong,
    width: '100%',
  },
  finalNoteText: {
    color: colors.text.tertiary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Verification styles
  verificationFeatures: {
    marginTop: 24,
    marginBottom: 32,
  },
  verificationItem: {
    flexDirection: 'row',
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  verificationIcon: {
    width: 48,
    height: 48,
    backgroundColor: colors.successLight,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  verificationContent: {
    flex: 1,
  },
  verificationTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  verificationText: {
    fontSize: 14,
    color: colors.text.tertiary,
    lineHeight: 20,
  },
  verifyButton: {
    backgroundColor: colors.success,
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
  },
  verifyButtonDisabled: {
    backgroundColor: colors.text.subtle,
    opacity: 0.7,
  },
  verifyButtonSuccess: {
    backgroundColor: colors.success,
    opacity: 1,
  },
  verifyButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  verificationSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  verificationSuccessText: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingText: {
    color: colors.text.tertiary,
    fontSize: 14,
    marginTop: 8,
  },

  // Bottom actions
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background.primary,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 10,
    gap: 12,
  },
  backActionButton: {
    flex: 1,
    backgroundColor: colors.border.strong,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  backActionText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  nextButton: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonDisabled: {
    backgroundColor: colors.text.subtle,
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Button loading container
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Input validation styles
  textInputError: {
    borderColor: colors.secondary,
    borderWidth: 1,
  },
  inputHint: {
    color: colors.secondary,
    fontSize: typography.fontSize.sm - 1,
    marginTop: spacing.xs,
  },

  // State Picker styles
  pickerButton: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
  },
  pickerButtonPlaceholder: {
    color: colors.text.subtle,
    fontSize: typography.fontSize.md,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.strong,
  },
  pickerTitle: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  pickerList: {
    paddingHorizontal: spacing.base,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.strong,
  },
  pickerItemSelected: {
    backgroundColor: colors.primaryLight,
    marginHorizontal: -spacing.base,
    paddingHorizontal: spacing.base,
  },
  pickerItemText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
  },
  pickerItemTextSelected: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    marginTop: 4,
    maxHeight: 200,
    zIndex: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  suggestionText: {
    flex: 1,
    color: colors.white,
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },
  addressLoadingIndicator: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
