import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AppButton from '../../../components/ui/AppButton';
import AppInput from '../../../components/ui/AppInput';
import { colors, spacing, typography } from '../../../styles/theme';

const CAR_PHOTO_LABELS = ['Front', 'Side', 'Rear'];
const CAR_PHOTO_ICONS = [
  { name: 'car', size: 32 },
  { name: 'car-side', size: 40 },
  { name: 'car-back', size: 32 },
];

export default function VehicleVerificationStep({
  styles,
  carPhotoUris,
  vinPhotoUri,
  vehicleVerificationStatus,
  vehicleVerificationResult,
  vehicleVerificationError,
  formData,
  takeVinPhoto,
  takeCarPhoto,
  showVinHintAlert,
  showVehiclePhotoHintAlert,
  onResetVinPhoto,
  onResetCarPhoto,
  handleVerifyVehicle,
  updateFormData,
  formatYear,
  formatLicensePlate,
}) {
  const hasAnyCarPhoto = carPhotoUris.some(Boolean);
  const isProcessing = vehicleVerificationStatus === 'uploading' || vehicleVerificationStatus === 'verifying';
  const hasResult = ['approved', 'rejected', 'error'].includes(vehicleVerificationStatus);
  const showFields = hasResult;
  const isLocked = vehicleVerificationStatus === 'approved';
  const canVerify = vehicleVerificationStatus === 'idle' && vinPhotoUri && hasAnyCarPhoto;
  const licensePlateError =
    formData.vehicleInfo.licensePlate.length > 0 && formData.vehicleInfo.licensePlate.length < 2
      ? 'Min 2 characters'
      : '';

  return (
    <View style={styles.formContent}>
      <View style={styles.photoSection}>
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>Step 1: Take a photo of your VIN plate</Text>
          <TouchableOpacity
            style={styles.infoButton}
            onPress={showVinHintAlert}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.text.subtle}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionHint}>
          Find the VIN plate on your driver-side door jamb or dashboard
        </Text>
        <View style={styles.photoSlotWrapper}>
          <TouchableOpacity
            style={[styles.photoCaptureSlot, vinPhotoUri && styles.photoCaptureSlotFilled]}
            onPress={takeVinPhoto}
            disabled={isProcessing}
          >
            {vinPhotoUri ? (
              <Image source={{ uri: vinPhotoUri }} style={styles.photoCapturePreview} />
            ) : (
              <View style={styles.photoCaptureEmpty}>
                <MaterialCommunityIcons name="card-text-outline" size={36} color={colors.text.subtle} />
                <Text style={styles.photoCaptureText}>Tap to take a VIN plate photo</Text>
              </View>
            )}
            {vinPhotoUri && (
              <View style={styles.photoRetakeOverlay}>
                <Ionicons name="camera-reverse-outline" size={16} color={colors.white} />
                <Text style={styles.photoRetakeText}>Retake</Text>
              </View>
            )}
          </TouchableOpacity>
          {vinPhotoUri && !isProcessing && (
            <TouchableOpacity
              style={styles.photoDeleteButton}
              onPress={onResetVinPhoto}
            >
              <Ionicons name="close-circle" size={24} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.photoSection}>
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>Step 2: Take photos of your vehicle</Text>
          <TouchableOpacity
            style={styles.infoButton}
            onPress={showVehiclePhotoHintAlert}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.text.subtle}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionHint}>
          Take photos from different angles for better verification (at least 1 required)
        </Text>
        <View style={styles.carPhotosRow}>
          {CAR_PHOTO_LABELS.map((label, index) => (
            <View key={label} style={styles.carPhotoSlotContainer}>
              <TouchableOpacity
                style={[styles.carPhotoSlot, carPhotoUris[index] && styles.photoCaptureSlotFilled]}
                onPress={() => takeCarPhoto(index)}
                disabled={isProcessing}
              >
                {carPhotoUris[index] ? (
                  <Image source={{ uri: carPhotoUris[index] }} style={styles.photoCapturePreview} />
                ) : (
                  <View style={styles.photoCaptureEmpty}>
                    <MaterialCommunityIcons name={CAR_PHOTO_ICONS[index].name} size={CAR_PHOTO_ICONS[index].size} color={colors.text.subtle} />
                  </View>
                )}
                {carPhotoUris[index] && (
                  <View style={styles.carPhotoRetakeOverlay}>
                    <Ionicons name="camera-reverse-outline" size={12} color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>
              {carPhotoUris[index] && !isProcessing && (
                <TouchableOpacity
                  style={styles.carPhotoDeleteButton}
                  onPress={() => onResetCarPhoto(index)}
                >
                  <Ionicons name="close-circle" size={20} color={colors.error} />
                </TouchableOpacity>
              )}
              <Text style={styles.carPhotoLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {canVerify ? (
        <AppButton
          title="Verify Vehicle"
          onPress={handleVerifyVehicle}
          style={styles.verifyVehicleButton}
          labelStyle={styles.verifyButtonText}
          leftIcon={<Ionicons name="scan-outline" size={20} color={colors.white} />}
        />
      ) : null}

      {isProcessing && (
        <View style={styles.vehicleVerificationLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.vehicleVerificationLoadingText}>
            {vehicleVerificationStatus === 'uploading' ? 'Uploading photos...' : 'Analyzing vehicle...'}
          </Text>
          <Text style={styles.vehicleVerificationSubtext}>This may take a few seconds</Text>
        </View>
      )}

      {vehicleVerificationStatus === 'error' && (
        <View style={styles.vehicleVerificationErrorBanner}>
          <Ionicons name="alert-circle" size={18} color={colors.secondary} />
          <Text style={styles.vehicleVerificationErrorText}>
            {vehicleVerificationError || 'Verification failed'}
          </Text>
          <TouchableOpacity onPress={handleVerifyVehicle}>
            <Text style={styles.retryLink}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {vehicleVerificationStatus === 'approved' && (
        <View style={styles.autoFilledBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.autoFilledText}>
            Vehicle verified! Review the details below.
          </Text>
        </View>
      )}
      {vehicleVerificationStatus === 'rejected' && (
        <View style={[styles.autoFilledBanner, { backgroundColor: `${colors.secondary}15` }]}>
          <Ionicons name="close-circle" size={18} color={colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.autoFilledText, { color: colors.secondary }]}>
              {vehicleVerificationResult?.reason || 'Verification failed.'}
            </Text>
            <Text style={[styles.autoFilledText, { color: colors.text.tertiary, fontSize: typography.fontSize.xs, marginTop: spacing.xs }]}>
              Delete the photos using the X button and retake them to try again.
            </Text>
          </View>
        </View>
      )}

      {showFields && !isProcessing && (
        <>
          <AppInput
            containerStyle={styles.inputContainer}
            label={`VIN${isLocked ? ' (verified)' : ''}`}
            value={formData.vehicleInfo.vin}
            onChangeText={(value) =>
              updateFormData(
                'vehicleInfo.vin',
                value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17)
              )
            }
            placeholder="17-character VIN"
            autoCapitalize="characters"
            maxLength={17}
            editable={!isLocked}
            inputStyle={[styles.textInput, isLocked && styles.lockedInput]}
          />

          <View style={styles.inputRow}>
            <AppInput
              containerStyle={[styles.inputContainer, { flex: 1, marginRight: spacing.sm }]}
              label="Make *"
              value={formData.vehicleInfo.make}
              onChangeText={(value) => updateFormData('vehicleInfo.make', value)}
              placeholder="Toyota"
              autoCapitalize="words"
              editable={!isLocked}
              inputStyle={[styles.textInput, isLocked && styles.lockedInput]}
            />
            <AppInput
              containerStyle={[styles.inputContainer, { flex: 1, marginLeft: spacing.sm }]}
              label="Model *"
              value={formData.vehicleInfo.model}
              onChangeText={(value) => updateFormData('vehicleInfo.model', value)}
              placeholder="Camry"
              autoCapitalize="words"
              editable={!isLocked}
              inputStyle={[styles.textInput, isLocked && styles.lockedInput]}
            />
          </View>

          <View style={styles.inputRow}>
            <AppInput
              containerStyle={[styles.inputContainer, { flex: 1, marginRight: spacing.sm }]}
              label="Year *"
              value={formData.vehicleInfo.year}
              onChangeText={(value) => updateFormData('vehicleInfo.year', formatYear(value))}
              placeholder="2020"
              keyboardType="numeric"
              maxLength={4}
              editable={!isLocked}
              inputStyle={[styles.textInput, isLocked && styles.lockedInput]}
            />
            <AppInput
              containerStyle={[styles.inputContainer, { flex: 1, marginLeft: spacing.sm }]}
              label="Color"
              value={formData.vehicleInfo.color}
              onChangeText={(value) => updateFormData('vehicleInfo.color', value)}
              placeholder="White"
              autoCapitalize="words"
              inputStyle={styles.textInput}
            />
          </View>

          <AppInput
            containerStyle={styles.inputContainer}
            label="License Plate *"
            value={formData.vehicleInfo.licensePlate}
            onChangeText={(value) =>
              updateFormData('vehicleInfo.licensePlate', formatLicensePlate(value))
            }
            placeholder="ABC123"
            autoCapitalize="characters"
            maxLength={8}
            inputStyle={styles.textInput}
            error={licensePlateError}
          />
        </>
      )}

      {vehicleVerificationStatus === 'idle' && !canVerify && (
        <View style={styles.manualEntryNote}>
          <Ionicons name="information-circle-outline" size={16} color={colors.text.tertiary} />
          <Text style={styles.manualEntryNoteText}>
            {!vinPhotoUri && !hasAnyCarPhoto
              ? 'Take a VIN plate photo and at least one vehicle photo to proceed.'
              : !vinPhotoUri
                ? 'Now take a photo of your VIN plate to verify.'
                : 'Now take at least one vehicle photo to verify.'}
          </Text>
        </View>
      )}
    </View>
  );
}
