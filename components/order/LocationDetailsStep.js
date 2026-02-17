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
import { colors, borderRadius, spacing, typography } from '../../styles/theme';

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
    const helpText = isPickup ? 'Driver helps with loading?' : 'Driver helps with unloading?';
    const helpKey = isPickup ? 'driverHelpsLoading' : 'driverHelpsUnloading';
    const locationType = normalizeLocationType(details.locationType);
    const isStore = locationType === 'store';
    const isApartment = locationType === 'apartment';
    const unitNumberValue = details.unitNumber ?? '';
    const floorValue = details.floor ?? '';

    const updateDetails = (patch) => {
        onUpdate({ ...details, ...patch });
    };

    const setLocationType = (nextType) => {
        updateDetails({
            locationType: nextType,
            hasElevator: nextType === 'apartment' ? (details.hasElevator ?? null) : null,
            unitNumber: nextType === 'apartment' ? unitNumberValue : '',
            floor: nextType === 'apartment' ? floorValue : '',
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

            {isApartment && (
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
                        <View style={styles.toggleRow}>
                            <TextInput
                                style={[styles.textInput, { flex: 1 }]}
                                placeholder="e.g. Apt 4B"
                                placeholderTextColor={colors.text.placeholder}
                                value={unitNumberValue}
                                onChangeText={(text) => updateDetails({ unitNumber: text })}
                            />
                            <TextInput
                                style={[styles.textInput, { flex: 1 }]}
                                placeholder="e.g. Floor 3"
                                placeholderTextColor={colors.text.placeholder}
                                value={floorValue}
                                onChangeText={(text) => updateDetails({ floor: text.replace(/[^0-9]/g, '') })}
                                keyboardType="number-pad"
                                maxLength={3}
                            />
                        </View>
                    </View>

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
                </>
            )}

            {/* Static Global Fields */}
            <View style={styles.field}>
                <Text style={styles.fieldLabel}>{helpText}</Text>
                <View style={styles.toggleRow}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, details[helpKey] && styles.toggleBtnActive]}
                        onPress={() => updateDetails({ [helpKey]: true })}
                    >
                        <Ionicons
                            name="people"
                            size={20}
                            color={details[helpKey] ? colors.text.primary : colors.text.muted}
                        />
                        <Text style={[styles.toggleText, details[helpKey] && styles.toggleTextActive]}>
                            Yes, please help
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.toggleBtn, !details[helpKey] && styles.toggleBtnActive]}
                        onPress={() => updateDetails({ [helpKey]: false })}
                    >
                        <Ionicons
                            name="person"
                            size={20}
                            color={!details[helpKey] ? colors.text.primary : colors.text.muted}
                        />
                        <Text style={[styles.toggleText, !details[helpKey] && styles.toggleTextActive]}>
                            I'll handle it
                        </Text>
                    </TouchableOpacity>
                </View>
                {details[helpKey] && (
                    <View style={styles.helpNote}>
                        <Ionicons name="information-circle" size={16} color={colors.primary} />
                        <Text style={styles.helpNoteText}>
                            Additional fee may apply for loading/unloading.
                        </Text>
                    </View>
                )}
                <View style={styles.helpNote}>
                    <Ionicons name="time-outline" size={16} color={colors.secondary} />
                    <Text style={styles.helpNoteText}>
                        Please be at the {isPickup ? 'pickup' : 'dropoff'} location ~5 min before the driver arrives.
                    </Text>
                </View>
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
