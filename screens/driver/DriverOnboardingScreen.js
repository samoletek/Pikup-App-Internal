import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Linking,
  Animated,
  Dimensions,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useStripeIdentity } from '@stripe/stripe-identity-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabase';

const { width, height } = Dimensions.get('window');

const steps = [
  {
    title: 'Welcome to PikUp',
    subtitle: 'Start earning by delivering packages on your route',
    icon: 'car-sport',
    color: '#A77BFF',
  },
  {
    title: 'Identity Verification',
    subtitle: 'We need to verify your identity to ensure safety',
    icon: 'shield-checkmark',
    color: '#00D4AA',
  },
  {
    title: 'Personal Info',
    subtitle: 'Tell us a bit about yourself',
    icon: 'person',
    color: '#FFB800',
  },
  {
    title: 'Address',
    subtitle: 'Where do you live?',
    icon: 'location',
    color: '#FF6B6B',
  },
  {
    title: 'Vehicle Info',
    subtitle: 'What will you be driving?',
    icon: 'car',
    color: '#4DA6FF',
  },
  {
    title: 'Payment Setup',
    subtitle: 'How you get paid',
    icon: 'card',
    color: '#A77BFF',
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

export default function DriverOnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currentUser, createDriverConnectAccount, getDriverOnboardingLink, updateDriverPaymentProfile } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [verificationSessionId, setVerificationSessionId] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState('pending'); // pending, completed, failed, canceled
  const [formData, setFormData] = useState({
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
  });

  const scrollViewRef = useRef();
  const progressAnim = useRef(new Animated.Value(0)).current;

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
        },
        headers: {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
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

      // Scroll to top
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
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
      // Scroll to top
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
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
                <Ionicons name="cash-outline" size={20} color="#00D4AA" />
                <Text style={styles.benefitText}>Earn up to $25/hour</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="time-outline" size={20} color="#00D4AA" />
                <Text style={styles.benefitText}>Flexible schedule</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="card-outline" size={20} color="#00D4AA" />
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
                  <Ionicons name="camera-outline" size={24} color="#00D4AA" />
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
                  <Ionicons name="person-circle-outline" size={24} color="#00D4AA" />
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
                  <Ionicons name="lock-closed-outline" size={24} color="#00D4AA" />
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
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={[styles.verifyButtonText, { marginLeft: 8 }]}>Preparing verification...</Text>
                </View>
              ) : verificationStatus === 'completed' ? (
                <View style={styles.buttonLoadingContainer}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
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
                  placeholderTextColor="#666"
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
                  placeholderTextColor="#666"
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
                placeholderTextColor="#666"
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
                placeholderTextColor="#666"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>
        );

      case 3: // Address
        return (
          <View style={styles.formContent}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Street Address *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.address.line1}
                onChangeText={(value) => updateFormData('address.line1', value)}
                placeholder="123 Main Street"
                placeholderTextColor="#666"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, { flex: 2, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>City *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.address.city}
                  onChangeText={(value) => updateFormData('address.city', value)}
                  placeholder="Atlanta"
                  placeholderTextColor="#666"
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
                  <Ionicons name="chevron-down" size={16} color="#666" />
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
                placeholderTextColor="#666"
                keyboardType="numeric"
                maxLength={5}
              />
              {formData.address.postalCode.length > 0 && formData.address.postalCode.length < 5 && (
                <Text style={styles.inputHint}>ZIP must be 5 digits</Text>
              )}
            </View>

            {/* State Picker Modal */}
            <Modal
              visible={showStatePicker}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowStatePicker(false)}
            >
              <View style={styles.pickerModalOverlay}>
                <View style={styles.pickerModal}>
                  <View style={styles.pickerHeader}>
                    <Text style={styles.pickerTitle}>Select State</Text>
                    <TouchableOpacity onPress={() => setShowStatePicker(false)}>
                      <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.pickerList}>
                    {US_STATES.map((state) => (
                      <TouchableOpacity
                        key={state.value}
                        style={[
                          styles.pickerItem,
                          formData.address.state === state.value && styles.pickerItemSelected
                        ]}
                        onPress={() => {
                          updateFormData('address.state', state.value);
                          setShowStatePicker(false);
                        }}
                      >
                        <Text style={[
                          styles.pickerItemText,
                          formData.address.state === state.value && styles.pickerItemTextSelected
                        ]}>
                          {state.label}
                        </Text>
                        {formData.address.state === state.value && (
                          <Ionicons name="checkmark" size={20} color="#00D4AA" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>
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
                  placeholderTextColor="#666"
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
                  placeholderTextColor="#666"
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
                  placeholderTextColor="#666"
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
                  placeholderTextColor="#666"
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
                placeholderTextColor="#666"
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
                <Ionicons name="shield-checkmark" size={20} color="#00D4AA" />
                <Text style={styles.securityText}>Bank-level security</Text>
              </View>
              <View style={styles.securityItem}>
                <Ionicons name="flash" size={20} color="#00D4AA" />
                <Text style={styles.securityText}>Fast payments</Text>
              </View>
              <View style={styles.securityItem}>
                <Ionicons name="lock-closed" size={20} color="#00D4AA" />
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
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
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
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{steps[currentStep].title}</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      {renderProgressBar()}

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.stepContainer}>
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
      <View style={styles.bottomActions}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#141426',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3B',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#141426',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3B',
  },
  progressBackground: {
    height: 4,
    backgroundColor: '#2A2A3B',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#A77BFF',
    borderRadius: 2,
  },
  progressText: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  stepContainer: {
    padding: 20,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#999',
    marginBottom: 32,
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
    backgroundColor: '#1A1A3A',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  welcomeDescription: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  benefitsList: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141426',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  benefitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },

  // Form content
  formContent: {
    width: '100%',
    paddingTop: 20,
  },
  formDescription: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#141426',
    borderWidth: 1,
    borderColor: '#2A2A3B',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 16,
  },

  // Final content
  finalContent: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 20,
  },
  finalIconContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#1A1A3A',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  finalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  finalDescription: {
    fontSize: 16,
    color: '#999',
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
    backgroundColor: '#141426',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  securityText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
  },
  finalNote: {
    backgroundColor: '#1A1A3A',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
    width: '100%',
  },
  finalNoteText: {
    color: '#999',
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
    backgroundColor: '#00D4AA20',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  verificationContent: {
    flex: 1,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  verificationText: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  verifyButton: {
    backgroundColor: '#00D4AA',
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
  },
  verifyButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.7,
  },
  verifyButtonSuccess: {
    backgroundColor: '#00D4AA',
    opacity: 1,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  verificationSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D4AA20',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  verificationSuccessText: {
    color: '#00D4AA',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingText: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
  },

  // Bottom actions
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#141426',
    borderTopWidth: 1,
    borderTopColor: '#2A2A3B',
    gap: 12,
  },
  backActionButton: {
    flex: 1,
    backgroundColor: '#2A2A3B',
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
  },
  backActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    backgroundColor: '#A77BFF',
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#A77BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonDisabled: {
    backgroundColor: '#666',
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    borderColor: '#FF6B6B',
    borderWidth: 1,
  },
  inputHint: {
    color: '#FF6B6B',
    fontSize: 11,
    marginTop: 4,
  },

  // State Picker styles
  pickerButton: {
    backgroundColor: '#141426',
    borderWidth: 1,
    borderColor: '#2A2A3B',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  pickerButtonPlaceholder: {
    color: '#666',
    fontSize: 16,
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: '#1E1E2E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3B',
  },
  pickerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  pickerList: {
    paddingHorizontal: 16,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3B',
  },
  pickerItemSelected: {
    backgroundColor: 'rgba(167, 123, 255, 0.1)',
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  pickerItemText: {
    color: '#fff',
    fontSize: 16,
  },
  pickerItemTextSelected: {
    color: '#A77BFF',
    fontWeight: '600',
  },
});