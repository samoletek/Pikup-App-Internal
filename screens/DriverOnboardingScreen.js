import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
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
import { useAuth } from '../contexts/AuthContext';
import { useStripeIdentity } from '@stripe/stripe-identity-react-native';

const { width, height } = Dimensions.get('window');

export default function DriverOnboardingScreen({ navigation }) {
  const { currentUser, createDriverConnectAccount, getDriverOnboardingLink } = useAuth();

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

  // Define payment service URL - Render backend
  const PAYMENT_SERVICE_URL = 'https://pikup-server.onrender.com';

  // Stripe Identity hook setup
  const fetchVerificationSessionParams = async () => {
    try {
      const response = await fetch(`${PAYMENT_SERVICE_URL}/create-verification-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.uid,
          email: currentUser.email,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create verification session');
      }

      const data = await response.json();
      setVerificationSessionId(data.id);

      return {
        sessionId: data.id,
        ephemeralKeySecret: data.ephemeral_key_secret,
        brandLogo: Image.resolveAssetSource(require('../assets/icon.png')),
      };
    } catch (error) {
      console.error('Error creating verification session:', error);
      Alert.alert('Error', 'Failed to start verification process');
      return {};
    }
  };

  const { status, present, loading: identityLoading } = useStripeIdentity(fetchVerificationSessionParams);

  // Handle verification status
  useEffect(() => {
    if (status === 'FlowCompleted') {
      setVerificationStatus('completed');
      Alert.alert(
        'Verification Complete!',
        'Your identity has been verified successfully.',
        [{ text: 'Continue', onPress: () => nextStep() }]
      );
    } else if (status === 'FlowCanceled') {
      setVerificationStatus('canceled');
    } else if (status === 'FlowFailed') {
      setVerificationStatus('failed');
      Alert.alert('Verification Failed', 'Please try again.');
    }
  }, [status]);

  const steps = [
    {
      title: 'Welcome to PikUp',
      subtitle: 'Join thousands of drivers earning money on their own schedule. We\'ll help you get set up in just a few minutes.',
      icon: 'car-outline',
      color: '#A77BFF'
    },
    {
      title: 'Identity Verification',
      subtitle: 'For the safety of our community, we need to verify your identity. This process takes just 2-3 minutes.',
      icon: 'shield-checkmark-outline',
      color: '#00D4AA'
    },
    {
      title: 'Personal Information',
      subtitle: 'Let\'s start with some basic information about you.',
      icon: 'person-outline',
      color: '#A77BFF'
    },
    {
      title: 'Address Details',
      subtitle: 'We need your address for payment processing and verification.',
      icon: 'location-outline',
      color: '#00D4AA'
    },
    {
      title: 'Vehicle Information',
      subtitle: 'Tell us about the vehicle you\'ll be using for deliveries.',
      icon: 'car-sport-outline',
      color: '#A77BFF'
    },
    {
      title: 'Payment Setup',
      subtitle: 'We\'ll now set up your secure payment account with Stripe. This ensures you get paid quickly and safely.',
      icon: 'card-outline',
      color: '#00D4AA'
    },
  ];

  const updateFormData = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  // Input formatting/masking helpers
  const formatPhoneNumber = (text) => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');
    // Format as (XXX) XXX-XXXX
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      let formatted = '';
      if (match[1]) formatted = `(${match[1]}`;
      if (match[2]) formatted += `) ${match[2]}`;
      if (match[3]) formatted += `-${match[3]}`;
      return formatted;
    }
    return text;
  };

  const formatDateOfBirth = (text) => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');
    // Format as MM/DD/YYYY
    const match = cleaned.match(/^(\d{0,2})(\d{0,2})(\d{0,4})$/);
    if (match) {
      let formatted = '';
      let month = match[1];
      let day = match[2];
      let year = match[3];

      // Validate month (01-12)
      if (month && month.length === 2) {
        const monthNum = parseInt(month);
        if (monthNum > 12) month = '12';
        if (monthNum < 1 && month.length === 2) month = '01';
      }

      // Validate day (01-31)
      if (day && day.length === 2) {
        const dayNum = parseInt(day);
        if (dayNum > 31) day = '31';
        if (dayNum < 1 && day.length === 2) day = '01';
      }

      // Validate year (1900 - current year minus 18)
      if (year && year.length === 4) {
        const yearNum = parseInt(year);
        const currentYear = new Date().getFullYear();
        const maxYear = currentYear - 18; // Must be at least 18
        const minYear = 1900;

        if (yearNum > maxYear) year = maxYear.toString();
        if (yearNum < minYear) year = minYear.toString();
      }

      if (month) formatted = month;
      if (day) formatted += `/${day}`;
      if (year) formatted += `/${year}`;
      return formatted;
    }
    return text;
  };

  const formatName = (text) => {
    // Remove digits and limit to letters, spaces, hyphens, apostrophes
    return text.replace(/[0-9]/g, '').replace(/[^a-zA-Z\s\-']/g, '');
  };

  const validateName = (name) => {
    // Must be at least 2 characters and only letters
    return name.length >= 2 && /^[a-zA-Z\s\-']+$/.test(name);
  };

  const formatZipCode = (text) => {
    // Only digits, max 5
    return text.replace(/\D/g, '').slice(0, 5);
  };

  const formatYear = (text) => {
    // Only digits, max 4
    return text.replace(/\D/g, '').slice(0, 4);
  };

  const formatLicensePlate = (text) => {
    // Uppercase, alphanumeric only, 2-8 characters
    return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  };

  // US States for picker
  const US_STATES = [
    { label: 'Select State', value: '' },
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
    { label: 'Washington DC', value: 'DC' },
  ];

  const [showStatePicker, setShowStatePicker] = useState(false);

  const animateProgress = (step) => {
    Animated.timing(progressAnim, {
      toValue: step / (steps.length - 1),
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      animateProgress(newStep);

      // Scroll to top of new step
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      animateProgress(newStep);

      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1: // Identity Verification
        return verificationStatus === 'completed';
      case 2: // Personal Info
        return formData.firstName && formData.lastName && formData.phoneNumber && formData.dateOfBirth;
      case 3: // Address
        return formData.address.line1 && formData.address.city && formData.address.state && formData.address.postalCode;
      case 4: // Vehicle
        return formData.vehicleInfo.make && formData.vehicleInfo.model && formData.vehicleInfo.year && formData.vehicleInfo.licensePlate;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (currentStep === steps.length - 1) {
      // Final step - create Connect account
      await handleCreateConnectAccount();
    } else if (currentStep === 0 || validateCurrentStep()) {
      nextStep();
    } else {
      Alert.alert('Required Fields', 'Please fill in all required fields to continue.');
    }
  };

  const handleCreateConnectAccount = async () => {
    setLoading(true);
    try {
      // REAL API CALLS - Testing with actual backend
      console.log('Creating Connect account with data:', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth,
        address: formData.address,
        vehicleInfo: formData.vehicleInfo,
      });

      // Parse dateOfBirth - handle both MM/DD/YYYY and MMDDYYYY formats
      let dobDay, dobMonth, dobYear;
      if (formData.dateOfBirth) {
        const dob = formData.dateOfBirth.replace(/\D/g, ''); // Remove all non-digits
        if (dob.length === 8) {
          // MMDDYYYY format
          dobMonth = parseInt(dob.substring(0, 2), 10);
          dobDay = parseInt(dob.substring(2, 4), 10);
          dobYear = parseInt(dob.substring(4, 8), 10);
        } else if (formData.dateOfBirth.includes('/')) {
          // MM/DD/YYYY format
          const parts = formData.dateOfBirth.split('/');
          if (parts.length === 3) {
            dobMonth = parseInt(parts[0], 10);
            dobDay = parseInt(parts[1], 10);
            dobYear = parseInt(parts[2], 10);
          }
        }
      }

      // Create Stripe Connect account
      const connectResult = await createDriverConnectAccount({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        dob: {
          day: dobDay || 1,
          month: dobMonth || 1,
          year: dobYear || 1990,
        },
        address: formData.address,
        vehicleInfo: formData.vehicleInfo,
        verificationSessionId: verificationSessionId,
      });

      if (connectResult.success) {
        // Get onboarding link
        const onboardingResult = await getDriverOnboardingLink(
          connectResult.connectAccountId,
          'pikup://driver-onboarding-refresh',
          'pikup://driver-onboarding-complete'
        );

        if (onboardingResult.success) {
          // Open Stripe onboarding in browser
          await Linking.openURL(onboardingResult.onboardingUrl);

          // Navigate to completion screen
          navigation.navigate('DriverOnboardingCompleteScreen', {
            connectAccountId: connectResult.connectAccountId,
          });
        } else {
          throw new Error(onboardingResult.error);
        }
      } else {
        throw new Error(connectResult.error);
      }

      /* 
      // MOCK DATA - Uncomment this section if you want to use mock data for testing
      
      // MOCK: Simulate successful Connect account creation
      console.log('MOCK: Creating Connect account with data:', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth,
        address: formData.address,
        vehicleInfo: formData.vehicleInfo,
      });
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const connectResult = {
        success: true,
        connectAccountId: `acct_mock_${Date.now()}`
      };
  
      if (connectResult.success) {
        // MOCK: Show alert and navigate directly to completion
        Alert.alert(
          'Mock Mode',
          'In production, this would redirect to Stripe for verification. Proceeding to completion screen...',
          [
            {
              text: 'Continue',
              onPress: () => {
                navigation.navigate('DriverOnboardingCompleteScreen', {
                  connectAccountId: connectResult.connectAccountId,
                  isMockMode: true, // Flag to indicate this is mock data
                });
              }
            }
          ]
        );
      } else {
        throw new Error(connectResult.error);
      }
      */
    } catch (error) {
      console.error('Error creating Connect account:', error);
      Alert.alert(
        'Setup Error',
        `There was an issue setting up your payment account: ${error.message}`,
        [{ text: 'OK' }]
      );
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
              onPress={() => {
                present();
              }}
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
          </View>
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
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
    </SafeAreaView>
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
    paddingTop: 10,
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