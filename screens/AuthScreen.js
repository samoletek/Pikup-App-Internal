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
import * as AppleAuthentication from 'expo-apple-authentication';

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
    const [nameError, setNameError] = useState("");
    const [termsAcceptedError, setTermsAcceptedError] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const { signup, login, loading, currentUser, userType, checkTermsAcceptance, getDriverProfile, signInWithApple, signInWithGoogle } = useAuth();

    // Get the user role from navigation params or context
    const userRole = userType || route?.params?.userRole || "customer";

    // Debug: Log on every render
    console.log('🔍 AuthScreen render - currentUser:', !!currentUser, 'userType:', userType, 'userRole:', userRole);

    // Validate email format
    const validateEmail = (email) => {
        const re = /\S+@\S+\.\S+/;
        return re.test(email);
    };

    useEffect(() => {
        console.log('AuthScreen useEffect triggered. currentUser:', !!currentUser, 'userType:', userType);
        // If user is logged in, navigate based on role
        if (currentUser && userType) {
            console.log('Attempting to navigate for userType:', userType);
            const checkAndNavigate = async () => {
                try {
                    // Check for terms acceptance first
                    const termsStatus = await checkTermsAcceptance(currentUser.uid);
                    console.log('Terms status:', termsStatus);

                    if (termsStatus.needsAcceptance) {
                        console.log('Navigating to ConsentGate');
                        navigation.navigate('ConsentGate', {
                            missingVersions: termsStatus.missingVersions,
                            role: userType
                        });
                        return; // Stop navigation here
                    }

                    if (userType === "driver") {
                        console.log('User is driver, checking profile...');
                        const driverProfile = await getDriverProfile(currentUser.uid);
                        // Check if onboarding is complete
                        if (driverProfile?.onboardingComplete) {
                            console.log('Navigating to DriverTabs');
                            navigation.replace("DriverTabs");
                        } else {
                            console.log('Navigating to DriverOnboarding');
                            navigation.replace("DriverOnboarding");
                        }
                    } else {
                        // Customer flow
                        console.log('Navigating to CustomerTabs');
                        navigation.replace("CustomerTabs");
                    }
                } catch (error) {
                    console.error("Navigation check error:", error);
                    // Fallback if check fails
                    if (userType === "driver") navigation.replace("DriverTabs");
                    else navigation.replace("CustomerTabs");
                }
            };

            checkAndNavigate();
        }
    }, [currentUser, userType, navigation, checkTermsAcceptance]);


    const handleAppleSignIn = async () => {
        try {
            await signInWithApple(userRole);
        } catch (error) {
            if (error.canceled) return;
            Alert.alert('Sign In Error', error.message);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            await signInWithGoogle(userRole);
        } catch (error) {
            if (error?.canceled) return;
            Alert.alert('Sign In Error', error.message);
        }
    };

    const handleAuth = async () => {
        // Reset all error states before validation
        setEmailError("");
        setPasswordError("");
        setConfirmPasswordError("");
        setNameError("");
        setTermsAcceptedError("");

        let isValid = true;

        // Validate inputs
        if (!email || !validateEmail(email)) {
            setEmailError("Please enter a valid email address");
            isValid = false;
        }

        if (!password || password.length < 6) {
            setPasswordError("Password must be at least 6 characters");
            isValid = false;
        }

        if (!isLogin && password !== confirmPassword) {
            setConfirmPasswordError("Passwords do not match");
            isValid = false;
        }

        if (!isLogin && (!firstName || !lastName)) {
            setNameError("Please enter your full name");
            isValid = false;
        }

        if (!isLogin && !termsAccepted) {
            setTermsAcceptedError("You must accept the Terms and Privacy Policy");
            isValid = false;
        }

        if (!isValid) return;

        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await signup(email, password, userRole, {
                    firstName: firstName,
                    lastName: lastName,
                    name: `${firstName} ${lastName}`
                });
            }
        } catch (error) {
            Alert.alert("Authentication Error", error.message);
        }
    };

    return (
        <LinearGradient
            colors={['#FFFFFF', '#F7F7F7']}
            style={styles.container}
        >
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.container}
                >
                    <KeyboardAwareScrollView
                        contentContainerStyle={styles.scrollContainer}
                        enableOnAndroid={true}
                        extraScrollHeight={20}
                    >
                        <View style={styles.logoContainer}>
                            <View style={styles.iconContainer}>
                                <Image
                                    source={require('../assets/splash-icon.png')}
                                    style={styles.logoImage}
                                    resizeMode="contain"
                                />
                            </View>
                        </View>

                        <View style={styles.formContainer}>
                            <Text style={styles.title}>
                                {isLogin ? "Welcome Back" : "Create Account"}
                            </Text>

                            {!isLogin && (
                                <View style={styles.nameRow}>
                                    <View style={[styles.inputContainer, styles.halfInput]}>
                                        <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                                        <TextInput
                                            style={[styles.input, nameError ? styles.inputError : null]}
                                            placeholder="First Name"
                                            value={firstName}
                                            onChangeText={setFirstName}
                                            autoCapitalize="words"
                                        />
                                    </View>
                                    <View style={[styles.inputContainer, styles.halfInput]}>
                                        <TextInput
                                            style={[styles.input, nameError ? styles.inputError : null]}
                                            placeholder="Last Name"
                                            value={lastName}
                                            onChangeText={setLastName}
                                            autoCapitalize="words"
                                        />
                                    </View>
                                </View>
                            )}
                            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

                            <View style={[styles.inputContainer, emailError ? styles.inputError : null]}>
                                <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Email"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>
                            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

                            <View style={[styles.inputContainer, passwordError ? styles.inputError : null]}>
                                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Password"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeIcon}
                                >
                                    <Ionicons
                                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                                        size={20}
                                        color="#666"
                                    />
                                </TouchableOpacity>
                            </View>
                            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

                            {!isLogin && (
                                <View style={[styles.inputContainer, confirmPasswordError ? styles.inputError : null]}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Confirm Password"
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry={!showConfirmPassword}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                        style={styles.eyeIcon}
                                    >
                                        <Ionicons
                                            name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                                            size={20}
                                            color="#666"
                                        />
                                    </TouchableOpacity>
                                </View>
                            )}
                            {confirmPasswordError ? (
                                <Text style={styles.errorText}>{confirmPasswordError}</Text>
                            ) : null}

                            <View style={styles.buttonContainer}>
                                {!isLogin && (
                                    <View>
                                        <TouchableOpacity
                                            style={styles.termsContainer}
                                            onPress={() => setTermsAccepted(!termsAccepted)}
                                        >
                                            <Ionicons
                                                name={termsAccepted ? "checkbox" : "square-outline"}
                                                size={24}
                                                color={termsAccepted ? "#A77BFF" : "#666"}
                                            />
                                            <View style={styles.termsTextContainer}>
                                                <Text style={styles.termsText}>I accept the </Text>
                                                <TouchableOpacity onPress={() => navigation.navigate('TermsAndPrivacy')}>
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

                                {Platform.OS === 'ios' && (
                                    <AppleAuthentication.AppleAuthenticationButton
                                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                                        cornerRadius={30}
                                        style={styles.appleButton}
                                        onPress={handleAppleSignIn}
                                    />
                                )}

                                <TouchableOpacity
                                    style={styles.googleButton}
                                    onPress={handleGoogleSignIn}
                                    disabled={loading}
                                >
                                    <Ionicons name="logo-google" size={20} color="#333" />
                                    <Text style={styles.googleButtonText}>Sign in with Google</Text>
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
    logoContainer: {
        alignItems: "center",
        marginBottom: 30,
        marginTop: 20,
    },
    iconContainer: {
        width: 100,
        height: 100,
        backgroundColor: 'white',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    logoImage: {
        width: 60,
        height: 60,
    },
    formContainer: {
        width: "100%",
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 30,
        textAlign: "center",
    },
    nameRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    halfInput: {
        width: "48%",
    },
    inputContainer: {
        marginBottom: 15,
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputIcon: {
        position: 'absolute',
        left: 15,
        zIndex: 1,
    },
    input: {
        backgroundColor: "#F0F0F0",
        borderRadius: 30,
        paddingHorizontal: 20,
        paddingVertical: 15,
        paddingLeft: 45,
        fontSize: 16,
        color: "#333",
        width: "100%",
    },
    buttonContainer: {
        marginTop: 20,
        width: "100%",
    },
    button: {
        backgroundColor: "#A77BFF",
        borderRadius: 30,
        paddingVertical: 16,
        alignItems: "center",
        shadowColor: "#A77BFF",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        marginBottom: 20,
    },
    buttonText: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "bold",
    },
    toggleContainer: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 10,
        marginBottom: 30,
    },
    toggleText: {
        color: "#666",
        fontSize: 16,
    },
    toggleLink: {
        color: "#A77BFF",
        fontSize: 16,
        fontWeight: "bold",
    },
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        paddingHorizontal: 10,
    },
    termsTextContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginLeft: 10,
        flex: 1,
    },
    termsText: {
        color: '#666',
        fontSize: 14,
    },
    termsLink: {
        color: '#A77BFF',
        fontSize: 14,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    appleButton: {
        width: '100%',
        height: 50,
        marginBottom: 10,
    },
    googleButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
        paddingVertical: 12,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E0E0E0'
    },
    googleButtonText: {
        color: '#333',
        fontSize: 17,
        fontWeight: '600',
        marginLeft: 10
    }
});
