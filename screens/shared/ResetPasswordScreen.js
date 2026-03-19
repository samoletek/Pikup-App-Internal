import React, { useCallback, useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppButton from "../../components/ui/AppButton";
import AppInput from "../../components/ui/AppInput";
import {
  completePasswordRecovery,
  establishRecoverySession,
  logout as clearRecoverySession,
} from "../../services/AuthService";
import { borderRadius, colors, spacing, typography } from "../../styles/theme";

export default function ResetPasswordScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [isPreparing, setIsPreparing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [linkError, setLinkError] = useState("");

  const handleBackToSignIn = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.popToTop();
      return;
    }
    navigation?.navigate?.("WelcomeScreen");
  }, [navigation]);

  useEffect(() => {
    let active = true;

    const prepareRecoverySession = async () => {
      setIsPreparing(true);
      setLinkError("");
      setRecoveryReady(false);

      try {
        const callbackUrl = await Linking.getInitialURL();
        await establishRecoverySession({
          accessToken: route?.params?.access_token || null,
          refreshToken: route?.params?.refresh_token || null,
          callbackUrl,
        });

        if (!active) return;
        setRecoveryReady(true);
      } catch (error) {
        if (!active) return;
        setLinkError(error?.message || "Unable to validate reset link.");
      } finally {
        if (active) {
          setIsPreparing(false);
        }
      }
    };

    void prepareRecoverySession();
    return () => {
      active = false;
    };
  }, [route?.params?.access_token, route?.params?.refresh_token]);

  const handleSubmit = useCallback(async () => {
    setFormError("");

    if (!password || password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await completePasswordRecovery(password);
      await clearRecoverySession();
      Alert.alert("Password Updated", "Your password was updated. Please sign in again.", [
        { text: "OK", onPress: handleBackToSignIn },
      ]);
    } catch (error) {
      setFormError(error?.message || "Failed to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  }, [confirmPassword, handleBackToSignIn, password]);

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + spacing.xxl,
              paddingBottom: insets.bottom + spacing.xl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Reset Password</Text>

          {isPreparing ? (
            <Text style={styles.helperText}>Verifying your reset link...</Text>
          ) : null}

          {!isPreparing && linkError ? (
            <View style={styles.card}>
              <Text style={styles.errorText}>{linkError}</Text>
              <AppButton title="Back to Sign In" onPress={handleBackToSignIn} />
            </View>
          ) : null}

          {!isPreparing && recoveryReady ? (
            <View style={styles.card}>
              <Text style={styles.helperText}>Enter your new password below.</Text>

              <AppInput
                label="New Password"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setFormError("");
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="newPassword"
                autoCorrect={false}
                rightIcon={
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.text.tertiary}
                  />
                }
                onRightIconPress={() => setShowPassword((prev) => !prev)}
                containerStyle={styles.input}
              />

              <AppInput
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  setFormError("");
                }}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                textContentType="newPassword"
                autoCorrect={false}
                rightIcon={
                  <Ionicons
                    name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.text.tertiary}
                  />
                }
                onRightIconPress={() => setShowConfirmPassword((prev) => !prev)}
                containerStyle={styles.input}
              />

              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              <AppButton
                title="Update Password"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={isSubmitting}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.base,
    justifyContent: "center",
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.base,
  },
  input: {
    marginBottom: spacing.base,
  },
  helperText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.base,
    textAlign: "center",
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.base,
    textAlign: "center",
  },
});
