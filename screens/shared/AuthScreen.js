import React from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuthActions, useAuthIdentity } from "../../contexts/AuthContext";
import AppButton from "../../components/ui/AppButton";
import { colors, layout, spacing } from "../../styles/theme";
import { links } from "../../constants/links";
import styles from "./AuthScreen.styles";
import useAuthScreenData from "./useAuthScreenData";

export default function AuthScreen({ route }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { loading, userType } = useAuthIdentity();
  const { signup, login, signInWithApple, signInWithGoogle } = useAuthActions();

  const userRole = userType || route?.params?.userRole || "customer";
  const isCompact = width < 370;
  const contentMaxWidth = Math.min(layout.authMaxWidth, width - spacing.xl);
  const iconSize = isCompact ? 88 : 100; const logoSize = isCompact ? 52 : 60;

  const {
    confirmPassword,
    confirmPasswordError,
    email,
    emailError,
    firstName,
    handleAppleSignIn,
    handleAuth,
    handleGoogleSignIn,
    handleOpenExternalUrl,
    isLogin,
    lastName,
    nameError,
    password,
    passwordError,
    setConfirmPassword,
    setEmail,
    setFirstName,
    setLastName,
    setPassword,
    setShowConfirmPassword,
    setShowPassword,
    setTermsAccepted,
    showConfirmPassword,
    showPassword,
    termsAccepted,
    termsAcceptedError,
    toggleAuthMode,
  } = useAuthScreenData({
    login,
    signup,
    signInWithApple,
    signInWithGoogle,
    userRole,
  });

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
            enableOnAndroid
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
                    source={require("../../assets/splash-icon.png")}
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

                {!isLogin ? (
                  <View style={styles.nameRow}>
                    <View style={[styles.inputContainer, styles.halfInput]}>
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={colors.text.placeholder}
                        style={styles.inputIcon}
                      />
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
                ) : null}
                {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

                <View style={[styles.inputContainer, emailError ? styles.inputError : null]}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={colors.text.placeholder}
                    style={styles.inputIcon}
                  />
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
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={colors.text.placeholder}
                    style={styles.inputIcon}
                  />
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

                {!isLogin ? (
                  <View style={[styles.inputContainer, confirmPasswordError ? styles.inputError : null]}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={colors.text.placeholder}
                      style={styles.inputIcon}
                    />
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
                ) : null}
                {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}

                <View style={[styles.buttonContainer, isCompact && styles.buttonContainerCompact]}>
                  {!isLogin ? (
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
                            onPress={() => handleOpenExternalUrl(links.terms, "Failed to open Terms of Service.")}
                          >
                            <Text style={styles.termsLink}>Terms of Service</Text>
                          </TouchableOpacity>
                          <Text style={styles.termsText}> & </Text>
                          <TouchableOpacity
                            onPress={() => handleOpenExternalUrl(links.privacy, "Failed to open Privacy Policy.")}
                          >
                            <Text style={styles.termsLink}>Privacy Policy</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                      {termsAcceptedError ? (
                        <Text style={styles.termsAcceptedErrorText}>{termsAcceptedError}</Text>
                      ) : null}
                    </View>
                  ) : null}

                  <AppButton
                    title={isLogin ? "Sign In" : "Sign Up"}
                    style={styles.button}
                    labelStyle={styles.buttonText}
                    onPress={handleAuth}
                    disabled={loading}
                    loading={loading}
                  />

                  {Platform.OS === "ios" ? (
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                      cornerRadius={30}
                      style={styles.appleButton}
                      onPress={handleAppleSignIn}
                    />
                  ) : null}

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
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                  </Text>
                  <TouchableOpacity onPress={toggleAuthMode}>
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
