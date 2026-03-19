import React from "react";
import {
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

export default function DriverOnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width, height: screenHeight } = useWindowDimensions();
  const { currentUser } = useAuthIdentity();
  const {
    updateDriverPaymentProfile,
    createDriverConnectAccount,
    getDriverOnboardingLink,
  } = usePaymentActions();
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

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
    isIdentityVerificationRejected,
    isLoadingAddress,
    isLoadingVerificationData,
    isNextDisabled,
    isVideoPlaying,
    loading,
    nextButtonLabel,
    openSupport,
    openWebsite,
    present,
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
    currentUser,
    updateDriverPaymentProfile,
    createDriverConnectAccount,
    getDriverOnboardingLink,
  });
  const isIdentityStepDeclined = currentStep === 1 && isIdentityVerificationRejected;
  const handleDeclinedExitToHome = React.useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: "DriverTabs",
          params: {
            screen: "Home",
            params: { showOnboardingDeclinedBanner: true },
          },
        },
      ],
    });
  }, [navigation]);

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
            <Text style={styles.headerTitle}>{screenSteps[currentStep].title}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="close" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>

          <OnboardingProgressBar
            styles={styles}
            progressAnim={progressAnim}
            currentStep={currentStep}
            totalSteps={screenSteps.length}
          />
        </View>
      </View>

      <ScrollView
        style={styles.contentArea}
        contentContainerStyle={styles.contentAreaInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
            verificationStatus={verificationStatus}
            present={present}
            isLoadingVerificationData={isLoadingVerificationData}
            verificationDataPopulated={verificationDataPopulated}
            formData={formData}
            updateFormData={updateFormData}
            formatName={formatName}
            formatPhoneNumber={formatPhoneNumber}
            formatDateOfBirth={formatDateOfBirth}
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
      </ScrollView>

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

        <AppButton
          title={nextButtonLabel}
          variant={isIdentityStepDeclined ? "danger" : "primary"}
          style={[
            styles.nextButton,
            (currentStep === 0 || isIdentityStepDeclined) && styles.nextButtonFull,
            isIdentityStepDeclined && styles.nextButtonDeclined,
            !isIdentityStepDeclined && isNextDisabled && styles.nextButtonDisabled,
          ]}
          onPress={isIdentityStepDeclined ? handleDeclinedExitToHome : handleNext}
          disabled={!isIdentityStepDeclined && isNextDisabled}
          loading={!isIdentityStepDeclined && loading}
          labelStyle={styles.nextButtonText}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
