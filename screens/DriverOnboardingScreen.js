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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
// import { useStripeIdentity } from '@stripe/stripe-identity-react-native';

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

  // const { status, present, loading: identityLoading } = useStripeIdentity(fetchVerificationSessionParams);

  // Handle verification status
  // useEffect(() => {
  //   if (status === 'FlowCompleted') {
  //     setVerificationStatus('completed');
  //     Alert.alert(
  //       'Verification Complete!',
  //       'Your identity has been verified successfully.',
  //       [{ text: 'Continue', onPress: () => nextStep() }]
  //     );
  //   } else if (status === 'FlowCanceled') {
  //     setVerificationStatus('canceled');
  //   } else if (status === 'FlowFailed') {
  //     setVerificationStatus('failed');
  //     Alert.alert('Verification Failed', 'Please try again.');
  //   }
  // }, [status]);

  const steps = [
    {
      title: 'Welcome to PikUp',
      subtitle: 'Let\'s get you set up to start earning',
      icon: 'car-outline',
      color: '#A77BFF'
    },
    {
      title: 'Identity Verification',
      subtitle: 'Quick verification for your safety',
      icon: 'shield-checkmark-outline',
      color: '#00D4AA'
    },
    {
      title: 'Personal Information',
      subtitle: 'We need some basic info about you',
      icon: 'person-outline',
      color: '#A77BFF'
    },
    {
      title: 'Address Details',
      subtitle: 'Where should we send your payments?',
      icon: 'location-outline',
      color: '#00D4AA'
    },
    {
      title: 'Vehicle Information',
      subtitle: 'Tell us about your vehicle',
      icon: 'car-sport-outline',
      color: '#A77BFF'
    },
    {
      title: 'Payment Setup',
      subtitle: 'Secure payment processing setup',
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

      // Create Stripe Connect account
      const connectResult = await createDriverConnectAccount({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth,
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
            <View style={styles.welcomeIconContainer}>
              <Ionicons name="car-outline" size={64} color="#A77BFF" />
            </View>
            <Text style={styles.welcomeTitle}>Ready to Start Earning?</Text>
            <Text style={styles.welcomeDescription}>
              Join thousands of drivers earning money on their own schedule. We'll help you get set up in just a few minutes.
            </Text>
            
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
            <Text style={styles.formDescription}>
              For the safety of our community, we need to verify your identity. This process takes just 2-3 minutes.
            </Text>
            
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

            {verificationStatus === 'completed' && (
              <View style={styles.verificationSuccess}>
                <Ionicons name="checkmark-circle" size={32} color="#00D4AA" />
                <Text style={styles.verificationSuccessText}>
                  Identity verified successfully!
                </Text>
              </View>
            )}

            {/* {identityLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00D4AA" />
                <Text style={styles.loadingText}>Preparing verification...</Text>
              </View>
            )} */}

            <TouchableOpacity
              style={[
                styles.verifyButton,
                verificationStatus === 'completed' && styles.verifyButtonDisabled
              ]}
              onPress={() => {
                // present() - Stripe Identity temporarily disabled
                Alert.alert('Temporarily Unavailable', 'Will be back when server is running again!');
              }}
              disabled={verificationStatus === 'completed'}
            >
              <Text style={styles.verifyButtonText}>
                {verificationStatus === 'completed' ? 'Verified \u2713' : 'Start Verification'}
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 2: // Personal Info
        return (
          <View style={styles.formContent}>
            <Text style={styles.formDescription}>
              Let's start with some basic information about you.
            </Text>
            
            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>First Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.firstName}
                  onChangeText={(value) => updateFormData('firstName', value)}
                  placeholder="John"
                  placeholderTextColor="#666"
                  autoCapitalize="words"
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Last Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.lastName}
                  onChangeText={(value) => updateFormData('lastName', value)}
                  placeholder="Doe"
                  placeholderTextColor="#666"
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Phone Number *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.phoneNumber}
                onChangeText={(value) => updateFormData('phoneNumber', value)}
                placeholder="(555) 123-4567"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Date of Birth *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.dateOfBirth}
                onChangeText={(value) => updateFormData('dateOfBirth', value)}
                placeholder="MM/DD/YYYY"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
            </View>
          </View>
        );

      case 3: // Address
        return (
          <View style={styles.formContent}>
            <Text style={styles.formDescription}>
              We need your address for payment processing and verification.
            </Text>
            
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
                <TextInput
                  style={styles.textInput}
                  value={formData.address.state}
                  onChangeText={(value) => updateFormData('address.state', value)}
                  placeholder="GA"
                  placeholderTextColor="#666"
                  autoCapitalize="characters"
                  maxLength={2}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>ZIP Code *</Text>
              <TextInput
                style={[styles.textInput, { width: '50%' }]}
                value={formData.address.postalCode}
                onChangeText={(value) => updateFormData('address.postalCode', value)}
                placeholder="30309"
                placeholderTextColor="#666"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>
        );

      case 4: // Vehicle Info
        return (
          <View style={styles.formContent}>
            <Text style={styles.formDescription}>
              Tell us about the vehicle you'll be using for deliveries.
            </Text>
            
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
                  onChangeText={(value) => updateFormData('vehicleInfo.year', value)}
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
                style={[styles.textInput, { width: '60%' }]}
                value={formData.vehicleInfo.licensePlate}
                onChangeText={(value) => updateFormData('vehicleInfo.licensePlate', value)}
                placeholder="ABC123"
                placeholderTextColor="#666"
                autoCapitalize="characters"
              />
            </View>
          </View>
        );

      case 5: // Payment Setup
        return (
          <View style={styles.finalContent}>
            <View style={styles.finalIconContainer}>
              <Ionicons name="card-outline" size={48} color="#A77BFF" />
            </View>
            <Text style={styles.finalTitle}>Secure Payment Setup</Text>
            <Text style={styles.finalDescription}>
              We'll now set up your secure payment account with Stripe. This ensures you get paid quickly and safely for every delivery.
            </Text>
            
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
});