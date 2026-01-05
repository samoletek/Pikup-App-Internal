import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from "../contexts/AuthContext";

export default function ConsentGateScreen({ navigation, route }) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [missingVersions, setMissingVersions] = useState([]);
  
  const { acceptTerms, logout, checkTermsAcceptance, currentUser } = useAuth();
  
  // Get missing versions from route params
  useEffect(() => {
    if (route?.params?.missingVersions) {
      setMissingVersions(route.params.missingVersions);
    }
  }, [route]);

  const handleAccept = async () => {
    if (!termsAccepted) {
      Alert.alert("Error", "Please accept the updated Terms of Service and Privacy Policy");
      return;
    }

    setLoading(true);
    try {
      await acceptTerms(currentUser.uid, false); // Not during signup
      
      // Navigate back to where user was trying to go
      if (route?.params?.returnTo) {
        navigation.navigate(route.params.returnTo);
      } else {
        navigation.navigate(currentUser.userType === 'customer' ? 'CustomerTabs' : 'DriverTabs');
      }
    } catch (error) {
      console.error('Error accepting terms:', error);
      Alert.alert("Error", "Failed to accept terms. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      "Terms Required",
      "You must accept the current Terms of Service and Privacy Policy to continue using Pikup. Would you like to sign out?",
      [
        {
          text: "Review Again",
          style: "default"
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await logout();
            navigation.navigate('WelcomeScreen');
          }
        }
      ]
    );
  };

  const getUpdateMessage = () => {
    const updates = [];
    if (missingVersions.includes('tosVersion')) {
      updates.push('Terms of Service');
    }
    if (missingVersions.includes('privacyVersion')) {
      updates.push('Privacy Policy');
    }
    if (missingVersions.includes('driverAgreementVersion')) {
      updates.push('Driver Agreement');
    }
    
    if (updates.length === 0) {
      return "Please accept our Terms of Service and Privacy Policy to continue.";
    }
    
    return `We've updated our ${updates.join(' and ')}. Please review and accept the changes to continue using Pikup.`;
  };

  return (
    <LinearGradient
      colors={['#0A0A1F', '#141426']}
      style={styles.container}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="document-text-outline" size={80} color="#A77BFF" />
            </View>
            
            <Text style={styles.title}>Updated Terms Required</Text>
            
            <Text style={styles.message}>
              {getUpdateMessage()}
            </Text>

            <View style={styles.termsContainer}>
              <TouchableOpacity 
                style={styles.checkboxContainer}
                onPress={() => setTermsAccepted(!termsAccepted)}
              >
                <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                  {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.termsTextContainer}>
                  <Text style={styles.termsText}>I agree to the updated </Text>
                  <TouchableOpacity 
                    onPress={() => navigation.navigate('TermsAndPrivacyScreen')}
                  >
                    <Text style={styles.termsLink}>Terms of Service & Privacy Policy</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.acceptButton, !termsAccepted && styles.disabledButton]}
                onPress={handleAccept}
                disabled={loading || !termsAccepted}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.acceptButtonText}>Accept & Continue</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.declineButton}
                onPress={handleDecline}
                disabled={loading}
              >
                <Text style={styles.declineButtonText}>I Don't Accept</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.footerText}>
              You must accept these terms to continue using Pikup. Declining will sign you out of the app.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  iconContainer: {
    marginBottom: 30,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  message: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  termsContainer: {
    marginBottom: 40,
    paddingHorizontal: 5,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#A77BFF',
    borderRadius: 4,
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#A77BFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  termsTextContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  termsText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  termsLink: {
    color: '#A77BFF',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 30,
  },
  acceptButton: {
    backgroundColor: '#A77BFF',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#A77BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: '#666',
    shadowOpacity: 0,
    elevation: 0,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  declineButton: {
    borderWidth: 1,
    borderColor: '#666',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 40,
  },
});