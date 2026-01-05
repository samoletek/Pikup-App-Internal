import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';

export default function DriverOnboardingCompleteScreen({ navigation, route }) {
  const { updateDriverPaymentProfile, checkDriverOnboardingStatus } = useAuth();
  const { connectAccountId } = route.params || {};
  
  const [isLoading, setIsLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('processing');
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start animations
    startAnimations();
    
    // Check actual verification status (or simulate for testing)
    checkVerificationStatus();
  }, []);

  const checkVerificationStatus = async () => {
    try {
      if (connectAccountId) {
        console.log('Checking verification status for account:', connectAccountId);
        
        // For real implementation, you would call your backend to check Stripe Connect status
        // const statusResult = await checkDriverOnboardingStatus(connectAccountId);
        
        // For now, simulate a delay then set as verified
        // In production, you'd check the actual status from your backend
        setTimeout(() => {
          setVerificationStatus('verified');
          startCheckmarkAnimation();
        }, 3000); // Slightly longer delay to show the processing state
      } else {
        // No connect account ID, something went wrong
        setVerificationStatus('error');
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
      setVerificationStatus('error');
    }
  };

  const startAnimations = () => {
    // Fade in and scale up
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startCheckmarkAnimation = () => {
    Animated.spring(checkmarkAnim, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleContinue = async () => {
    setIsLoading(true);
    
    try {
      console.log('Updating driver profile with completion status...');
      console.log('Connect Account ID:', connectAccountId);
      
      // Update driver profile with completion status
      await updateDriverPaymentProfile?.({
        onboardingComplete: true,
        connectAccountId,
        completedAt: new Date().toISOString(),
      });
      
      console.log('Profile updated successfully, navigating to driver tabs...');
      
      // Navigate to driver tabs (which contains the home screen)
      navigation.reset({
        index: 0,
        routes: [{ name: 'DriverTabs' }],
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert(
        'Error',
        `There was an issue completing your setup: ${error.message}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewEarnings = () => {
    navigation.navigate('DriverEarningsScreen');
  };

  const handleSettings = () => {
    navigation.navigate('DriverPaymentSettingsScreen');
  };

  const renderSuccessIcon = () => (
    <Animated.View
      style={[
        styles.successIconContainer,
        {
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { scale: pulseAnim },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={['#00D4AA', '#00A67C']}
        style={styles.successIconGradient}
      >
        <Animated.View
          style={[
            styles.checkmarkContainer,
            {
              transform: [{ scale: checkmarkAnim }],
            },
          ]}
        >
          <Ionicons name="checkmark" size={48} color="#fff" />
        </Animated.View>
      </LinearGradient>
      
      {/* Pulse rings */}
      <View style={styles.pulseRing1} />
      <View style={styles.pulseRing2} />
    </Animated.View>
  );

  const renderVerificationStatus = () => {
    if (verificationStatus === 'processing') {
      return (
        <View style={styles.verificationCard}>
          <View style={styles.verificationHeader}>
            <View style={styles.processingIcon}>
              <Ionicons name="time" size={20} color="#A77BFF" />
            </View>
            <Text style={styles.verificationTitle}>Verifying Your Account</Text>
          </View>
          <Text style={styles.verificationSubtitle}>
            We're reviewing your information. This usually takes a few minutes.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.verificationCard}>
        <View style={styles.verificationHeader}>
          <View style={styles.verifiedIcon}>
            <Ionicons name="checkmark-circle" size={20} color="#00D4AA" />
          </View>
          <Text style={styles.verificationTitle}>Account Verified</Text>
        </View>
        <Text style={styles.verificationSubtitle}>
          Your account is ready! You can now start accepting delivery requests.
        </Text>
      </View>
    );
  };

  const renderNextSteps = () => (
    <View style={styles.nextStepsSection}>
      <Text style={styles.nextStepsTitle}>What's Next?</Text>
      
      <View style={styles.stepsList}>
        <TouchableOpacity style={styles.stepItem} onPress={handleViewEarnings}>
          <View style={styles.stepIcon}>
            <Ionicons name="trending-up" size={20} color="#00D4AA" />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Track Your Earnings</Text>
            <Text style={styles.stepSubtitle}>
              Monitor your daily and weekly earnings
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.stepItem} onPress={handleSettings}>
          <View style={styles.stepIcon}>
            <Ionicons name="card" size={20} color="#A77BFF" />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Payment Settings</Text>
            <Text style={styles.stepSubtitle}>
              Manage your bank account and instant pay
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <View style={styles.stepItem}>
          <View style={styles.stepIcon}>
            <Ionicons name="car" size={20} color="#FF6B6B" />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Go Online</Text>
            <Text style={styles.stepSubtitle}>
              Start accepting delivery requests
            </Text>
          </View>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>Ready!</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderFeatureHighlights = () => (
    <View style={styles.featuresSection}>
      <Text style={styles.featuresTitle}>Exclusive Driver Benefits</Text>
      
      <View style={styles.featuresList}>
        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Ionicons name="flash" size={16} color="#00D4AA" />
          </View>
          <Text style={styles.featureText}>Instant pay available</Text>
        </View>
        
        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Ionicons name="shield-checkmark" size={16} color="#00D4AA" />
          </View>
          <Text style={styles.featureText}>Insurance coverage</Text>
        </View>
        
        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Ionicons name="people" size={16} color="#00D4AA" />
          </View>
          <Text style={styles.featureText}>24/7 support</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Setup Complete</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Success Animation */}
        <View style={styles.successSection}>
          {renderSuccessIcon()}
          
          <Animated.View
            style={[
              styles.successContent,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
            ]}
          >
            <Text style={styles.congratsTitle}>Congratulations!</Text>
            <Text style={styles.congratsSubtitle}>
              Welcome to the PikUp driver community! Your account setup is complete.
            </Text>
          </Animated.View>
        </View>

        {/* Verification Status */}
        {renderVerificationStatus()}

        {/* Next Steps */}
        {verificationStatus === 'verified' && renderNextSteps()}

        {/* Feature Highlights */}
        {renderFeatureHighlights()}

        {/* Continue Button */}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              verificationStatus !== 'verified' && styles.continueButtonDisabled
            ]}
            onPress={handleContinue}
            disabled={isLoading || verificationStatus !== 'verified'}
          >
            <LinearGradient
              colors={
                verificationStatus === 'verified' 
                  ? ['#00D4AA', '#00A67C']
                  : ['#333', '#333']
              }
              style={styles.continueButtonGradient}
            >
              <Text style={[
                styles.continueButtonText,
                verificationStatus !== 'verified' && styles.continueButtonTextDisabled
              ]}>
                {isLoading ? 'Starting...' : 'Start Driving'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#141426',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  successSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 32,
  },
  successIconContainer: {
    position: 'relative',
    marginBottom: 32,
  },
  successIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  checkmarkContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing1: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: '#00D4AA40',
    top: -20,
    left: -20,
  },
  pulseRing2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#00D4AA20',
    top: -40,
    left: -40,
  },
  successContent: {
    alignItems: 'center',
  },
  congratsTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  congratsSubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  verificationCard: {
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  processingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#A77BFF20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  verifiedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00D4AA20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  verificationSubtitle: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  nextStepsSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  nextStepsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  stepsList: {
    backgroundColor: '#141426',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
    overflow: 'hidden',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3B',
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A3A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  comingSoonBadge: {
    backgroundColor: '#00D4AA20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  comingSoonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00D4AA',
  },
  featuresSection: {
    marginHorizontal: 20,
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  featuresList: {
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00D4AA20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  buttonSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  continueButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  continueButtonTextDisabled: {
    color: '#666',
  },
  bottomSpacing: {
    height: 40,
  },
}); 