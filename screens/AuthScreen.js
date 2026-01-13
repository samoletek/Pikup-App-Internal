import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from "../contexts/AuthContext";

export default function AuthScreen({ navigation, route }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const { signup, login, loading, currentUser, checkTermsAcceptance } = useAuth();

  // Get the user role from navigation params
  const userRole = route?.params?.userRole || "customer";

  // Check terms acceptance after user is set in AuthContext
  useEffect(() => {
    if (currentUser) {
      (async () => {
        try {
          const res = await checkTermsAcceptance(currentUser.uid);
          if (res.needsAcceptance) {
            navigation.navigate('ConsentGateScreen', {
              missingVersions: res.missingVersions,
              returnTo: userRole === "customer" ? "CustomerTabs" : "DriverTabs"
            });
          } else {
            // Navigate directly to tabs based on user role
            if (userRole === "customer") {
              navigation.navigate("CustomerTabs");
            } else if (userRole === "driver") {
              navigation.navigate("DriverTabs");
            } else {
              navigation.navigate("RoleSelectionScreen");
            }
          }
        } catch (error) {
          console.error('Error checking terms acceptance:', error);
          // If consent check fails, navigate to consent screen as fallback
          navigation.navigate('ConsentGateScreen', {
            missingVersions: ['tosVersion', 'privacyVersion'],
            returnTo: userRole === "customer" ? "CustomerTabs" : "DriverTabs"
          });
        }
      })();
    }
  }, [currentUser, userRole, navigation, checkTermsAcceptance]);

  const handleAuth = async () => {
    // Validation
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (!isLogin) {
      if (!firstName.trim() || !lastName.trim()) {
        Alert.alert("Error", "Please enter your first and last name.");
        return;
      }
      if (firstName.trim().length < 2) {
        Alert.alert("Error", "First name must be at least 2 characters.");
        return;
      }
      if (lastName.trim().length < 2) {
        Alert.alert("Error", "Last name must be at least 2 characters.");
        return;
      }
    }

    if (!isLogin && password !== confirmPassword) {
      Alert.alert("Error", "Passwords don't match");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    // Terms validation for signup only
    if (!isLogin && !termsAccepted) {
      Alert.alert("Error", "Please accept the Terms of Service and Privacy Policy");
      return;
    }

    try {
      console.log("Starting auth process...");
      console.log("User role:", userRole);

      let result;
      if (isLogin) {
        console.log("Attempting login...");
        result = await login(email, password);
        console.log("Login result:", result);
      } else {
        console.log("Attempting signup...");
        const displayName = `${firstName.trim()} ${lastName.trim()}`;
        result = await signup(email, password, userRole, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          name: displayName,
        });
        console.log("Signup result:", result);
      }

      // Check if authentication was successful
      if (result && result.user) {
        console.log("Authentication successful - user will be set in AuthContext");
        // Navigation will be handled by useEffect when currentUser is set
      } else {
        throw new Error("Authentication failed - no user returned");
      }
    } catch (error) {
      console.error("Auth error:", error);

      let errorMessage = "Authentication failed";

      // Handle Firebase REST API errors
      if (error.message) {
        if (error.message.includes("EMAIL_NOT_FOUND")) {
          errorMessage = "No account found with this email";
        } else if (error.message.includes("INVALID_PASSWORD")) {
          errorMessage = "Incorrect password";
        } else if (error.message.includes("EMAIL_EXISTS")) {
          errorMessage = "Email already in use";
        } else if (error.message.includes("INVALID_EMAIL")) {
          errorMessage = "Invalid email address";
        } else if (error.message.includes("WEAK_PASSWORD")) {
          errorMessage = "Password should be at least 6 characters";
        } else {
          errorMessage = error.message;
        }
      }

      Alert.alert("Error", errorMessage);
    }
  };

  return (
    <LinearGradient
      colors={['#0A0A1F', '#141426']}
      style={styles.container}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.container}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.formSection}>
              <View style={styles.logoContainer}>
                <Image
                  source={require("../assets/pikup-logo.png")}
                  style={styles.logo}
                  accessible
                  accessibilityLabel="PikUp"
                />
              </View>

              <Text style={styles.title}>Welcome</Text>
              <Text style={styles.subtitle}>
                {isLogin ? `Sign in as ${userRole}` : `Create ${userRole} account`}
              </Text>

              <View style={styles.formContainer}>
                {!isLogin && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="First name"
                      placeholderTextColor="#888"
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                    />

                    <TextInput
                      style={styles.input}
                      placeholder="Last name"
                      placeholderTextColor="#888"
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                    />
                  </>
                )}

                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor="#888"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#888"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />

                {!isLogin && (
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm password"
                    placeholderTextColor="#888"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                )}

                {!isLogin && (
                  <View style={styles.termsContainer}>
                    <TouchableOpacity
                      style={styles.checkboxContainer}
                      onPress={() => setTermsAccepted(!termsAccepted)}
                    >
                      <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                        {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View style={styles.termsTextContainer}>
                        <Text style={styles.termsText}>I agree to the </Text>
                        <TouchableOpacity
                          onPress={() => navigation.navigate('TermsAndPrivacyScreen')}
                        >
                          <Text style={styles.termsLink}>Terms of Service & Privacy Policy</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.button}
                  onPress={handleAuth}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>
                    {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.toggleContainer}>
                <Text style={styles.toggleText}>
                  {isLogin
                    ? "Don't have an account? "
                    : "Already have an account? "}
                </Text>
                <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                  <Text style={styles.toggleLink}>
                    {isLogin ? "Sign Up" : "Sign In"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  formSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingVertical: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "rgba(167,123,255,0.6)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  logo: {
    width: 800,
    aspectRatio: 5.08,
    height: undefined,
    resizeMode: "contain",
    alignSelf: "center",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    color: "#ccc",
    fontSize: 14,
    marginBottom: 30,
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
    marginBottom: 30,
  },
  input: {
    backgroundColor: "#1A1A3A",
    borderColor: "#333",
    borderWidth: 1,
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 15,
    color: "#fff",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#A77BFF",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginBottom: 20,
    width: "100%",
    alignItems: "center",
    shadowColor: "#A77BFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  toggleText: {
    color: "#ccc",
    fontSize: 14,
  },
  toggleLink: {
    color: "#A77BFF",
    fontSize: 14,
    fontWeight: "600",
  },
  termsContainer: {
    marginBottom: 20,
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
});
