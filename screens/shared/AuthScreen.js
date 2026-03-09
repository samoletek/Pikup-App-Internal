import React, { useState } from "react";
import { Ionicons } from '@expo/vector-icons';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Image,
    Linking,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useAuth } from "../../contexts/AuthContext";
import * as AppleAuthentication from 'expo-apple-authentication';
import { colors, layout, spacing, typography } from "../../styles/theme";

export default function AuthScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
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

    const { signup, login, loading, userType, signInWithApple, signInWithGoogle } = useAuth();

    // Get the user role from navigation params or context
    const userRole = userType || route?.params?.userRole || "customer";

    const isCompact = width < 370;
    const contentMaxWidth = Math.min(layout.authMaxWidth, width - spacing.xl);
    const iconSize = isCompact ? 88 : 100;
    const logoSize = isCompact ? 52 : 60;
    const termsUrl = "https://pikup-app.com/pikup-app-terms-of-service/";
    const privacyUrl = "https://pikup-app.com/pikup-app-privacy-policy/";

    // Validate email format
    const validateEmail = (email) => {
        const re = /\S+@\S+\.\S+/;
        return re.test(email);
    };

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
                await login(email, password, userRole);
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
            colors={[colors.background.surface, colors.background.light]}
            style={styles.container}
        >
            <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.container}
                >
                    <KeyboardAwareScrollView
                        contentContainerStyle={styles.scrollContainer}
                        enableOnAndroid={true}
                        extraScrollHeight={20}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={[styles.contentWrapper, { maxWidth: contentMaxWidth }]}>
                            <View style={styles.logoContainer}>
                                <View
                                    style={[
                                        styles.iconContainer,
                                        {
                                            width: iconSize,
                                            height: iconSize,
                                            borderRadius: iconSize * 0.2,
                                        },
                                    ]}
                                >
                                    <Image
                                        source={require('../../assets/splash-icon.png')}
                                        style={[
                                            styles.logoImage,
                                            { width: logoSize, height: logoSize },
                                        ]}
                                        resizeMode="contain"
                                    />
                                </View>
                            </View>

                            <View style={styles.formContainer}>
                                <Text style={[styles.title, isCompact && styles.titleCompact]}>
                                    {isLogin ? "Welcome Back" : "Create Account"}
                                </Text>

                                {!isLogin && (
                                    <View style={styles.nameRow}>
                                        <View style={[styles.inputContainer, styles.halfInput]}>
                                            <Ionicons name="person-outline" size={20} color={colors.text.placeholder} style={styles.inputIcon} />
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
                                    <Ionicons name="mail-outline" size={20} color={colors.text.placeholder} style={styles.inputIcon} />
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
                                    <Ionicons name="lock-closed-outline" size={20} color={colors.text.placeholder} style={styles.inputIcon} />
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
                                            color={colors.text.placeholder}
                                        />
                                    </TouchableOpacity>
                                </View>
                                {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

                                {!isLogin && (
                                    <View style={[styles.inputContainer, confirmPasswordError ? styles.inputError : null]}>
                                        <Ionicons name="lock-closed-outline" size={20} color={colors.text.placeholder} style={styles.inputIcon} />
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
                                                color={colors.text.placeholder}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                )}
                                {confirmPasswordError ? (
                                    <Text style={styles.errorText}>{confirmPasswordError}</Text>
                                ) : null}

                                <View style={[styles.buttonContainer, isCompact && styles.buttonContainerCompact]}>
                                    {!isLogin && (
                                        <View>
                                            <TouchableOpacity
                                                style={styles.termsContainer}
                                                onPress={() => setTermsAccepted(!termsAccepted)}
                                            >
                                                <Ionicons
                                                    name={termsAccepted ? "checkbox" : "square-outline"}
                                                    size={24}
                                                    color={termsAccepted ? colors.primary : colors.text.placeholder}
                                                />
                                                <View style={styles.termsTextContainer}>
                                                    <Text style={styles.termsText}>I accept the </Text>
                                                    <TouchableOpacity
                                                        onPress={async () => {
                                                            try {
                                                                const supported = await Linking.canOpenURL(termsUrl);
                                                                if (!supported) {
                                                                    Alert.alert("Error", `Cannot open this link: ${termsUrl}`);
                                                                    return;
                                                                }
                                                                await Linking.openURL(termsUrl);
                                                            } catch (error) {
                                                                Alert.alert("Error", "Failed to open Terms of Service.");
                                                            }
                                                        }}
                                                    >
                                                        <Text style={styles.termsLink}>Terms of Service</Text>
                                                    </TouchableOpacity>
                                                    <Text style={styles.termsText}> & </Text>
                                                    <TouchableOpacity
                                                        onPress={async () => {
                                                            try {
                                                                const supported = await Linking.canOpenURL(privacyUrl);
                                                                if (!supported) {
                                                                    Alert.alert("Error", `Cannot open this link: ${privacyUrl}`);
                                                                    return;
                                                                }
                                                                await Linking.openURL(privacyUrl);
                                                            } catch (error) {
                                                                Alert.alert("Error", "Failed to open Privacy Policy.");
                                                            }
                                                        }}
                                                    >
                                                        <Text style={styles.termsLink}>Privacy Policy</Text>
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
                                        <Ionicons name="logo-google" size={20} color={colors.text.inverse} />
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
                        </View>
                    </KeyboardAwareScrollView>
                </KeyboardAvoidingView>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    errorText: {
        color: colors.error,
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
        color: colors.error,
        fontSize: 12,
        marginBottom: 30,
        marginLeft: 20,
    },
    inputError: {
        borderColor: colors.error,
    },
    scrollContainer: {
        flexGrow: 1,
        paddingHorizontal: spacing.base,
        justifyContent: "center",
    },
    contentWrapper: {
        width: "100%",
        alignSelf: "center",
    },
    logoContainer: {
        alignItems: "center",
        marginBottom: spacing.lg + spacing.xs,
        marginTop: spacing.md,
    },
    iconContainer: {
        backgroundColor: colors.background.surface,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.black,
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
        fontSize: typography.fontSize.xxl + 4,
        fontWeight: typography.fontWeight.bold,
        color: colors.text.inverse,
        marginBottom: spacing.lg + spacing.xs,
        textAlign: "center",
    },
    titleCompact: {
        fontSize: typography.fontSize.xxl,
        marginBottom: spacing.lg,
    },
    nameRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    halfInput: {
        width: "48%",
    },
    inputContainer: {
        marginBottom: spacing.md + 3,
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputIcon: {
        position: 'absolute',
        left: 15,
        zIndex: 1,
    },
    input: {
        backgroundColor: colors.background.inputLight,
        borderRadius: 30,
        paddingHorizontal: spacing.base + spacing.xs,
        paddingVertical: spacing.base - 1,
        paddingLeft: 45,
        fontSize: typography.fontSize.md,
        color: colors.text.inverse,
        width: "100%",
    },
    buttonContainer: {
        marginTop: spacing.base + spacing.xs,
        width: "100%",
    },
    buttonContainerCompact: {
        marginTop: spacing.base,
    },
    button: {
        backgroundColor: colors.primary,
        borderRadius: 30,
        paddingVertical: spacing.base,
        alignItems: "center",
        shadowColor: colors.primary,
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        marginBottom: spacing.base + spacing.xs,
    },
    buttonText: {
        color: colors.text.primary,
        fontSize: 18,
        fontWeight: "bold",
    },
    toggleContainer: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: spacing.sm + 2,
        marginBottom: spacing.lg + spacing.xs,
    },
    toggleText: {
        color: colors.text.placeholder,
        fontSize: 16,
    },
    toggleLink: {
        color: colors.text.link,
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
        color: colors.text.placeholder,
        fontSize: 14,
    },
    termsLink: {
        color: colors.text.link,
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
        backgroundColor: colors.background.surface,
        borderRadius: 30,
        paddingVertical: 12,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        shadowColor: colors.black,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.border.inverse
    },
    googleButtonText: {
        color: colors.text.inverse,
        fontSize: 17,
        fontWeight: '600',
        marginLeft: 10
    }
});
