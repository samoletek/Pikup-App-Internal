import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from '../../styles/theme';

const ONBOARDING_DRAFT_STORAGE_PREFIX = 'driver_onboarding_draft_v1';

export default function DriverOnboardingCompleteScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const {
    currentUser,
    updateDriverPaymentProfile,
    checkDriverOnboardingStatus,
    getDriverOnboardingLink,
  } = useAuth();
  const { connectAccountId } = route.params || {};
  const userId = currentUser?.uid || currentUser?.id;
  
  const [isLoading, setIsLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('processing');
  const pollTimeoutRef = useRef(null);
  const pollAttemptsRef = useRef(0);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startCheckmarkAnimation = useCallback(() => {
    Animated.spring(checkmarkAnim, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [checkmarkAnim]);

  const checkVerificationStatus = useCallback(async () => {
    try {
      if (connectAccountId) {
        const statusResult = await checkDriverOnboardingStatus?.(connectAccountId);
        if (!statusResult?.success) {
          throw new Error(statusResult?.error || 'Could not verify Stripe Connect status');
        }

        if (statusResult.status === 'verified' || statusResult.canReceivePayments) {
          setVerificationStatus('verified');
          startCheckmarkAnimation();
          return;
        }

        setVerificationStatus('processing');
        if (pollAttemptsRef.current < 20) {
          pollAttemptsRef.current += 1;
          pollTimeoutRef.current = setTimeout(checkVerificationStatus, 5000);
        } else {
          setVerificationStatus('error');
        }
      } else {
        // No connect account ID, something went wrong
        setVerificationStatus('error');
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
      setVerificationStatus('error');
    }
  }, [checkDriverOnboardingStatus, connectAccountId, startCheckmarkAnimation]);

  const startAnimations = useCallback(() => {
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
  }, [fadeAnim, pulseAnim, scaleAnim]);

  useEffect(() => {
    // Start animations
    startAnimations();
    
    // Check actual verification status from Stripe Connect
    checkVerificationStatus();
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [checkVerificationStatus, startAnimations]);

  const handleContinue = async () => {
    setIsLoading(true);
    
    try {
      console.log('Updating driver profile with completion status...');
      console.log('Connect Account ID:', connectAccountId);

      if (!userId) {
        throw new Error('User not found');
      }
      
      await updateDriverPaymentProfile?.(userId, {
        onboardingComplete: true,
        connectAccountId,
        completedAt: new Date().toISOString(),
        onboardingStep: null,
        onboardingDraft: null,
        onboardingLastSavedAt: null,
      });

      await AsyncStorage.removeItem(`${ONBOARDING_DRAFT_STORAGE_PREFIX}:${userId}`);
      
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

  const handleResumeOnboarding = async () => {
    try {
      if (!connectAccountId) {
        throw new Error('Missing Stripe Connect account ID');
      }

      const result = await getDriverOnboardingLink?.(connectAccountId);
      if (!result?.success || !result?.onboardingUrl) {
        throw new Error(result?.error || 'Unable to open onboarding link');
      }

      await Linking.openURL(result.onboardingUrl);
    } catch (error) {
      Alert.alert('Onboarding Error', error?.message || 'Could not reopen onboarding.');
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
        colors={[colors.success, colors.success]}
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
          <Ionicons name="checkmark" size={48} color={colors.white} />
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
              <Ionicons name="time" size={20} color={colors.primary} />
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
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
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
            <Ionicons name="trending-up" size={20} color={colors.success} />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Track Your Earnings</Text>
            <Text style={styles.stepSubtitle}>
              Monitor your daily and weekly earnings
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.text.subtle} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.stepItem} onPress={handleSettings}>
          <View style={styles.stepIcon}>
            <Ionicons name="card" size={20} color={colors.primary} />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Payment Settings</Text>
            <Text style={styles.stepSubtitle}>
              Manage your bank account and instant pay
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.text.subtle} />
        </TouchableOpacity>

        <View style={styles.stepItem}>
          <View style={styles.stepIcon}>
            <Ionicons name="car" size={20} color={colors.secondary} />
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
            <Ionicons name="flash" size={16} color={colors.success} />
          </View>
          <Text style={styles.featureText}>Instant pay available</Text>
        </View>
        
        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Ionicons name="shield-checkmark" size={16} color={colors.success} />
          </View>
          <Text style={styles.featureText}>Insurance coverage</Text>
        </View>
        
        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Ionicons name="people" size={16} color={colors.success} />
          </View>
          <Text style={styles.featureText}>24/7 support</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Setup Complete"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
        {verificationStatus === 'error' && (
          <TouchableOpacity style={styles.retryButton} onPress={handleResumeOnboarding}>
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={styles.retryButtonText}>Resume Stripe Onboarding</Text>
          </TouchableOpacity>
        )}

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
                  ? [colors.success, colors.success]
                  : [colors.text.subtle, colors.text.subtle]
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

        <View style={[styles.bottomSpacing, { paddingBottom: insets.bottom }]} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  successSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.sm,
    paddingBottom: spacing.xxl,
  },
  successIconContainer: {
    position: 'relative',
    marginBottom: spacing.xxl,
  },
  successIconGradient: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.circle,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.success,
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
    borderRadius: borderRadius.circle,
    borderWidth: 2,
    borderColor: colors.successLight,
    top: -20,
    left: -20,
  },
  pulseRing2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: borderRadius.circle,
    borderWidth: 1,
    borderColor: colors.successLight,
    top: -40,
    left: -40,
  },
  successContent: {
    alignItems: 'center',
  },
  congratsTitle: {
    fontSize: 28,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  congratsSubtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  verificationCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  processingIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  verifiedIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  verificationTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  verificationSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    lineHeight: 20,
  },
  nextStepsSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  nextStepsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.base,
  },
  stepsList: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: 'hidden',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.strong,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.base,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
  },
  comingSoonBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  comingSoonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success,
  },
  featuresSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
  },
  featuresTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.base,
  },
  featuresList: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  featureText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  buttonSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  continueButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: colors.success,
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
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  continueButtonTextDisabled: {
    color: colors.text.subtle,
  },
  retryButton: {
    marginTop: spacing.base,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  bottomSpacing: {
    height: 40,
  },
}); 
