import React, { useState, useEffect } from "react";
import { Ionicons } from '@expo/vector-icons'; 
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
  Dimensions
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useAuth } from "../contexts/AuthContext";

export default function AuthScreen({ navigation, route }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Error states
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [termsAcceptedError, setTermsAcceptedError] = useState("");

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { signup, login, loading, currentUser, checkTermsAcceptance, getDriverProfile } = useAuth();

  // Get the user role from navigation params
  const userRole = route?.params?.userRole || "customer";

  const screenHeight = Dimensions.get("window").height;

  // Calculate dynamic extraScrollHeight (e.g., 10% of screen height)
  const extraScrollHeight = screenHeight * 0.1;

  // Check terms acceptance after user is set in AuthContext
  useEffect(() => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFirstName("");
    setLastName("");
    setTermsAccepted(false);

    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
    setFirstNameError("");
    setLastNameError("");
    setTermsAcceptedError("");

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
            // Navigate based on user role
            if (userRole === "customer") {
              navigation.navigate("CustomerTabs");
            } else if (userRole === "driver") {
              // Check if driver completed onboarding
              const driverProfile = await getDriverProfile(currentUser.uid);
              if (!driverProfile?.onboardingComplete) {
                navigation.navigate("DriverOnboardingScreen");
              } else {
                navigation.navigate("DriverTabs");
              }
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
  }, [currentUser, userRole, navigation, checkTermsAcceptance, isLogin]);

 
  const handleAuth = async () => {
    // Reset all error states before validation
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
    setFirstNameError("");
    setLastNameError("");
    setTermsAcceptedError("");

    let hasError = false;

    // Validation
    if (!email) {
      setEmailError("Email is required.");
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address.");
      hasError = true;
    }

    if (!password) {
      setPasswordError("Password is required.");
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      hasError = true;
    } else if (!/(?=.*[A-Z])/.test(password)) {
      setPasswordError("Password must contain at least one uppercase letter.");
      hasError = true;
    } else if (!/(?=.*\d)/.test(password)) {
      setPasswordError("Password must contain at least one number.");
      hasError = true;
    } else if (!/(?=.*[@$!%*?&])/.test(password)) {
      setPasswordError("Password must contain at least one special character (e.g., @, $, !, %, *, ?, &).");
      hasError = true;
    }

    if (!isLogin) {
      if (!firstName.trim()) {
        setFirstNameError("First name is required.");
        hasError = true;
      } else if (firstName.trim().length < 2) {
        setFirstNameError("First name must be at least 2 characters.");
        hasError = true;
      } else if (!/^[A-Za-z]+$/.test(firstName.trim())) {
        setFirstNameError("First name must only contain letters.");
        hasError = true;
      }
      
      if (!lastName.trim()) {
        setLastNameError("Last name is required.");
        hasError = true;
      } else if (lastName.trim().length < 2) {
        setLastNameError("Last name must be at least 2 characters.");
        hasError = true;
      } else if (!/^[A-Za-z]+$/.test(lastName.trim())) {
        setLastNameError("Last name must only contain letters.");
        hasError = true;
      }

      if (password !== confirmPassword) {
        setConfirmPasswordError("Passwords do not match.");
        hasError = true;
      }

      if (!termsAccepted) {
        setTermsAcceptedError("Please accept the Terms of Service and Privacy Policy");
        hasError = true;
      }
    }

    if (hasError) {
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
          setEmailError("No account found with this email.");
        } else if (error.message.includes("INVALID_PASSWORD")) {
          setPasswordError("Incorrect password.");
        } else if (error.message.includes("EMAIL_EXISTS")) {
          setEmailError("Email already in use.");
        } else if (error.message.includes("INVALID_EMAIL")) {
          setEmailError("Invalid email address.");
        } else if (error.message.includes("WEAK_PASSWORD")) {
          setPasswordError("Password should be at least 6 characters.");
        } else {
          errorMessage = error.message;
        }
      }
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
          <KeyboardAwareScrollView
            contentContainerStyle={styles.scrollContainer}
            extraScrollHeight={extraScrollHeight} // Adds extra space above the keyboard
            enableOnAndroid={true} // Enables functionality on Android
            keyboardShouldPersistTaps="handled"
          >
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
                      style={[styles.input, firstNameError ? styles.inputError : null]}
                      placeholder="First name"
                      placeholderTextColor="#888"
                      value={firstName}
                      onChangeText={(value) => {
                        setFirstName(value);
                        setFirstNameError("");
                      }}
                      autoCapitalize="words"
                    />
                    {firstNameError ? <Text style={styles.errorText}>{firstNameError}</Text> : null}
                    <TextInput
                      style={[styles.input, lastNameError ? styles.inputError : null]}
                      placeholder="Last name"
                      placeholderTextColor="#888"
                      value={lastName}
                      onChangeText={(value) => {
                        setLastName(value);
                        setLastNameError(""); // Reset last name error
                      }}
                      autoCapitalize="words"
                    />
                    {lastNameError ? <Text style={styles.errorText}>{lastNameError}</Text> : null}
                  </>
                )}

                <TextInput
                 style={[styles.input, emailError ? styles.inputError : null]}
                  placeholder="Email address"
                  placeholderTextColor="#888"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setEmailError(""); 
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.input, passwordError ? styles.inputError : null]}
                  placeholder="Password"
                  placeholderTextColor="#888"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setPasswordError("");
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)} // Toggle state
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"} // Change icon based on state
                    size={24}
                    color="#888"
                  />
                </TouchableOpacity>
                </View>
                {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

                {!isLogin && (
                  <>
                  <View style={{ position: 'relative' }}>
                    <TextInput
                      style={[styles.input, confirmPasswordError ? styles.inputError : null]}
                      placeholder="Confirm password"
                      placeholderTextColor="#888"
                      value={confirmPassword}
                      onChangeText={(value) => {
                        setConfirmPassword(value);
                        setConfirmPasswordError(""); // Reset confirm password error
                      }}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)} // Toggle state
                    >
                      <Ionicons
                        name={showConfirmPassword ? "eye-off" : "eye"} // Change icon based on state
                        size={24}
                        color="#888"
                      />
                    </TouchableOpacity>
                    </View>
                    {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}
                  </>
                )}

                {!isLogin && (
                  <View style={styles.termsContainer}>
                    <TouchableOpacity
                      style={styles.checkboxContainer}
                      onPress={() => { 
                        setTermsAccepted(!termsAccepted);
                        setTermsAcceptedError(""); 
                      }}
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
                    {termsAcceptedError ? (
                      <Text style={styles.termsAcceptedErrorText}>{termsAcceptedError}</Text>
                    ) : null}
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
          </KeyboardAwareScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorText: {
    color: "red",
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 20,
  },
  eyeIcon: {
    position: "absolute",
    right: 30, 
    borderRadius: 30,
    paddingVertical: 16,
  },
  termsAcceptedErrorText: {
    color: "red",
    fontSize: 12,
    marginBottom: 30, 
    marginLeft: 20,
  },
  inputError: {
    borderColor: "red",
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
