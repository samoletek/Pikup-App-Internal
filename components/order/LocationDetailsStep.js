import React from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, typography, sizing, hitSlopDefault } from '../../styles/theme';

const STEPPER_VALUE_MIN_WIDTH = 56;
const STEPPER_INPUT_MIN_WIDTH = 48;

const LOCATION_TYPES = [
    { id: 'store', label: 'Store' },
    { id: 'apartment', label: 'Apartment/Condo' },
    { id: 'residential_other', label: 'Residential/Other' },
];

const normalizeLocationType = (value) => {
    if (value === 'house_other') {
        return 'residential_other';
    }

    return value || 'store';
};

const LocationDetailsStep = ({
    address,
    type, // 'pickup' | 'dropoff'
    details,
    onUpdate
}) => {
    const isPickup = type === 'pickup';
    const helpKey = isPickup ? 'driverHelpsLoading' : 'driverHelpsUnloading';
    const locationType = normalizeLocationType(details.locationType);
    const isStore = locationType === 'store';
    const isApartment = locationType === 'apartment';
    const hasResidentialFields = isApartment;
    const unitNumberValue = details.unitNumber ?? '';
    const helpRequested = details[helpKey] === true;
    const selfHandled = details[helpKey] === false;

    const updateDetails = (patch) => {
        onUpdate({ ...details, ...patch });
    };

    const setLocationType = (nextType) => {
        updateDetails({
            locationType: nextType,
            hasElevator: nextType === 'apartment' ? (details.hasElevator ?? null) : null,
            unitNumber: nextType === 'apartment' ? unitNumberValue : '',
            floor: nextType === 'apartment' ? (details.floor ?? '') : '',
        });
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Address Display */}
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

            {/* Location Type */}
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

            {/* Dynamic Input Area */}
            {isStore && (
                <>
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Store Name *</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. Home Depot"
                            placeholderTextColor={colors.text.placeholder}
                            value={details.storeName || ''}
                            onChangeText={(text) => updateDetails({ storeName: text })}
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Building Name/Number *</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Enter building name or number"
                            placeholderTextColor={colors.text.placeholder}
                            value={details.buildingName || ''}
                            onChangeText={(text) => updateDetails({ buildingName: text })}
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Unit/Suite Number *</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. Suite 200"
                            placeholderTextColor={colors.text.placeholder}
                            value={details.unitNumber || ''}
                            onChangeText={(text) => updateDetails({ unitNumber: text })}
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Order Confirmation # (Optional)</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Enter confirmation number"
                            placeholderTextColor={colors.text.placeholder}
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
                        <TextInput
                            style={styles.textInput}
                            placeholder="Enter building name or number"
                            placeholderTextColor={colors.text.placeholder}
                            value={details.buildingName || ''}
                            onChangeText={(text) => updateDetails({ buildingName: text })}
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Unit & Floor *</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. Apt 4B, Floor 3"
                            placeholderTextColor={colors.text.placeholder}
                            value={unitNumberValue}
                            onChangeText={(text) => {
                                const patch = { unitNumber: text };
                                const floorMatch = text.match(/(?:floor|fl\.?|flr\.?)\s*(\d{1,3})/i);
                                if (floorMatch) {
                                    patch.floor = floorMatch[1];
                                }
                                updateDetails(patch);
                            }}
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
                                    style={[styles.stepperBtn, (details.numberOfStairs || 1) <= 1 && styles.stepperBtnDisabled]}
                                    onPress={() => {
                                        const current = details.numberOfStairs || 1;
                                        if (current > 1) updateDetails({ numberOfStairs: current - 1 });
                                    }}
                                    hitSlop={hitSlopDefault}
                                >
                                    <Ionicons
                                        name="remove"
                                        size={22}
                                        color={(details.numberOfStairs || 1) <= 1 ? colors.text.muted : colors.text.primary}
                                    />
                                </TouchableOpacity>

                                <View style={styles.stepperValue}>
                                    <TextInput
                                        style={styles.stepperInput}
                                        value={details.numberOfStairs === '' ? '' : String(details.numberOfStairs || 1)}
                                        onChangeText={(text) => {
                                            const clean = text.replace(/[^0-9]/g, '');
                                            if (clean === '') {
                                                updateDetails({ numberOfStairs: '' });
                                            } else {
                                                const num = parseInt(clean, 10);
                                                if (num <= 50) {
                                                    updateDetails({ numberOfStairs: num });
                                                }
                                            }
                                        }}
                                        onBlur={() => {
                                            const val = parseInt(details.numberOfStairs, 10);
                                            if (!val || val < 1) {
                                                updateDetails({ numberOfStairs: 1 });
                                            }
                                        }}
                                        keyboardType="number-pad"
                                        maxLength={2}
                                        selectTextOnFocus
                                    />
                                </View>

                                <TouchableOpacity
                                    style={[styles.stepperBtn, (details.numberOfStairs || 1) >= 50 && styles.stepperBtnDisabled]}
                                    onPress={() => {
                                        const current = details.numberOfStairs || 1;
                                        if (current < 50) updateDetails({ numberOfStairs: current + 1 });
                                    }}
                                    hitSlop={hitSlopDefault}
                                >
                                    <Ionicons
                                        name="add"
                                        size={22}
                                        color={(details.numberOfStairs || 1) >= 50 ? colors.text.muted : colors.text.primary}
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

            {/* Driver help — global question, only on pickup */}
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

            {/* Reminders */}
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
                <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder='e.g., "Park in the rear" or "Fragile glass top"'
                    placeholderTextColor={colors.text.placeholder}
                    value={details.notes || ''}
                    onChangeText={(text) => updateDetails({ notes: text })}
                    multiline
                    numberOfLines={4}
                />
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg
    },
    addressCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        marginBottom: spacing.xl
    },
    addressIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center'
    },
    pickupIcon: {
        backgroundColor: colors.primary
    },
    dropoffIcon: {
        backgroundColor: colors.success
    },
    addressInfo: {
        marginLeft: spacing.md,
        flex: 1
    },
    addressLabel: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        marginBottom: spacing.xs
    },
    addressText: {
        color: colors.text.primary,
        fontSize: typography.fontSize.base
    },
    field: {
        marginBottom: spacing.xl
    },
locationTypeRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    locationTypeChip: {
        flex: 1,
        minHeight: 44,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.input,
        paddingHorizontal: spacing.xs,
    },
    locationTypeChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    locationTypeChipText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        textAlign: 'center',
        lineHeight: 16,
    },
    locationTypeChipTextActive: {
        color: colors.white,
    },
    fieldLabel: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: typography.fontWeight.semibold,
        marginBottom: spacing.md
    },
    textInput: {
        backgroundColor: colors.background.input,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        padding: 14
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top'
    },
    toggleRow: {
        flexDirection: 'row',
        gap: spacing.sm
    },
    toggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.input,
        borderRadius: borderRadius.md,
        paddingVertical: 14
    },
    toggleBtnActive: {
        backgroundColor: colors.primary
    },
    toggleText: {
        color: colors.text.muted,
        fontWeight: typography.fontWeight.semibold,
        marginLeft: spacing.sm
    },
    toggleTextActive: {
        color: colors.white
    },
    stepperRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.lg,
    },
    stepperBtn: {
        width: sizing.touchTargetMin,
        height: sizing.touchTargetMin,
        borderRadius: sizing.touchTargetMin / 2,
        backgroundColor: colors.background.input,
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperBtnDisabled: {
        opacity: 0.4,
    },
    stepperValue: {
        minWidth: STEPPER_VALUE_MIN_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperInput: {
        color: colors.text.primary,
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        textAlign: 'center',
        minWidth: STEPPER_INPUT_MIN_WIDTH,
        paddingVertical: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    helpNote: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        paddingHorizontal: spacing.xs
    },
    helpNoteText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        marginLeft: spacing.sm,
        flex: 1
    },
});

export default LocationDetailsStep;
