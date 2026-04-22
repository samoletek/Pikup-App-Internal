import React from "react";
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  useWindowDimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthIdentity, usePaymentActions } from "../../contexts/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppButton from "../../components/ui/AppButton";
import {
  colors,
  layout,
  spacing,
} from "../../styles/theme";
import styles from "./DriverOnboardingScreen.styles";
import {
  formatDateOfBirth,
  formatLicensePlate,
  formatName,
  formatPhoneNumber,
  formatYear,
  formatZipCode,
} from "./DriverOnboardingScreen.utils";
import OnboardingProgressBar from "./onboarding/OnboardingProgressBar";
import OnboardingStepContent from "./onboarding/OnboardingStepContent";
import useDriverOnboardingScreenFlow from "./useDriverOnboardingScreenFlow";

export default function DriverOnboardingScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width, height: screenHeight } = useWindowDimensions();
  const { currentUser, refreshProfile } = useAuthIdentity();
  const {
    updateDriverPaymentProfile,
    createDriverConnectAccount,
    getDriverOnboardingLink,
  } = usePaymentActions();
  const horizontalInset = spacing.xl;
  const safeViewportWidth =
    Number.isFinite(width) && width > horizontalInset
      ? width
      : layout.contentMaxWidth;
  const contentMaxWidth = Math.max(
    320,
    Math.min(layout.contentMaxWidth, safeViewportWidth - horizontalInset)
  );

  const {
    addressSuggestions,
    carPhotoUris,
    closeStatePicker,
    currentStep,
    formData,
    handleAddressSelect,
    handleNext,
    handlePrevious,
    handleVerifyVehicle,
    handleVideoPlaybackStatus,
    identityLoading,
    isCheckingVerificationStatus,
    hasForcedIdentityStepApplied,
    hasForcedPaymentSetupStepApplied,
    isIdentityVerificationRejected,
    isDraftHydrated,
    isLoadingAddress,
    isLoadingVerificationData,
    isNextDisabled,
    isVideoPlaying,
    loading,
    nextButtonLabel,
    openSupport,
    openWebsite,
    present,
    checkVerificationStatusNow,
    progressAnim,
    resetCarPhoto,
    resetVinPhoto,
    screenSteps,
    searchAddress,
    setShowStatePicker,
    showStatePicker,
    showVehiclePhotoHintAlert,
    showVinHintAlert,
    statePickerRef,
    takeCarPhoto,
    takeVinPhoto,
    toggleVideoPlayback,
    updateFormData,
    vehicleVerificationError,
    vehicleVerificationResult,
    vehicleVerificationStatus,
    verificationDataPopulated,
    verificationStatus,
    videoRef,
    videoWatched,
    vinPhotoUri,
  } = useDriverOnboardingScreenFlow({
    navigation,
    route,
    currentUser,
    refreshProfile,
    updateDriverPaymentProfile,
    createDriverConnectAccount,
    getDriverOnboardingLink,
  });
  const isIdentityStepDeclined = currentStep === 1 && isIdentityVerificationRejected;
  const isPaymentSetupStep = currentStep === screenSteps.length - 1;
  const isHydratingDraft =
    !isDraftHydrated ||
    !hasForcedIdentityStepApplied ||
    !hasForcedPaymentSetupStepApplied;
  const handleVerifyAgain = React.useCallback(() => {
    if (identityLoading) {
      return;
    }
    void present();
  }, [identityLoading, present]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topChrome}>
        <View style={[styles.topChromeInner, { maxWidth: contentMaxWidth }]}>
          <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (currentStep > 0) {
                  handlePrevious();
                } else {
                  navigation.goBack();
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {isHydratingDraft ? "Loading setup..." : screenSteps[currentStep].title}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="close" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>

          {!isHydratingDraft ? (
            <OnboardingProgressBar
              styles={styles}
              progressAnim={progressAnim}
              currentStep={currentStep}
              totalSteps={screenSteps.length}
            />
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.contentArea}
        contentContainerStyle={styles.contentAreaInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isHydratingDraft ? (
          <View style={[styles.hydrationContainer, { maxWidth: contentMaxWidth }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.hydrationTitle}>Restoring your setup...</Text>
            <Text style={styles.hydrationSubtitle}>Opening the exact step where you stopped.</Text>
          </View>
        ) : (
          <View style={[styles.stepContainer, { maxWidth: contentMaxWidth }]}>
            {currentStep !== 0 ? (
              <View style={[styles.stepIcon, { backgroundColor: `${screenSteps[currentStep].color}20` }]}>
                <Ionicons
                  name={screenSteps[currentStep].icon}
                  size={32}
                  color={screenSteps[currentStep].color}
                />
              </View>
            ) : null}

            <Text style={styles.stepTitle}>{screenSteps[currentStep].title}</Text>
            <Text style={styles.stepSubtitle}>{screenSteps[currentStep].subtitle}</Text>

            <OnboardingStepContent
              currentStep={currentStep}
              styles={styles}
              videoRef={videoRef}
              toggleVideoPlayback={toggleVideoPlayback}
              handleVideoPlaybackStatus={handleVideoPlaybackStatus}
              isVideoPlaying={isVideoPlaying}
              videoWatched={videoWatched}
              isIdentityVerificationRejected={isIdentityVerificationRejected}
              openSupport={openSupport}
              openWebsite={openWebsite}
              identityLoading={identityLoading}
              isCheckingVerificationStatus={isCheckingVerificationStatus}
              verificationStatus={verificationStatus}
              present={present}
              checkVerificationStatusNow={checkVerificationStatusNow}
              isLoadingVerificationData={isLoadingVerificationData}
              verificationDataPopulated={verificationDataPopulated}
              formData={formData}
              updateFormData={updateFormData}
              formatName={formatName}
              formatPhoneNumber={formatPhoneNumber}
              formatDateOfBirth={formatDateOfBirth}
              handleNext={handleNext}
              loading={loading}
              isLoadingAddress={isLoadingAddress}
              addressSuggestions={addressSuggestions}
              searchAddress={searchAddress}
              handleAddressSelect={handleAddressSelect}
              setShowStatePicker={setShowStatePicker}
              showStatePicker={showStatePicker}
              statePickerRef={statePickerRef}
              closeStatePicker={closeStatePicker}
              screenHeight={screenHeight}
              formatZipCode={formatZipCode}
              carPhotoUris={carPhotoUris}
              vinPhotoUri={vinPhotoUri}
              vehicleVerificationStatus={vehicleVerificationStatus}
              vehicleVerificationResult={vehicleVerificationResult}
              vehicleVerificationError={vehicleVerificationError}
              takeVinPhoto={takeVinPhoto}
              takeCarPhoto={takeCarPhoto}
              showVinHintAlert={showVinHintAlert}
              showVehiclePhotoHintAlert={showVehiclePhotoHintAlert}
              resetVinPhoto={resetVinPhoto}
              resetCarPhoto={resetCarPhoto}
              handleVerifyVehicle={handleVerifyVehicle}
              formatYear={formatYear}
              formatLicensePlate={formatLicensePlate}
            />
          </View>
        )}
      </ScrollView>

      {!isHydratingDraft ? (
        <View
          style={[
            styles.bottomActions,
            {
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxWidth: contentMaxWidth,
              width: "100%",
              alignSelf: "center",
            },
          ]}
        >
          {currentStep > 0 && !isIdentityStepDeclined ? (
            <AppButton
              title="Back"
              variant="secondary"
              style={styles.backActionButton}
              labelStyle={styles.backActionText}
              onPress={handlePrevious}
            />
          ) : null}

          {!isPaymentSetupStep ? (
            <AppButton
              title={nextButtonLabel}
              variant={isIdentityStepDeclined ? "danger" : "primary"}
              style={[
                styles.nextButton,
                (currentStep === 0 || isIdentityStepDeclined) && styles.nextButtonFull,
                isIdentityStepDeclined && styles.nextButtonDeclined,
                !isIdentityStepDeclined && isNextDisabled && styles.nextButtonDisabled,
              ]}
              onPress={isIdentityStepDeclined ? handleVerifyAgain : handleNext}
              disabled={isIdentityStepDeclined ? identityLoading : isNextDisabled}
              loading={isIdentityStepDeclined ? identityLoading : loading}
              labelStyle={styles.nextButtonText}
            />
          ) : null}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
