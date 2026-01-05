import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

export default function DriverProfileScreen({ navigation }) {
  const { currentUser, logout, getDriverProfile, getUserProfile, profileImage, getProfileImage } = useAuth();
  const [driverProfile, setDriverProfile] = useState(null);
  const [displayName, setDisplayName] = useState("Driver");
  const [onboardingStatus, setOnboardingStatus] = useState({
    connectAccountCreated: false,
    onboardingComplete: false,
    documentsVerified: false,
    canReceivePayments: false
  });

  useEffect(() => {
    loadDriverProfile();
  }, []);

  const loadDriverProfile = async () => {
    try {
      const profile = await getDriverProfile?.(currentUser?.uid);
      setDriverProfile(profile);
      
      // Fetch canonical identity from /users/{uid}
      const user = await getUserProfile(); // uses currentUser.uid internally
      const name =
        user?.name ||
        (user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : currentUser?.email?.split("@")[0] || "Driver");
      setDisplayName(name);
      
      // Load profile image
      await getProfileImage?.();
      
      if (profile) {
        setOnboardingStatus({
          connectAccountCreated: !!profile.connectAccountId,
          onboardingComplete: profile.onboardingComplete || false,
          documentsVerified: profile.documentsVerified || false,
          canReceivePayments: profile.canReceivePayments || false
        });
      }
    } catch (error) {
      console.error('Error loading driver profile:', error);
    }
  };

  const handleStartOnboarding = () => {
    navigation.navigate('DriverOnboardingScreen');
  };

  const handleResumeOnboarding = () => {
    if (onboardingStatus.connectAccountCreated) {
      navigation.navigate('DriverOnboardingResumeScreen');
    } else {
      navigation.navigate('DriverOnboardingScreen');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'WelcomeScreen' }],
            });
          },
        },
      ]
    );
  };

  const handlePikUpPreferences = () => {
    navigation.navigate('DriverPreferencesScreen');
  };

  const handleEarnings = () => {
    if (!onboardingStatus.canReceivePayments) {
      Alert.alert(
        'Complete Setup Required',
        'Please complete your driver onboarding to view earnings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Complete Setup', onPress: handleResumeOnboarding }
        ]
      );
      return;
    }
    navigation.navigate('DriverEarningsScreen');
  };

  const handlePaymentSettings = () => {
    if (!onboardingStatus.connectAccountCreated) {
      Alert.alert(
        'Setup Required',
        'Please complete driver onboarding first to manage payment settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Start Setup', onPress: handleStartOnboarding }
        ]
      );
      return;
    }
    navigation.navigate('DriverPaymentSettingsScreen');
  };

  // Render onboarding status section
  const renderOnboardingStatus = () => {
    if (onboardingStatus.canReceivePayments) {
      // Fully complete - show success banner
      return (
        <View style={styles.statusSection}>
          <View style={styles.statusComplete}>
            <View style={styles.statusLeft}>
              <Ionicons name="checkmark-circle" size={24} color="#00D4AA" />
              <View style={styles.statusText}>
                <Text style={styles.statusTitle}>Ready to Earn!</Text>
                <Text style={styles.statusSubtitle}>Your account is fully setup</Text>
              </View>
            </View>
          </View>
        </View>
      );
    } else if (onboardingStatus.connectAccountCreated) {
      // Partial complete - show resume button
      return (
        <View style={styles.statusSection}>
          <TouchableOpacity style={styles.statusIncomplete} onPress={handleResumeOnboarding}>
            <View style={styles.statusLeft}>
              <Ionicons name="time" size={24} color="#A77BFF" />
              <View style={styles.statusText}>
                <Text style={styles.statusTitle}>Complete Your Setup</Text>
                <Text style={styles.statusSubtitle}>
                  {!onboardingStatus.onboardingComplete 
                    ? 'Finish verification to start earning'
                    : 'Documents pending review'
                  }
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#A77BFF" />
          </TouchableOpacity>
        </View>
      );
    } else {
      // Not started - show start button
      return (
        <View style={styles.statusSection}>
          <TouchableOpacity style={styles.statusNotStarted} onPress={handleStartOnboarding}>
            <View style={styles.statusLeft}>
              <Ionicons name="alert-circle" size={24} color="#FF6B6B" />
              <View style={styles.statusText}>
                <Text style={styles.statusTitle}>Setup Required</Text>
                <Text style={styles.statusSubtitle}>Complete onboarding to start earning</Text>
              </View>
            </View>
            <View style={styles.setupButton}>
              <Text style={styles.setupButtonText}>Start Setup</Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }
  };

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
          <Text style={styles.headerTitle}>Driver Profile</Text>
        </View>

        {/* Onboarding Status - Always at top */}
        {renderOnboardingStatus()}

        {/* Profile Info Section */}
        <View style={styles.profileSection}>
          <View style={styles.nameSection}>
            <Text style={styles.userName}>{displayName}</Text>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('CustomerPersonalInfoScreen')}
            >
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.profileInitials}>
                  <Text style={styles.profileInitialsText}>
                    {displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.ratingSection}>
            <View style={styles.ratingItem}>
              <Ionicons name="star" size={16} color="#00D4AA" />
              <Text style={styles.ratingText}>
                {onboardingStatus.canReceivePayments ? (driverProfile?.rating || '5.0') : '--'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.ratingItem}>
              <Ionicons name="car-outline" size={16} color="#00D4AA" />
              <Text style={styles.ratingText}>PikUp Driver</Text>
            </View>
            <View style={styles.divider} />
            <View style={[
              styles.verifiedBadge, 
              !onboardingStatus.canReceivePayments && styles.verifiedBadgePending
            ]}>
              <Text style={[
                styles.verifiedText,
                !onboardingStatus.canReceivePayments && styles.verifiedTextPending
              ]}>
                {onboardingStatus.canReceivePayments ? 'Verified' : 'Pending'}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.profileSelector}>
            <Text style={styles.profileSelectorText}>Driver</Text>
            <Ionicons name="car" size={16} color="#00D4AA" />
            <Ionicons name="chevron-down" size={20} color="#999" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

        {/* Quick Actions - Driver Specific */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('CustomerHelpScreen')}
          >
            <Ionicons name="help-circle-outline" size={24} color="#00D4AA" />
            <Text style={styles.actionText}>Help</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, !onboardingStatus.canReceivePayments && styles.actionButtonDisabled]}
            onPress={handleEarnings}
          >
            <Ionicons 
              name="wallet-outline" 
              size={24} 
              color={onboardingStatus.canReceivePayments ? "#00D4AA" : "#666"} 
            />
            <Text style={[
              styles.actionText,
              !onboardingStatus.canReceivePayments && styles.actionTextDisabled
            ]}>
              Earnings
            </Text>
          </TouchableOpacity>
        </View>

        {/* DRIVER EARNINGS - Conditional Display */}
        {onboardingStatus.canReceivePayments ? (
          <TouchableOpacity style={styles.earningsSection} onPress={handleEarnings}>
            <View style={styles.earningsContent}>
              <Text style={styles.earningsTitle}>Today's Earnings</Text>
              <Text style={styles.earningsSubtitle}>Complete more trips to increase earnings →</Text>
            </View>
            <View style={styles.earningsIcon}>
              <Ionicons name="cash" size={24} color="#00D4AA" />
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.earningsDisabled} onPress={handleResumeOnboarding}>
            <View style={styles.earningsContent}>
              <Text style={styles.earningsTitle}>Earnings Locked</Text>
              <Text style={styles.earningsSubtitle}>Complete setup to start earning →</Text>
            </View>
            <View style={styles.earningsIconDisabled}>
              <Ionicons name="lock-closed" size={24} color="#666" />
            </View>
          </TouchableOpacity>
        )}

        {/* DRIVER BALANCE - Conditional Display */}
        {onboardingStatus.canReceivePayments ? (
          <TouchableOpacity style={styles.balanceSection} onPress={handleEarnings}>
            <Text style={styles.balanceTitle}>Available Balance</Text>
            <View style={styles.balanceRight}>
              <Text style={styles.balanceAmount}>$247.80</Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.balanceSectionDisabled}>
            <Text style={styles.balanceTitleDisabled}>Available Balance</Text>
            <View style={styles.balanceRight}>
              <Text style={styles.balanceAmountDisabled}>$0.00</Text>
              <Ionicons name="lock-closed" size={16} color="#666" />
            </View>
          </View>
        )}

        {/* DRIVER PROGRESS - Conditional Display */}
        {onboardingStatus.canReceivePayments ? (
          <TouchableOpacity style={styles.progressSection} onPress={handleEarnings}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Weekly Progress</Text>
              <Text style={styles.progressCount}>12/15 trips</Text>
            </View>
            <Text style={styles.progressSubtitle}>3 more trips to reach your weekly goal</Text>
            <View style={styles.progressBar}>
              <View style={styles.progressFill} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.progressSectionDisabled}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitleDisabled}>Weekly Progress</Text>
              <Text style={styles.progressCountDisabled}>--/-- trips</Text>
            </View>
            <Text style={styles.progressSubtitleDisabled}>Complete setup to start tracking progress</Text>
            <View style={styles.progressBarDisabled}>
              <View style={styles.progressFillDisabled} />
            </View>
          </View>
        )}

        {/* DRIVER STATS */}
        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {onboardingStatus.canReceivePayments ? (driverProfile?.rating || '5.0') : '--'}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {onboardingStatus.canReceivePayments ? '156' : '--'}
            </Text>
            <Text style={styles.statLabel}>Total Trips</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {onboardingStatus.canReceivePayments ? '98%' : '--'}
            </Text>
            <Text style={styles.statLabel}>Acceptance</Text>
          </View>
        </View>

        {/* PIKUP PREFERENCES */}
        <TouchableOpacity style={styles.preferencesSection} onPress={handlePikUpPreferences}>
          <View style={styles.preferencesContent}>
            <Text style={styles.preferencesTitle}>PikUp Preferences</Text>
            <Text style={styles.preferencesSubtitle}>Set your pickup types, equipment & availability →</Text>
          </View>
          <View style={styles.preferencesIcon}>
            <Ionicons name="options" size={24} color="#A77BFF" />
          </View>
        </TouchableOpacity>

        {/* Menu Items */}
        <View style={styles.menuSections}>
          <TouchableOpacity style={styles.menuItem} onPress={handlePaymentSettings}>
            <View style={styles.menuItemLeft}>
              <Ionicons 
                name="card-outline" 
                size={20} 
                color={onboardingStatus.connectAccountCreated ? "#00D4AA" : "#666"} 
              />
              <Text style={[
                styles.menuItemTitle,
                !onboardingStatus.connectAccountCreated && styles.menuItemTitleDisabled
              ]}>
                Payment Settings
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => navigation.navigate('CustomerPersonalInfoScreen')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={20} color="#00D4AA" />
              <Text style={styles.menuItemTitle}>Personal Information</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('TermsAndPrivacyScreen')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="document-text-outline" size={20} color="#00D4AA" />
              <Text style={styles.menuItemTitle}>Terms and Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#00D4AA" />
              <Text style={styles.menuItemTitle}>Safety</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('CustomerSettingsScreen')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="settings-outline" size={20} color="#00D4AA" />
              <Text style={styles.menuItemTitle}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('CustomerHelpScreen')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-circle-outline" size={20} color="#00D4AA" />
              <Text style={styles.menuItemTitle}>Help</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1F',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: '#141426',
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
    fontWeight: 'bold',
    marginLeft: 10,
  },
  
  // Onboarding Status Styles
  statusSection: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  statusComplete: {
    backgroundColor: '#0D2818',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A4D2E',
  },
  statusIncomplete: {
    backgroundColor: '#1A1A3A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A5B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusNotStarted: {
    backgroundColor: '#2A1A1A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4A2A2A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    marginLeft: 12,
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  setupButton: {
    backgroundColor: '#A77BFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  setupButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  profileSection: {
    backgroundColor: '#141426',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  nameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textTransform: 'capitalize',
  },
  profileButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A1A3A',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileInitials: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00D4AA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitialsText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  ratingItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 4,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: '#2A2A3B',
    marginHorizontal: 12,
  },
  verifiedBadge: {
    backgroundColor: '#1A3A2E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedBadgePending: {
    backgroundColor: '#3A2A1A',
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00D4AA',
  },
  verifiedTextPending: {
    color: '#FFB366',
  },
  profileSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A3A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  profileSelectorText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginRight: 6,
  },
  quickActions: {
    flexDirection: 'row',
    backgroundColor: '#141426',
    paddingVertical: 20,
    paddingHorizontal: 20,
    justifyContent: 'space-around',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4,
  },
  actionTextDisabled: {
    color: '#666',
  },
  
  // Earnings section - enabled state
  earningsSection: {
    backgroundColor: '#141426',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  // Earnings section - disabled state
  earningsDisabled: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    opacity: 0.7,
  },
  earningsContent: {
    flex: 1,
  },
  earningsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  earningsSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  earningsIcon: {
    width: 50,
    height: 50,
    backgroundColor: '#1A3A2E',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  earningsIconDisabled: {
    width: 50,
    height: 50,
    backgroundColor: '#2A2A2A',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Balance section styles
  balanceSection: {
    backgroundColor: '#141426',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  balanceSectionDisabled: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    opacity: 0.7,
  },
  balanceTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  balanceTitleDisabled: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  balanceRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00D4AA',
    marginRight: 8,
  },
  balanceAmountDisabled: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginRight: 8,
  },
  
  // Progress section styles
  progressSection: {
    backgroundColor: '#141426',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  progressSectionDisabled: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    opacity: 0.7,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  progressTitleDisabled: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  progressCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00D4AA',
  },
  progressCountDisabled: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  progressSubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  progressSubtitleDisabled: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#2A2A3B',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarDisabled: {
    height: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    width: '80%',
    height: '100%',
    backgroundColor: '#00D4AA',
  },
  progressFillDisabled: {
    width: '0%',
    height: '100%',
    backgroundColor: '#666',
  },
  
  statsSection: {
    flexDirection: 'row',
    backgroundColor: '#141426',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2A2A3B',
    marginHorizontal: 15,
  },
  preferencesSection: {
    backgroundColor: '#141426',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  preferencesContent: {
    flex: 1,
  },
  preferencesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  preferencesSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  preferencesIcon: {
    width: 50,
    height: 50,
    backgroundColor: '#1A1A3A',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuSections: {
    backgroundColor: '#141426',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3B',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemTitle: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },
  menuItemTitleDisabled: {
    color: '#666',
  },
  logoutButton: {
    backgroundColor: '#141426',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  logoutText: {
    fontSize: 16,
    color: '#ff4444',
    fontWeight: '500',
  },
  bottomSpacing: {
    height: 40,
  },
});