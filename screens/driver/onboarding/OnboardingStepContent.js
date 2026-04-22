import React from 'react';
import WelcomeVideoStep from './WelcomeVideoStep';
import IdentityVerificationStep from './IdentityVerificationStep';
import PersonalInfoStep from './PersonalInfoStep';
import PaymentSetupStep from './PaymentSetupStep';
import AddressStep from './AddressStep';
import VehicleVerificationStep from './VehicleVerificationStep';

export default function OnboardingStepContent({
  currentStep,
  styles,
  videoRef,
  toggleVideoPlayback,
  handleVideoPlaybackStatus,
  isVideoPlaying,
  videoWatched,
  isIdentityVerificationRejected,
  openSupport,
  openWebsite,
  identityLoading,
  isCheckingVerificationStatus,
  verificationStatus,
  present,
  checkVerificationStatusNow,
  isLoadingVerificationData,
  verificationDataPopulated,
  formData,
  updateFormData,
  formatName,
  formatPhoneNumber,
  formatDateOfBirth,
  handleNext,
  loading,
  isLoadingAddress,
  addressSuggestions,
  searchAddress,
  handleAddressSelect,
  setShowStatePicker,
  showStatePicker,
  statePickerRef,
  closeStatePicker,
  screenHeight,
  formatZipCode,
  carPhotoUris,
  vinPhotoUri,
  vehicleVerificationStatus,
  vehicleVerificationResult,
  vehicleVerificationError,
  takeVinPhoto,
  takeCarPhoto,
  showVinHintAlert,
  showVehiclePhotoHintAlert,
  resetVinPhoto,
  resetCarPhoto,
  handleVerifyVehicle,
  formatYear,
  formatLicensePlate,
}) {
  switch (currentStep) {
    case 0:
      return (
        <WelcomeVideoStep
          styles={styles}
          videoRef={videoRef}
          toggleVideoPlayback={toggleVideoPlayback}
          handleVideoPlaybackStatus={handleVideoPlaybackStatus}
          isVideoPlaying={isVideoPlaying}
          videoWatched={videoWatched}
        />
      );

    case 1:
      return (
        <IdentityVerificationStep
          styles={styles}
          isIdentityVerificationRejected={isIdentityVerificationRejected}
          openSupport={openSupport}
          openWebsite={openWebsite}
          identityLoading={identityLoading}
          isCheckingVerificationStatus={isCheckingVerificationStatus}
          verificationStatus={verificationStatus}
          onStartVerification={() => present()}
          onCheckVerificationStatus={() => checkVerificationStatusNow({ showAlert: false })}
        />
      );

    case 2:
      return (
        <PersonalInfoStep
          styles={styles}
          isLoadingVerificationData={isLoadingVerificationData}
          verificationDataPopulated={verificationDataPopulated}
          formData={formData}
          updateFormData={updateFormData}
          formatName={formatName}
          formatPhoneNumber={formatPhoneNumber}
          formatDateOfBirth={formatDateOfBirth}
        />
      );

    case 3:
      return (
        <AddressStep
          styles={styles}
          verificationDataPopulated={verificationDataPopulated}
          isLoadingVerificationData={isLoadingVerificationData}
          formData={formData}
          isLoadingAddress={isLoadingAddress}
          addressSuggestions={addressSuggestions}
          updateFormData={updateFormData}
          searchAddress={searchAddress}
          handleAddressSelect={handleAddressSelect}
          setShowStatePicker={setShowStatePicker}
          showStatePicker={showStatePicker}
          statePickerRef={statePickerRef}
          closeStatePicker={closeStatePicker}
          screenHeight={screenHeight}
          formatZipCode={formatZipCode}
        />
      );

    case 4:
      return (
        <VehicleVerificationStep
          styles={styles}
          carPhotoUris={carPhotoUris}
          vinPhotoUri={vinPhotoUri}
          vehicleVerificationStatus={vehicleVerificationStatus}
          vehicleVerificationResult={vehicleVerificationResult}
          vehicleVerificationError={vehicleVerificationError}
          formData={formData}
          takeVinPhoto={takeVinPhoto}
          takeCarPhoto={takeCarPhoto}
          showVinHintAlert={showVinHintAlert}
          showVehiclePhotoHintAlert={showVehiclePhotoHintAlert}
          onResetVinPhoto={resetVinPhoto}
          onResetCarPhoto={resetCarPhoto}
          handleVerifyVehicle={handleVerifyVehicle}
          updateFormData={updateFormData}
          formatYear={formatYear}
          formatLicensePlate={formatLicensePlate}
        />
      );

    case 5:
      return (
        <PaymentSetupStep
          styles={styles}
          onConnectStripe={handleNext}
          isConnecting={loading}
        />
      );

    default:
      return null;
  }
}
