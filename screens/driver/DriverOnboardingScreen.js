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
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useStripeIdentity } from '@stripe/stripe-identity-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabase';
import {
  animation,
  borderRadius,
  colors,
  layout,
  shadows,
  spacing,
  typography,
  zIndex,
} from '../../styles/theme';
import * as ImagePicker from 'expo-image-picker';
import BaseModal from '../../components/BaseModal';
import MapboxLocationService from '../../services/MapboxLocationService';
import {
  uploadVehiclePhotos,
  verifyVehicle,
  saveVehicleData,
} from '../../services/VehicleVerificationService';

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
    subtitle: 'Verify your vehicle with photos',
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
    vin: '',
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
  const [isLoadingVerificationData, setIsLoadingVerificationData] = useState(false);
  const [verificationDataPopulated, setVerificationDataPopulated] = useState(false);

  // Vehicle verification state
  const [vinPhotoUri, setVinPhotoUri] = useState(null);
  const [carPhotoUris, setCarPhotoUris] = useState([null, null, null]); // [front, side, rear]
  const [vehicleVerificationStatus, setVehicleVerificationStatus] = useState('idle');
  const [vehicleVerificationResult, setVehicleVerificationResult] = useState(null);
  const [vehicleVerificationError, setVehicleVerificationError] = useState(null);

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
      setVerificationSessionId(data.id);

      if (!data.ephemeral_key_secret) {
        console.error('MISSING ephemeral_key_secret in response!');
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

  const fetchVerificationData = async (sessionId, retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 3000;

    try {
      setIsLoadingVerificationData(true);

      const { data, error } = await supabase.functions.invoke('get-verification-data', {
        body: { sessionId },
      });

      if (error) {
        console.error('Error fetching verification data:', error);
        setIsLoadingVerificationData(false);
        return;
      }

      if (data?.status === 'processing' && retryCount < MAX_RETRIES) {
        console.log(`Verification processing, retrying in ${RETRY_DELAY / 1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => fetchVerificationData(sessionId, retryCount + 1), RETRY_DELAY);
        return;
      }

      if (!data || data.status === 'processing' || data.error) {
        console.log('Verification data not available');
        setIsLoadingVerificationData(false);
        return;
      }

      setFormData(prev => {
        const updated = { ...prev };

        if (data.firstName && !prev.firstName) updated.firstName = data.firstName;
        if (data.lastName && !prev.lastName) updated.lastName = data.lastName;
        if (data.dob && !prev.dateOfBirth) {
          const month = String(data.dob.month).padStart(2, '0');
          const day = String(data.dob.day).padStart(2, '0');
          const year = String(data.dob.year);
          updated.dateOfBirth = `${month}/${day}/${year}`;
        }

        if (data.address) {
          updated.address = {
            ...prev.address,
            line1: data.address.line1 || prev.address.line1,
            city: data.address.city || prev.address.city,
            state: data.address.state || prev.address.state,
            postalCode: data.address.postalCode || prev.address.postalCode,
          };
        }

        return updated;
      });

      setVerificationDataPopulated(true);
      setIsLoadingVerificationData(false);

    } catch (error) {
      console.error('Failed to fetch verification data:', error);
      setIsLoadingVerificationData(false);
    }
  };

  const { status, present, loading: identityLoading } = useStripeIdentity(fetchVerificationSessionParams);

  // Handle verification status changes from Stripe Identity SDK
  useEffect(() => {
    console.log('Stripe Identity status changed:', status);

    if (status === 'FlowCompleted') {
      console.log('Verification completed successfully!');
      setVerificationStatus('completed');

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
            else console.log('Driver verification status saved to DB');
          });

        // Fetch verified data from Stripe and auto-populate form
        fetchVerificationData(verificationSessionId);
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
    verificationDataPopulated,
    vehicleVerificationStatus,
    vinPhotoUri,
    carPhotoUris,
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
        if (latestDraft.verificationDataPopulated) {
          setVerificationDataPopulated(true);
        }
        if (latestDraft.vehicleVerificationStatus && latestDraft.vehicleVerificationStatus !== 'idle') {
          // Don't restore transient states — reset to idle so user isn't stuck on a spinner
          const transientStatuses = ['uploading', 'verifying'];
          const restoredVehicleStatus = transientStatuses.includes(latestDraft.vehicleVerificationStatus)
            ? 'idle'
            : latestDraft.vehicleVerificationStatus;
          setVehicleVerificationStatus(restoredVehicleStatus);
        }
        if (latestDraft.vinPhotoUri) setVinPhotoUri(latestDraft.vinPhotoUri);
        if (latestDraft.carPhotoUris) setCarPhotoUris(latestDraft.carPhotoUris);
        else if (latestDraft.carPhotoUri) setCarPhotoUris([latestDraft.carPhotoUri, null, null]);
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
    vehicleVerificationStatus,
    vinPhotoUri,
    carPhotoUris,
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
      case 4: // Vehicle Info — photos + verification required
        return (
          !!vinPhotoUri &&
          carPhotoUris.some(Boolean) &&
          vehicleVerificationStatus === 'approved' &&
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

    // Save user-editable vehicle fields when leaving Step 4
    // NOTE: vehicle_verified is set ONLY server-side by the verify-vehicle Edge Function
    if (currentStep === 4) {
      try {
        const driverId = currentUser?.uid || currentUser?.id;
        await saveVehicleData(driverId, {
          color: formData.vehicleInfo.color,
          licensePlate: formData.vehicleInfo.licensePlate,
        });
      } catch (error) {
        console.error('Error saving vehicle data:', error);
      }
    }

    if (currentStep === steps.length - 1) {
      await handleCreateConnectAccount();
    } else {
      Animated.timing(progressAnim, {
        toValue: (currentStep + 1) / (steps.length - 1),
        duration: animation.normal,
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
        duration: animation.normal,
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

  // ============================================
  // VEHICLE PHOTO VERIFICATION
  // ============================================
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission',
        'We need camera permission to take photos of your vehicle.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return true;
  };

  const pickPhoto = async (setter) => {
    const launchCamera = async () => {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) return;
      try {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images',
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
          exif: false,
        });
        if (!result.canceled && result.assets[0]) {
          setter(result.assets[0].uri);
          setVehicleVerificationStatus('idle');
          setVehicleVerificationResult(null);
          setVehicleVerificationError(null);
        }
      } catch (error) {
        console.error('Camera error:', error);
        Alert.alert('Camera Unavailable', 'Could not open camera. Try choosing from gallery instead.');
      }
    };

    const launchGallery = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please grant photo library access.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
          exif: false,
        });
        if (!result.canceled && result.assets[0]) {
          setter(result.assets[0].uri);
          setVehicleVerificationStatus('idle');
          setVehicleVerificationResult(null);
          setVehicleVerificationError(null);
        }
      } catch (error) {
        console.error('Gallery error:', error);
        Alert.alert('Error', 'Failed to pick photo. Please try again.');
      }
    };

    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: launchCamera },
      { text: 'Photo Library', onPress: launchGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const CAR_PHOTO_LABELS = ['Front', 'Side', 'Rear'];
  const CAR_PHOTO_ICONS = [
    { name: 'car', size: 32 },
    { name: 'car-side', size: 40 },
    { name: 'car-back', size: 32 },
  ];

  const takeVinPhoto = () => pickPhoto(setVinPhotoUri);
  const takeCarPhoto = (index) => pickPhoto((uri) => {
    setCarPhotoUris(prev => {
      const updated = [...prev];
      updated[index] = uri;
      return updated;
    });
  });
  const showVinHintAlert = () => {
    Alert.alert(
      'Where to find the VIN plate',
      [
        'Driver-side door jamb: open the door and look for a sticker on the frame.',
        "Dashboard: check the base of the windshield on the driver's side.",
        'Engine bay or vehicle registration documents.',
        '',
        'Tips for a good photo:',
        'Use enough light and avoid shadows on the VIN.',
        'Hold the camera close so all 17 characters are readable.',
        'Keep the camera steady to avoid blur.',
      ].join('\n'),
      [{ text: 'OK' }]
    );
  };

  const showVehiclePhotoHintAlert = () => {
    Alert.alert(
      'How to take photos of your vehicle',
      [
        'Front: stand about 10 feet in front and capture bumper, headlights, and license plate.',
        'Side: stand at a slight angle and capture the whole car from hood to trunk.',
        'Rear: stand about 10 feet behind and capture bumper, taillights, and license plate.',
        '',
        'For best results, take photos outdoors in daylight.',
      ].join('\n'),
      [{ text: 'OK' }]
    );
  };

  const handleVerifyVehicle = async () => {
    const validCarPhotos = carPhotoUris.filter(Boolean);
    if (!vinPhotoUri || validCarPhotos.length === 0) {
      Alert.alert('Photos Required', 'Please take a VIN plate photo and at least one vehicle photo.');
      return;
    }

    try {
      setVehicleVerificationStatus('uploading');
      setVehicleVerificationError(null);

      const driverId = currentUser?.uid || currentUser?.id;
      const { vinPhotoUrl, carPhotoUrls } = await uploadVehiclePhotos(driverId, vinPhotoUri, carPhotoUris);

      setVehicleVerificationStatus('verifying');

      // Refresh session to ensure JWT is valid before calling Edge Function
      await supabase.auth.refreshSession();

      const result = await verifyVehicle(vinPhotoUrl, carPhotoUrls);

      setVehicleVerificationResult(result);

      if (result.status === 'approved') {
        setVehicleVerificationStatus('approved');

        if (result.vinData) {
          setFormData(prev => ({
            ...prev,
            vehicleInfo: {
              ...prev.vehicleInfo,
              make: result.vinData.make || prev.vehicleInfo.make,
              model: result.vinData.model || prev.vehicleInfo.model,
              year: result.vinData.year || prev.vehicleInfo.year,
              vin: result.extractedVin || prev.vehicleInfo.vin,
              color: result.detectedColor || prev.vehicleInfo.color,
              licensePlate: result.detectedLicensePlate || prev.vehicleInfo.licensePlate,
            },
          }));
        }
      } else {
        setVehicleVerificationStatus('rejected');
        setFormData(prev => ({
          ...prev,
          vehicleInfo: {
            ...prev.vehicleInfo,
            make: '',
            model: '',
            year: '',
            vin: '',
            color: '',
            licensePlate: '',
          },
        }));
      }
    } catch (error) {
      console.error('Vehicle verification error:', error);
      setVehicleVerificationStatus('error');
      setVehicleVerificationError(error.message || 'Verification failed. Please try again.');
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
                  <Text style={[styles.verifyButtonText, { marginLeft: spacing.sm }]}>Preparing verification...</Text>
                </View>
              ) : verificationStatus === 'completed' ? (
                <View style={styles.buttonLoadingContainer}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                  <Text style={[styles.verifyButtonText, { marginLeft: spacing.sm }]}>Identity verified successfully!</Text>
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
            {isLoadingVerificationData && (
              <View style={styles.autoFilledBanner}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.autoFilledText}>Loading verified information...</Text>
              </View>
            )}
            {verificationDataPopulated && !isLoadingVerificationData && (
              <View style={styles.autoFilledBanner}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.autoFilledText}>Pre-filled from your ID verification. Review and edit if needed.</Text>
              </View>
            )}
            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: spacing.sm }]}>
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
              <View style={[styles.inputContainer, { flex: 1, marginLeft: spacing.sm }]}>
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
            {verificationDataPopulated && !isLoadingVerificationData && formData.address.line1 && (
              <View style={styles.autoFilledBanner}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.autoFilledText}>Address pre-filled from your ID. Review and edit if needed.</Text>
              </View>
            )}
            <View style={[styles.inputContainer, { zIndex: 10 }]}>
              <Text style={styles.inputLabel}>Street Address *</Text>
              <View style={styles.addressInputWrapper}>
                <TextInput
                  style={[styles.textInput, isLoadingAddress && styles.textInputWithLoader]}
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
              </View>
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
                      <Ionicons name="location-outline" size={18} color={colors.text.subtle} style={{ marginRight: spacing.sm }} />
                      <Text style={styles.suggestionText} numberOfLines={2}>
                        {feature.place_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, { flex: 2, marginRight: spacing.sm }]}>
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
              <View style={[styles.inputContainer, { flex: 1, marginLeft: spacing.sm }]}>
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
              <ScrollView style={styles.pickerList} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
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
        {
          const hasAnyCarPhoto = carPhotoUris.some(Boolean);
          const isProcessing = vehicleVerificationStatus === 'uploading' || vehicleVerificationStatus === 'verifying';
          const hasResult = ['approved', 'rejected', 'error'].includes(vehicleVerificationStatus);
          const showFields = hasResult;
          const isLocked = vehicleVerificationStatus === 'approved';
          const canVerify = vehicleVerificationStatus === 'idle' && vinPhotoUri && hasAnyCarPhoto;

          return (
            <View style={styles.formContent}>
              {/* Photo Capture: VIN Plate */}
              <View style={styles.photoSection}>
                <View style={styles.sectionLabelRow}>
                  <Text style={styles.sectionLabel}>Step 1: Take a photo of your VIN plate</Text>
                  <TouchableOpacity
                    style={styles.infoButton}
                    onPress={showVinHintAlert}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={20}
                      color={colors.text.subtle}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.sectionHint}>
                  Find the VIN plate on your driver-side door jamb or dashboard
                </Text>
                <View style={styles.photoSlotWrapper}>
                  <TouchableOpacity
                    style={[styles.photoCaptureSlot, vinPhotoUri && styles.photoCaptureSlotFilled]}
                    onPress={takeVinPhoto}
                    disabled={isProcessing}
                  >
                    {vinPhotoUri ? (
                      <Image source={{ uri: vinPhotoUri }} style={styles.photoCapturePreview} />
                    ) : (
                      <View style={styles.photoCaptureEmpty}>
                        <MaterialCommunityIcons name="card-text-outline" size={36} color={colors.text.subtle} />
                        <Text style={styles.photoCaptureText}>Tap to take a VIN plate photo</Text>
                      </View>
                    )}
                    {vinPhotoUri && (
                      <View style={styles.photoRetakeOverlay}>
                        <Ionicons name="camera-reverse-outline" size={16} color={colors.white} />
                        <Text style={styles.photoRetakeText}>Retake</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {vinPhotoUri && !isProcessing && (
                    <TouchableOpacity
                      style={styles.photoDeleteButton}
                      onPress={() => {
                        setVinPhotoUri(null);
                        setVehicleVerificationStatus('idle');
                        setVehicleVerificationResult(null);
                      }}
                    >
                      <Ionicons name="close-circle" size={24} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Photo Capture: Vehicle — multiple angles */}
              <View style={styles.photoSection}>
                <View style={styles.sectionLabelRow}>
                  <Text style={styles.sectionLabel}>Step 2: Take photos of your vehicle</Text>
                  <TouchableOpacity
                    style={styles.infoButton}
                    onPress={showVehiclePhotoHintAlert}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={20}
                      color={colors.text.subtle}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.sectionHint}>
                  Take photos from different angles for better verification (at least 1 required)
                </Text>
                <View style={styles.carPhotosRow}>
                  {CAR_PHOTO_LABELS.map((label, index) => (
                    <View key={label} style={styles.carPhotoSlotContainer}>
                      <TouchableOpacity
                        style={[styles.carPhotoSlot, carPhotoUris[index] && styles.photoCaptureSlotFilled]}
                        onPress={() => takeCarPhoto(index)}
                        disabled={isProcessing}
                      >
                        {carPhotoUris[index] ? (
                          <Image source={{ uri: carPhotoUris[index] }} style={styles.photoCapturePreview} />
                        ) : (
                          <View style={styles.photoCaptureEmpty}>
                            <MaterialCommunityIcons name={CAR_PHOTO_ICONS[index].name} size={CAR_PHOTO_ICONS[index].size} color={colors.text.subtle} />
                          </View>
                        )}
                        {carPhotoUris[index] && (
                          <View style={styles.carPhotoRetakeOverlay}>
                            <Ionicons name="camera-reverse-outline" size={12} color={colors.white} />
                          </View>
                        )}
                      </TouchableOpacity>
                      {carPhotoUris[index] && !isProcessing && (
                        <TouchableOpacity
                          style={styles.carPhotoDeleteButton}
                          onPress={() => {
                            setCarPhotoUris(prev => {
                              const updated = [...prev];
                              updated[index] = null;
                              return updated;
                            });
                            setVehicleVerificationStatus('idle');
                            setVehicleVerificationResult(null);
                          }}
                        >
                          <Ionicons name="close-circle" size={20} color={colors.error} />
                        </TouchableOpacity>
                      )}
                      <Text style={styles.carPhotoLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Verify Button */}
              {canVerify && (
                <TouchableOpacity style={styles.verifyVehicleButton} onPress={handleVerifyVehicle}>
                  <Ionicons name="scan-outline" size={20} color={colors.white} style={{ marginRight: spacing.sm }} />
                  <Text style={styles.verifyButtonText}>Verify Vehicle</Text>
                </TouchableOpacity>
              )}

              {/* Loading States */}
              {isProcessing && (
                <View style={styles.vehicleVerificationLoading}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.vehicleVerificationLoadingText}>
                    {vehicleVerificationStatus === 'uploading' ? 'Uploading photos...' : 'Analyzing vehicle...'}
                  </Text>
                  <Text style={styles.vehicleVerificationSubtext}>This may take a few seconds</Text>
                </View>
              )}

              {/* Error State */}
              {vehicleVerificationStatus === 'error' && (
                <View style={styles.vehicleVerificationErrorBanner}>
                  <Ionicons name="alert-circle" size={18} color={colors.secondary} />
                  <Text style={styles.vehicleVerificationErrorText}>
                    {vehicleVerificationError || 'Verification failed'}
                  </Text>
                  <TouchableOpacity onPress={handleVerifyVehicle}>
                    <Text style={styles.retryLink}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Verification Result Banners */}
              {vehicleVerificationStatus === 'approved' && (
                <View style={styles.autoFilledBanner}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.autoFilledText}>
                    Vehicle verified! Review the details below.
                  </Text>
                </View>
              )}
              {vehicleVerificationStatus === 'rejected' && (
                <View style={[styles.autoFilledBanner, { backgroundColor: `${colors.secondary}15` }]}>
                  <Ionicons name="close-circle" size={18} color={colors.secondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.autoFilledText, { color: colors.secondary }]}>
                      {vehicleVerificationResult?.reason || 'Verification failed.'}
                    </Text>
                    <Text style={[styles.autoFilledText, { color: colors.text.tertiary, fontSize: typography.fontSize.xs, marginTop: spacing.xs }]}>
                      Delete the photos using the X button and retake them to try again.
                    </Text>
                  </View>
                </View>
              )}

              {/* Editable Vehicle Fields */}
              {showFields && !isProcessing && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>VIN{isLocked ? ' (verified)' : ''}</Text>
                    <TextInput
                      style={[styles.textInput, isLocked && styles.lockedInput]}
                      value={formData.vehicleInfo.vin}
                      onChangeText={(value) => updateFormData('vehicleInfo.vin', value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17))}
                      placeholder="17-character VIN"
                      placeholderTextColor={colors.text.placeholder}
                      autoCapitalize="characters"
                      maxLength={17}
                      editable={!isLocked}
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <View style={[styles.inputContainer, { flex: 1, marginRight: spacing.sm }]}>
                      <Text style={styles.inputLabel}>Make *</Text>
                      <TextInput
                        style={[styles.textInput, isLocked && styles.lockedInput]}
                        value={formData.vehicleInfo.make}
                        onChangeText={(value) => updateFormData('vehicleInfo.make', value)}
                        placeholder="Toyota"
                        placeholderTextColor={colors.text.placeholder}
                        autoCapitalize="words"
                        editable={!isLocked}
                      />
                    </View>
                    <View style={[styles.inputContainer, { flex: 1, marginLeft: spacing.sm }]}>
                      <Text style={styles.inputLabel}>Model *</Text>
                      <TextInput
                        style={[styles.textInput, isLocked && styles.lockedInput]}
                        value={formData.vehicleInfo.model}
                        onChangeText={(value) => updateFormData('vehicleInfo.model', value)}
                        placeholder="Camry"
                        placeholderTextColor={colors.text.placeholder}
                        autoCapitalize="words"
                        editable={!isLocked}
                      />
                    </View>
                  </View>

                  <View style={styles.inputRow}>
                    <View style={[styles.inputContainer, { flex: 1, marginRight: spacing.sm }]}>
                      <Text style={styles.inputLabel}>Year *</Text>
                      <TextInput
                        style={[styles.textInput, isLocked && styles.lockedInput]}
                        value={formData.vehicleInfo.year}
                        onChangeText={(value) => updateFormData('vehicleInfo.year', formatYear(value))}
                        placeholder="2020"
                        placeholderTextColor={colors.text.placeholder}
                        keyboardType="numeric"
                        maxLength={4}
                        editable={!isLocked}
                      />
                    </View>
                    <View style={[styles.inputContainer, { flex: 1, marginLeft: spacing.sm }]}>
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
                </>
              )}

              {/* Prompt to take remaining photos */}
              {vehicleVerificationStatus === 'idle' && !canVerify && (
                <View style={styles.manualEntryNote}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.text.tertiary} />
                  <Text style={styles.manualEntryNoteText}>
                    {!vinPhotoUri && !hasAnyCarPhoto
                      ? 'Take a VIN plate photo and at least one vehicle photo to proceed.'
                      : !vinPhotoUri
                        ? 'Now take a photo of your VIN plate to verify.'
                        : 'Now take at least one vehicle photo to verify.'}
                  </Text>
                </View>
              )}
            </View>
          );
        }

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
      <ScrollView
        style={styles.contentArea}
        contentContainerStyle={styles.contentAreaInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
      </ScrollView>

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
    marginBottom: spacing.sm,
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
  },
  contentAreaInner: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  stepContainer: {
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
    marginBottom: spacing.lg,
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
    lineHeight: typography.fontSize.md * typography.lineHeight.normal,
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
    marginBottom: spacing.xl,
  },
  welcomeTitle: {
    fontSize: typography.fontSize.xxxl - spacing.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
    marginBottom: spacing.base,
    textAlign: 'center',
  },
  welcomeDescription: {
    fontSize: typography.fontSize.md,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: typography.fontSize.md * typography.lineHeight.normal,
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  benefitsList: {
    width: '100%',
    paddingHorizontal: spacing.base,
    marginTop: spacing.lg,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  benefitText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.md,
  },

  // Form content
  formContent: {
    width: '100%',
    paddingTop: spacing.lg,
  },
  formDescription: {
    fontSize: typography.fontSize.md,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: typography.fontSize.md * typography.lineHeight.normal,
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
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.background.input,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  lockedInput: {
    backgroundColor: colors.background.tertiary,
    borderColor: colors.border.strong,
    color: colors.text.tertiary,
    opacity: 0.7,
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
    marginBottom: spacing.xl,
  },
  finalTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
    marginBottom: spacing.base,
    textAlign: 'center',
  },
  finalDescription: {
    fontSize: typography.fontSize.md,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: typography.fontSize.md * typography.lineHeight.normal,
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  securityFeatures: {
    width: '100%',
    marginBottom: spacing.xxl,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  securityText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.md,
  },
  finalNote: {
    backgroundColor: colors.background.tertiary,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    width: '100%',
  },
  finalNoteText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
  },

  // Verification styles
  verificationFeatures: {
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  verificationItem: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
    alignItems: 'flex-start',
  },
  verificationIcon: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    backgroundColor: colors.successLight,
    borderRadius: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.base,
  },
  verificationContent: {
    flex: 1,
  },
  verificationTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  verificationText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
  },
  verifyButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    marginTop: spacing.lg,
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
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  verificationSuccessText: {
    color: colors.success,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  loadingText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    marginTop: spacing.sm,
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
    gap: spacing.md,
  },
  backActionButton: {
    flex: 1,
    backgroundColor: colors.border.strong,
    height: 56,
    justifyContent: 'center',
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
    height: 56,
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    alignItems: 'center',
    ...shadows.primary,
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
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
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
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },

  // State Picker styles
  pickerButton: {
    backgroundColor: colors.background.input,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.full,
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
    paddingVertical: spacing.base,
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
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginTop: spacing.xs,
    maxHeight: 200,
    zIndex: zIndex.dropdown,
    elevation: 10,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  suggestionText: {
    flex: 1,
    color: colors.white,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  addressInputWrapper: {
    position: 'relative',
  },
  addressLoadingIndicator: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInputWithLoader: {
    paddingRight: spacing.xxxl,
  },
  autoFilledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  autoFilledText: {
    color: colors.success,
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },

  // Vehicle verification styles
  photoSection: {
    marginBottom: spacing.lg,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
  },
  infoButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  sectionHint: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  photoCaptureSlot: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photoCaptureSlotFilled: {
    borderStyle: 'solid',
    borderColor: colors.success,
  },
  photoCaptureEmpty: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCaptureText: {
    color: colors.text.subtle,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.sm,
  },
  photoCapturePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoRetakeOverlay: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  photoRetakeText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.xs,
  },
  photoSlotWrapper: {
    position: 'relative',
  },
  photoDeleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 10,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.full,
  },
  carPhotosRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  carPhotoSlotContainer: {
    flex: 1,
    alignItems: 'center',
  },
  carPhotoSlot: {
    width: '100%',
    height: 110,
    backgroundColor: colors.background.tertiary,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  carPhotoLabel: {
    textAlign: 'center',
    marginTop: spacing.xs,
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  carPhotoDeleteButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 10,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.full,
  },
  carPhotoRetakeOverlay: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: spacing.xs,
    borderRadius: borderRadius.full,
  },
  verifyVehicleButton: {
    backgroundColor: colors.info,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  vehicleVerificationLoading: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  vehicleVerificationLoadingText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.md,
  },
  vehicleVerificationSubtext: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  vehicleVerificationErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.secondary}15`,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  vehicleVerificationErrorText: {
    color: colors.secondary,
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
    flex: 1,
  },
  retryLink: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  manualEntryNote: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  manualEntryNoteText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
});
