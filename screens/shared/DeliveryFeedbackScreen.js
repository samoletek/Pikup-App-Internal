import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthIdentity, useDriverActions, useTripActions } from "../../contexts/AuthContext";
import { usePayment } from "../../contexts/PaymentContext";
import DeliveryPhotosModal from "../../components/DeliveryPhotosModal";
import ScreenHeader from "../../components/ScreenHeader";
import AppButton from "../../components/ui/AppButton";
import AppInput from "../../components/ui/AppInput";
import { colors, spacing, layout } from "../../styles/theme";
import styles from "./DeliveryFeedbackScreen.styles";
import useDeliveryFeedbackData from "./useDeliveryFeedbackData";

export default function DeliveryFeedbackScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { currentUser } = useAuthIdentity();
  const { getDriverProfile } = useDriverActions();
  const { getRequestById, updateRequestStatus } = useTripActions();
  const { confirmPayment, defaultPaymentMethod, createPaymentIntent } = usePayment();
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const {
    customTip,
    delivered,
    driverName,
    driverRating,
    handleStartClaim,
    handleSubmit,
    handleViewPhotos,
    loading,
    requestData,
    requestDateLabel,
    setCustomTip,
    setDelivered,
    setRating,
    setShowPhotosModal,
    setTip,
    showPhotosModal,
    submitting,
    tip,
    tripTotal,
    vehicleInfo,
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

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Delivery Feedback"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
          <Text style={styles.title}>Was Your Item Delivered Safely?</Text>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, delivered && styles.activeBtn]}
              onPress={() => setDelivered(true)}
            >
              <Text style={[styles.toggleText, delivered && styles.activeText]}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, !delivered && styles.activeBtn]}
              onPress={() => setDelivered(false)}
            >
              <Text style={[styles.toggleText, !delivered && styles.activeText]}>No</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.driverRow}>
              <View>
                <Text style={styles.driverName}>{driverName}</Text>
                <Text style={styles.vehicle}>{vehicleInfo}</Text>
                <Text style={styles.stars}>★★★★★ {driverRating.toFixed(1)}</Text>
              </View>
              <Image source={require("../../assets/van.png")} style={styles.vehicleImg} />
            </View>

            {requestData ? (
              <TouchableOpacity
                style={styles.viewPhotosButton}
                onPress={handleViewPhotos}
              >
                <Ionicons name="images-outline" size={18} color={colors.primary} />
                <Text style={styles.viewPhotosText}>View Delivery Photos</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Add a tip for {driverName}</Text>
            <Text style={styles.subLabel}>Your Trip was ${tripTotal.toFixed(2)}</Text>

            <View style={styles.tipRow}>
              {[1, 3, 5].map((tipValue) => (
                <TouchableOpacity
                  key={tipValue}
                  style={[styles.tipBtn, tip === tipValue && styles.tipSelected]}
                  onPress={() => {
                    setTip(tipValue);
                    setCustomTip("");
                  }}
                >
                  <Text style={styles.tipText}>${tipValue}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <AppInput
              placeholder="Enter Custom Amount"
              value={customTip}
              onChangeText={(nextValue) => {
                setCustomTip(nextValue);
                setTip(null);
              }}
              keyboardType="numeric"
              inputStyle={styles.tipInput}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Rate Your Trip</Text>
            <Text style={styles.subLabel}>{requestDateLabel}</Text>

            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <TouchableOpacity key={value} onPress={() => setRating(value)}>
                  <Ionicons
                    name="star"
                    size={32}
                    color={value <= rating ? colors.primary : colors.border.light}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

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
          title={submitting ? "Processing..." : "Submit Feedback"}
          style={[styles.submitBtn, submitting && styles.disabledBtn]}
          onPress={handleSubmit}
          disabled={submitting}
          loading={submitting}
          labelStyle={styles.submitText}
        />

        {delivered ? (
          <AppButton
            title="Start a Claim"
            variant="ghost"
            style={styles.claimBtn}
            onPress={handleStartClaim}
            labelStyle={styles.claimText}
          />
        ) : null}
      </View>

      {requestData ? (
        <DeliveryPhotosModal
          visible={showPhotosModal}
          onClose={() => setShowPhotosModal(false)}
          pickupPhotos={requestData.pickupPhotos || []}
          deliveryPhotos={requestData.dropoffPhotos || []}
          requestDetails={requestData}
        />
      ) : null}
    </View>
  );
}
