// Location Details Step component: renders its UI and handles related interactions.
import React from 'react';
import {
  ScrollView,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppInput from '../ui/AppInput';
import { colors, hitSlopDefault } from '../../styles/theme';
import styles from './LocationDetailsStep.styles';
import { LOCATION_TYPES } from './locationDetails.constants';
import useLocationDetailsStep from './useLocationDetailsStep';

const LocationDetailsStep = ({
  address,
  type,
  details,
  onUpdate,
}) => {
  const {
    isPickup,
    helpKey,
    locationType,
    isStore,
    isApartment,
    hasResidentialFields,
    unitNumberValue,
    helpRequested,
    selfHandled,
    stairsValue,
    canDecreaseStairs,
    canIncreaseStairs,
    updateDetails,
    setLocationType,
    handleUnitFloorChange,
    handleDecreaseStairs,
    handleIncreaseStairs,
    handleStairsTextChange,
    handleStairsBlur,
  } = useLocationDetailsStep({ details, onUpdate, type });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.addressCard}>
        <View style={[styles.addressIcon, isPickup ? styles.pickupIcon : styles.dropoffIcon]}>
          <Ionicons
            name={isPickup ? 'location' : 'navigate'}
            size={20}
            color={colors.text.primary}
          />
        </View>
        <View style={styles.addressInfo}>
          <Text style={styles.addressLabel}>{isPickup ? 'Pickup Address:' : 'Dropoff Address:'}</Text>
          <Text style={styles.addressText} numberOfLines={2}>{address}</Text>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Location Type</Text>
        <View style={styles.locationTypeRow}>
          {LOCATION_TYPES.map((item) => {
            const isActive = locationType === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.locationTypeChip, isActive && styles.locationTypeChipActive]}
                onPress={() => setLocationType(item.id)}
              >
                <Ionicons
                  name={item.icon}
                  size={40}
                  color={isActive ? colors.white : colors.text.muted}
                  style={styles.locationTypeChipIcon}
                />
                <Text
                  style={[styles.locationTypeChipText, isActive && styles.locationTypeChipTextActive]}
                  numberOfLines={2}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {isStore && (
        <>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Store Name *</Text>
            <AppInput
              inputStyle={styles.textInput}
              placeholder="e.g. Home Depot"
              value={details.storeName || ''}
              onChangeText={(text) => updateDetails({ storeName: text })}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Order Confirmation # (Optional)</Text>
            <AppInput
              inputStyle={styles.textInput}
              placeholder="Enter confirmation number"
              value={details.orderConfirmationNumber || ''}
              onChangeText={(text) => updateDetails({ orderConfirmationNumber: text })}
            />
          </View>
        </>
      )}

      {hasResidentialFields && (
        <>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Building Name/Number *</Text>
            <AppInput
              inputStyle={styles.textInput}
              placeholder="Enter building name or number"
              value={details.buildingName || ''}
              onChangeText={(text) => updateDetails({ buildingName: text })}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Unit & Floor *</Text>
            <AppInput
              inputStyle={styles.textInput}
              placeholder="e.g. Apt 4B, Floor 3"
              value={unitNumberValue}
              onChangeText={handleUnitFloorChange}
            />
          </View>

          {isApartment && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Is there a working elevator?</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, details.hasElevator === true && styles.toggleBtnActive]}
                  onPress={() => updateDetails({ hasElevator: true })}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={details.hasElevator === true ? colors.text.primary : colors.text.muted}
                  />
                  <Text style={[styles.toggleText, details.hasElevator === true && styles.toggleTextActive]}>
                    Yes
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toggleBtn, details.hasElevator === false && styles.toggleBtnActive]}
                  onPress={() => updateDetails({ hasElevator: false })}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={details.hasElevator === false ? colors.text.primary : colors.text.muted}
                  />
                  <Text style={[styles.toggleText, details.hasElevator === false && styles.toggleTextActive]}>
                    No
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {isApartment && details.hasElevator === false && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Number of Flights of Stairs</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[styles.stepperBtn, !canDecreaseStairs && styles.stepperBtnDisabled]}
                  onPress={handleDecreaseStairs}
                  hitSlop={hitSlopDefault}
                >
                  <Ionicons
                    name="remove"
                    size={22}
                    color={!canDecreaseStairs ? colors.text.muted : colors.text.primary}
                  />
                </TouchableOpacity>

                <View style={styles.stepperValue}>
                  <RNTextInput
                    style={styles.stepperInput}
                    value={stairsValue === '' ? '' : String(stairsValue)}
                    onChangeText={handleStairsTextChange}
                    onBlur={handleStairsBlur}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                  />
                </View>

                <TouchableOpacity
                  style={[styles.stepperBtn, !canIncreaseStairs && styles.stepperBtnDisabled]}
                  onPress={handleIncreaseStairs}
                  hitSlop={hitSlopDefault}
                >
                  <Ionicons
                    name="add"
                    size={22}
                    color={!canIncreaseStairs ? colors.text.muted : colors.text.primary}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.helpNote}>
                <Ionicons name="information-circle" size={16} color={colors.primary} />
                <Text style={styles.helpNoteText}>
                  This helps us estimate loading/unloading time accurately.
                </Text>
              </View>
            </View>
          )}
        </>
      )}

      {isPickup && (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Driver helps with loading/unloading?</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, helpRequested && styles.toggleBtnActive]}
              onPress={() => updateDetails({ [helpKey]: true })}
            >
              <Ionicons
                name="people"
                size={20}
                color={helpRequested ? colors.text.primary : colors.text.muted}
              />
              <Text style={[styles.toggleText, helpRequested && styles.toggleTextActive]}>
                Yes, please help
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleBtn, selfHandled && styles.toggleBtnActive]}
              onPress={() => updateDetails({ [helpKey]: false })}
            >
              <Ionicons
                name="person"
                size={20}
                color={selfHandled ? colors.text.primary : colors.text.muted}
              />
              <Text style={[styles.toggleText, selfHandled && styles.toggleTextActive]}>
                I'll handle it
              </Text>
            </TouchableOpacity>
          </View>
          {helpRequested && (
            <View style={styles.helpNote}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={styles.helpNoteText}>
                Additional fee may apply for loading/unloading.
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.field}>
        <View style={styles.helpNote}>
          <Ionicons name="time-outline" size={16} color={colors.secondary} />
          <Text style={styles.helpNoteText}>
            Please be at the {isPickup ? 'pickup' : 'dropoff'} location ~5 min before the driver arrives.
          </Text>
        </View>
        {!isPickup && (
          <View style={styles.helpNote}>
            <Ionicons name="information-circle" size={16} color={colors.primary} />
            <Text style={styles.helpNoteText}>
              If you need driver assistance with unloading, please mention it in Additional Notes.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Additional Notes (Optional)</Text>
        <AppInput
          inputStyle={[styles.textInput, styles.textArea]}
          placeholder='e.g., "Park in the rear" or "Fragile glass top"'
          value={details.notes || ''}
          onChangeText={(text) => updateDetails({ notes: text })}
          multiline
          numberOfLines={4}
        />
      </View>
    </ScrollView>
  );
};

export default LocationDetailsStep;
