import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../styles/theme";
import AppButton from "../../../components/ui/AppButton";

const IdentityVerificationStep = ({
  styles,
  isIdentityVerificationRejected,
  openSupport,
  openWebsite,
  identityLoading,
  verificationStatus,
  onStartVerification,
}) => {
  const isCompleted = verificationStatus === "completed";
  const isDisabled = isCompleted || verificationStatus === "failed" || identityLoading;
  const buttonTitle = identityLoading
    ? "Preparing verification..."
    : isCompleted
      ? "Identity verified successfully!"
      : "Start Verification";
  const buttonIcon = identityLoading ? (
    <ActivityIndicator size="small" color={colors.white} />
  ) : isCompleted ? (
    <Ionicons name="checkmark-circle" size={20} color={colors.white} />
  ) : null;

  if (isIdentityVerificationRejected) {
    return (
      <View style={styles.formContent}>
        <View style={styles.verificationRejectedCard}>
          <View style={styles.verificationRejectedHeader}>
            <Ionicons name="close-circle" size={26} color={colors.secondary} />
            <Text style={styles.verificationRejectedTitle}>Verification Failed</Text>
          </View>
          <Text style={styles.verificationRejectedText}>
            Verification was not approved. Please contact our{" "}
            <Text style={styles.verificationRejectedLink} onPress={openSupport}>
              support
            </Text>
            {" "}or visit{" "}
            <Text style={styles.verificationRejectedLink} onPress={openWebsite}>
              pikup-app.com
            </Text>
            .
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.formContent}>
      <View style={styles.verificationFeatures}>
        <View style={styles.verificationItem}>
          <View style={styles.verificationIcon}>
            <Ionicons name="camera-outline" size={24} color={colors.success} />
          </View>
          <View style={styles.verificationContent}>
            <Text style={styles.verificationTitle}>Photo ID</Text>
            <Text style={styles.verificationText}>
              Take a photo of your government-issued ID
            </Text>
          </View>
        </View>

        <View style={styles.verificationItem}>
          <View style={styles.verificationIcon}>
            <Ionicons name="person-circle-outline" size={24} color={colors.success} />
          </View>
          <View style={styles.verificationContent}>
            <Text style={styles.verificationTitle}>Selfie Verification</Text>
            <Text style={styles.verificationText}>
              Take a selfie to match with your ID
            </Text>
          </View>
        </View>

        <View style={styles.verificationItem}>
          <View style={styles.verificationIcon}>
            <Ionicons name="lock-closed-outline" size={24} color={colors.success} />
          </View>
          <View style={styles.verificationContent}>
            <Text style={styles.verificationTitle}>Secure & Private</Text>
            <Text style={styles.verificationText}>
              Your data is encrypted and secure
            </Text>
          </View>
        </View>
      </View>

      <AppButton
        title={buttonTitle}
        onPress={onStartVerification}
        disabled={isDisabled}
        style={[
          styles.verifyButton,
          identityLoading && styles.verifyButtonDisabled,
          isCompleted && styles.verifyButtonSuccess,
        ]}
        labelStyle={styles.verifyButtonText}
        leftIcon={buttonIcon}
      />
    </View>
  );
};

export default IdentityVerificationStep;
