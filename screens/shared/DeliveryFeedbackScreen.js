import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthIdentity, useDriverActions, useTripActions } from "../../contexts/AuthContext";
import { usePayment } from "../../contexts/PaymentContext";
import ScreenHeader from "../../components/ScreenHeader";
import AppButton from "../../components/ui/AppButton";
import { DRIVER_RATING_BADGES } from "../../constants/ratingBadges";
import { colors, spacing, layout } from "../../styles/theme";
import styles from "./DeliveryFeedbackScreen.styles";
import useDeliveryFeedbackData from "./useDeliveryFeedbackData";

const RATING_LABELS = ["", "Terrible", "Bad", "Okay", "Good", "Perfect"];
const TIP_PRESETS = [2, 5, 10, 20, 30, 50];

export default function DeliveryFeedbackScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { currentUser } = useAuthIdentity();
  const { getDriverProfile } = useDriverActions();
  const { getRequestById, updateRequestStatus } = useTripActions();
  const { confirmPayment, defaultPaymentMethod, createPaymentIntent } = usePayment();
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);
  const [showCustomTip, setShowCustomTip] = useState(false);

  const {
    comment,
    customTip,
    delivered,
    handleStartClaim,
    handleSubmit,
    loading,
    selectedBadges,
    setComment,
    setCustomTip,
    setRating,
    setTip,
    submitting,
    tip,
    toggleBadge,
    rating,
  } = useDeliveryFeedbackData({
    routeParams: route.params,
    getRequestById,
    updateRequestStatus,
    getDriverProfile,
    currentUser,
    confirmPayment,
    defaultPaymentMethod,
    createPaymentIntent,
    navigation,
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Delivery Feedback"
          onBack={() => navigation.goBack()}
          topInset={insets.top}
          showBack
          />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading delivery details...</Text>
        </View>
      </View>
    );
  }

  const ratingLabel = RATING_LABELS[rating] || "";

  return (
    <View style={styles.container}>
      <ScreenHeader
        title=""
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
          {/* Rating Section */}
          <View style={styles.ratingSection}>
            <Text style={styles.ratingLabel}>{ratingLabel}</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <TouchableOpacity key={value} onPress={() => setRating(value)}>
                  <Ionicons
                    name="star"
                    size={36}
                    color={value <= rating ? colors.gold : colors.border.light}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Tip Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Show your appreciation by adding a tip. 100% of the tip goes to drivers.
            </Text>

            <View style={styles.tipGrid}>
              {TIP_PRESETS.map((tipValue) => (
                <TouchableOpacity
                  key={tipValue}
                  style={[
                    styles.tipBtn,
                    tip === tipValue && !showCustomTip && styles.tipSelected,
                  ]}
                  onPress={() => {
                    setTip(tipValue);
                    setCustomTip("");
                    setShowCustomTip(false);
                  }}
                >
                  <Text
                    style={[
                      styles.tipText,
                      tip === tipValue && !showCustomTip && styles.tipTextSelected,
                    ]}
                  >
                    ${tipValue}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {showCustomTip ? (
              <TextInput
                style={styles.customTipInput}
                placeholder="Enter amount"
                placeholderTextColor={colors.text.placeholder}
                value={customTip}
                onChangeText={(val) => {
                  setCustomTip(val);
                  setTip(null);
                }}
                keyboardType="numeric"
                autoFocus
              />
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setShowCustomTip(true);
                  setTip(null);
                }}
              >
                <Text style={styles.enterOtherAmount}>Enter other amount</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          {/* Badges Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What did you like about the delivery?</Text>
            <View style={styles.badgeGrid}>
              {DRIVER_RATING_BADGES.map((badge) => (
                <TouchableOpacity
                  key={badge.id}
                  style={[
                    styles.badgeChip,
                    selectedBadges.includes(badge.id) && styles.badgeChipSelected,
                  ]}
                  onPress={() => toggleBadge(badge.id)}
                >
                  <Text
                    style={[
                      styles.badgeChipText,
                      selectedBadges.includes(badge.id) && styles.badgeChipTextSelected,
                    ]}
                  >
                    {badge.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Comment Section */}
          <View style={styles.commentSection}>
            <TextInput
              style={styles.commentInput}
              placeholder="Tell us more (Optional)"
              placeholderTextColor={colors.text.placeholder}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Delivery not received */}
          {!delivered ? (
            <AppButton
              title="Start a Claim"
              style={styles.startClaimButton}
              onPress={handleStartClaim}
              labelStyle={styles.startClaimText}
              leftIcon={<Ionicons name="shield-outline" size={20} color={colors.white} />}
            />
          ) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.buttonContainer,
          { paddingBottom: insets.bottom + spacing.base, width: contentMaxWidth },
        ]}
      >
        <AppButton
          title={submitting ? "Processing..." : "Submit"}
          style={[styles.submitBtn, submitting && styles.disabledBtn]}
          onPress={handleSubmit}
          disabled={submitting}
          loading={submitting}
          labelStyle={styles.submitText}
        />
      </View>

    </View>
  );
}
