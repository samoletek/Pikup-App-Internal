import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../styles/theme";
import AppButton from "../../../components/ui/AppButton";

const PaymentSetupStep = ({ styles, onConnectStripe, isConnecting }) => {
  return (
    <View style={styles.finalContent}>
      <View style={styles.securityFeatures}>
        <View style={styles.securityItem}>
          <Ionicons name="shield-checkmark" size={20} color={colors.success} />
          <Text style={styles.securityText}>Bank-level security</Text>
        </View>
        <View style={styles.securityItem}>
          <Ionicons name="flash" size={20} color={colors.success} />
          <Text style={styles.securityText}>Fast payments</Text>
        </View>
        <View style={styles.securityItem}>
          <Ionicons name="lock-closed" size={20} color={colors.success} />
          <Text style={styles.securityText}>Encrypted data</Text>
        </View>
      </View>

      <View style={styles.finalNote}>
        <Text style={styles.finalNoteText}>
          You'll be redirected to complete a quick verification process. This usually takes 2-3 minutes.
        </Text>
      </View>

      <AppButton
        title={isConnecting ? "Opening Stripe..." : "Connect with Stripe"}
        onPress={onConnectStripe}
        loading={Boolean(isConnecting)}
        disabled={Boolean(isConnecting)}
        style={styles.verifyButton}
        labelStyle={styles.verifyButtonText}
      />
    </View>
  );
};

export default PaymentSetupStep;
