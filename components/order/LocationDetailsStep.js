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

const LocationDetailsStep = ({
    address,
    type, // 'pickup' | 'dropoff'
    details,
    onUpdate
}) => {
    const isPickup = type === 'pickup';
    const helpText = isPickup ? 'Driver helps with loading?' : 'Driver helps with unloading?';
    const helpKey = isPickup ? 'driverHelpsLoading' : 'driverHelpsUnloading';
    const locationType = details.locationType || 'store';
    const isApartment = locationType === 'apartment';

    const getBuildingFieldLabel = () => {
        if (locationType === 'apartment') return 'Apartment/Building name *';
        if (locationType === 'house_other') return 'House or location name *';
        return 'Store name *';
    };

    const setLocationType = (nextType) => {
        onUpdate({
            ...details,
            locationType: nextType,
            hasElevator: nextType === 'apartment' ? details.hasElevator : false,
            unitNumber: nextType === 'apartment' ? details.unitNumber : '',
        });
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Address Display */}
            <View style={styles.addressCard}>
                <View style={[styles.addressIcon, isPickup ? styles.pickupIcon : styles.dropoffIcon]}>
                    <Ionicons
                        name={isPickup ? "location" : "navigate"}
                        size={20}
                        color={colors.text.primary}
                    />
                </View>
                <View style={styles.addressInfo}>
                    <Text style={styles.addressLabel}>{isPickup ? 'Pickup' : 'Dropoff'}</Text>
                    <Text style={styles.addressText} numberOfLines={2}>{address}</Text>
                </View>
            </View>

            {/* Location Type */}
            <View style={styles.field}>
                <Text style={styles.fieldLabel}>Location type</Text>
                <View style={styles.locationTypeRow}>
                    <TouchableOpacity
                        style={[styles.locationTypeChip, locationType === 'store' && styles.locationTypeChipActive]}
                        onPress={() => setLocationType('store')}
                    >
                        <Text style={[styles.locationTypeChipText, locationType === 'store' && styles.locationTypeChipTextActive]}>
                            Store
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.locationTypeChip, locationType === 'apartment' && styles.locationTypeChipActive]}
                        onPress={() => setLocationType('apartment')}
                    >
                        <Text style={[styles.locationTypeChipText, locationType === 'apartment' && styles.locationTypeChipTextActive]}>
                            Apartment
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.locationTypeChip, locationType === 'house_other' && styles.locationTypeChipActive]}
                        onPress={() => setLocationType('house_other')}
                    >
                        <Text style={[styles.locationTypeChipText, locationType === 'house_other' && styles.locationTypeChipTextActive]}>
                            House/Other
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Location Name */}
            <View style={styles.field}>
                <Text style={styles.fieldLabel}>{getBuildingFieldLabel()}</Text>
                <TextInput
                    style={styles.textInput}
                    placeholder={locationType === 'store' ? 'e.g. Walmart' : 'Enter location name'}
                    placeholderTextColor={colors.text.placeholder}
                    value={details.buildingName}
                    onChangeText={(text) => onUpdate({ ...details, buildingName: text })}
                />
            </View>

            {isApartment ? (
                <>
                    {/* Apartment Unit/Floor */}
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Apartment / floor *</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. Apt 4B, Floor 3"
                            placeholderTextColor={colors.text.placeholder}
                            value={details.unitNumber}
                            onChangeText={(text) => onUpdate({ ...details, unitNumber: text })}
                        />
                    </View>

                    {/* Elevator Toggle - Apartments only */}
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Is there a working elevator?</Text>
                        <View style={styles.toggleRow}>
                            <TouchableOpacity
                                style={[styles.toggleBtn, details.hasElevator && styles.toggleBtnActive]}
                                onPress={() => onUpdate({ ...details, hasElevator: true })}
                            >
                                <Ionicons
                                    name="checkmark-circle"
                                    size={20}
                                    color={details.hasElevator ? colors.text.primary : colors.text.muted}
                                />
                                <Text style={[styles.toggleText, details.hasElevator && styles.toggleTextActive]}>
                                    Yes
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.toggleBtn, !details.hasElevator && styles.toggleBtnActive]}
                                onPress={() => onUpdate({ ...details, hasElevator: false })}
                            >
                                <Ionicons
                                    name="close-circle"
                                    size={20}
                                    color={!details.hasElevator ? colors.text.primary : colors.text.muted}
                                />
                                <Text style={[styles.toggleText, !details.hasElevator && styles.toggleTextActive]}>
                                    No
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </>
            ) : (
                <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Meeting point / access details</Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder={isPickup ? 'Where should driver pick up items?' : 'Where should driver drop off items?'}
                        placeholderTextColor={colors.text.placeholder}
                        value={details.meetingPoint}
                        onChangeText={(text) => onUpdate({ ...details, meetingPoint: text })}
                    />
                </View>
            )}

            {/* Driver Help Toggle */}
            <View style={styles.field}>
                <Text style={styles.fieldLabel}>{helpText}</Text>
                <View style={styles.toggleRow}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, details[helpKey] && styles.toggleBtnActive]}
                        onPress={() => onUpdate({ ...details, [helpKey]: true })}
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
                        onPress={() => onUpdate({ ...details, [helpKey]: false })}
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
                            Additional fee may apply for loading/unloading assistance
                        </Text>
                    </View>
                )}
            </View>

            {/* Additional Notes */}
            <View style={styles.field}>
                <Text style={styles.fieldLabel}>Additional Notes (Optional)</Text>
                <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Any special instructions for the driver..."
                    placeholderTextColor={colors.text.placeholder}
                    value={details.notes}
                    onChangeText={(text) => onUpdate({ ...details, notes: text })}
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
        textTransform: 'uppercase',
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
        minHeight: 42,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.input,
    },
    locationTypeChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    locationTypeChipText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
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
    helperText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        marginTop: spacing.xs
    }
});

export default LocationDetailsStep;
