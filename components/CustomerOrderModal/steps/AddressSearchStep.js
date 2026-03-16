// Address Search Step component: renders its UI and handles related interactions.
import React from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ScrollView,
    ActivityIndicator,
    Platform,
    Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../../styles/theme';
import { styles } from '../styles';
import useAddressSearchStepState, {
    MAX_SCHEDULE_DAYS_AHEAD,
} from './useAddressSearchStepState';

const AddressSearchStep = ({
    orderData,
    setOrderData,
    userLocation,
    recentAddresses,
    saveToRecentAddresses
}) => {
    const {
        pickupSuggestions,
        dropoffSuggestions,
        activeField,
        setActiveField,
        isLoadingSuggestions,
        isLoadingCurrentLocation,
        activePicker,
        minScheduleDate,
        maxScheduleDate,
        parseScheduledDateTime,
        getDatePickerValue,
        handlePlaceSelection,
        handleUseCurrentLocation,
        updateAddressInput,
        clearAddressInput,
        applyScheduledChange,
        setScheduledMode,
        openPicker,
        closePicker,
        handleOutsideTap,
    } = useAddressSearchStepState({
        orderData,
        setOrderData,
        userLocation,
        saveToRecentAddresses,
    });

    // ============================================
    // ADDRESS INPUT RENDER
    // ============================================
    const renderAddressInput = (type) => {
        const isPickup = type === 'pickup';
        const value = isPickup ? orderData.pickup.address : orderData.dropoff.address;
        const suggestions = isPickup ? pickupSuggestions : dropoffSuggestions;
        const hasSearchQuery = value.length >= 2;

        return (
            <View style={{ marginBottom: 16, zIndex: activeField === type ? 10 : 1 }}>
                <View style={styles.inputWrapper}>
                    <View style={[styles.addressMarker, isPickup ? styles.pickupMarker : styles.dropoffMarker]}>
                        <Text style={styles.addressMarkerText}>{isPickup ? 'A' : 'B'}</Text>
                    </View>
                    <TextInput
                        style={styles.input}
                        placeholder={isPickup ? "Pickup Address" : "Dropoff Address"}
                        placeholderTextColor={colors.text.placeholder}
                        value={value}
                        onChangeText={(text) => {
                            updateAddressInput(type, text);
                        }}
                        onFocus={() => setActiveField(type)}
                    />
                    {value.length > 0 && (
                        <TouchableOpacity onPress={() => clearAddressInput(type)}>
                            <Ionicons name="close-circle" size={18} color={colors.text.placeholder} />
                        </TouchableOpacity>
                    )}
                </View>

                {activeField === type && (
                    <View style={styles.suggestionsContainer}>
                        <TouchableOpacity style={styles.suggestionItem} onPress={() => handleUseCurrentLocation(type)}>
                            <View style={[styles.suggestionIcon, { backgroundColor: colors.primary }]}>
                                {isLoadingCurrentLocation ? (
                                    <ActivityIndicator color={colors.text.primary} size="small" />
                                ) : (
                                    <Ionicons name="compass" size={20} color={colors.text.primary} />
                                )}
                            </View>
                            <Text style={styles.suggestionTitle}>Use current location</Text>
                        </TouchableOpacity>

                        {!hasSearchQuery && recentAddresses.length > 0 && (
                            <>
                                <View style={styles.sectionLabelRow}>
                                    <View style={styles.sectionLine} />
                                    <Text style={styles.sectionLabelText}>Recent</Text>
                                    <View style={styles.sectionLine} />
                                </View>
                                {recentAddresses.map((item, index) => (
                                    <TouchableOpacity
                                        key={`recent-${item.id}-${index}`}
                                        style={styles.suggestionItem}
                                        onPress={() => handlePlaceSelection(item, type)}
                                    >
                                        <View style={styles.suggestionIcon}>
                                            <Ionicons name="time-outline" size={20} color={colors.text.primary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.suggestionTitle} numberOfLines={1}>{item.name}</Text>
                                            <Text style={styles.suggestionAddr} numberOfLines={1}>{item.address}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </>
                        )}

                        {isLoadingSuggestions && (
                            <View style={styles.loadingRow}>
                                <ActivityIndicator color={colors.primary} size="small" />
                            </View>
                        )}

                        {suggestions.length > 0 && (
                            <>
                                <View style={styles.sectionLabelRow}>
                                    <View style={styles.sectionLine} />
                                    <Text style={styles.sectionLabelText}>Suggestions</Text>
                                    <View style={styles.sectionLine} />
                                </View>
                                {suggestions.map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={styles.suggestionItem}
                                        onPress={() => handlePlaceSelection(item, type)}
                                    >
                                        <View style={styles.suggestionIcon}>
                                            <Ionicons name="location-outline" size={20} color={colors.text.primary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.suggestionTitle} numberOfLines={1}>{item.name}</Text>
                                            <Text style={styles.suggestionAddr} numberOfLines={1}>{item.address}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </>
                        )}
                    </View>
                )}
            </View>
        );
    };

    // ============================================
    // MAIN RENDER
    // ============================================
    return (
        <TouchableWithoutFeedback onPress={handleOutsideTap}>
            <ScrollView style={styles.stepContent} keyboardShouldPersistTaps="handled">
                {renderAddressInput('pickup')}
                {renderAddressInput('dropoff')}

                {/* Schedule Toggle */}
                <View style={styles.scheduleSection}>
                    <Text style={styles.sectionLabel}>When?</Text>
                    <View style={styles.scheduleToggle}>
                        <TouchableOpacity
                            style={[styles.scheduleOption, orderData.scheduleType === 'asap' && styles.scheduleOptionActive]}
                            onPress={() => {
                                closePicker();
                                setOrderData(prev => ({ ...prev, scheduleType: 'asap', scheduledDateTime: null }));
                            }}
                        >
                            <Ionicons
                                name="flash"
                                size={18}
                                color={orderData.scheduleType === 'asap' ? colors.text.primary : colors.text.muted}
                            />
                            <Text style={[styles.scheduleOptionText, orderData.scheduleType === 'asap' && styles.scheduleOptionTextActive]}>ASAP</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.scheduleOption, orderData.scheduleType === 'scheduled' && styles.scheduleOptionActive]}
                            onPress={setScheduledMode}
                        >
                            <Ionicons
                                name="calendar"
                                size={18}
                                color={orderData.scheduleType === 'scheduled' ? colors.text.primary : colors.text.muted}
                            />
                            <Text style={[styles.scheduleOptionText, orderData.scheduleType === 'scheduled' && styles.scheduleOptionTextActive]}>Schedule</Text>
                        </TouchableOpacity>
                    </View>

                    {orderData.scheduleType === 'scheduled' && (
                        <View style={styles.dateTimeSection}>
                            <View style={styles.scheduleDisclaimer}>
                                <Ionicons name="information-circle-outline" size={16} color={colors.text.muted} style={styles.scheduleDisclaimerIcon} />
                                <Text style={styles.scheduleDisclaimerText}>
                                    Scheduled booking is available up to {MAX_SCHEDULE_DAYS_AHEAD} days in advance.
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.datePickerBtn, styles.datePickerBtnFirst]}
                                onPress={() => openPicker('date')}
                            >
                                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                                <Text style={styles.datePickerText}>
                                    {orderData.scheduledDateTime
                                        ? new Date(orderData.scheduledDateTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                                        : 'Select date'}
                                </Text>
                                <Ionicons name="chevron-forward" size={18} color={colors.text.muted} style={styles.datePickerChevron} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.datePickerBtn}
                                onPress={() => openPicker('time')}
                            >
                                <Ionicons name="time-outline" size={20} color={colors.primary} />
                                <Text style={styles.datePickerText}>
                                    {orderData.scheduledDateTime
                                        ? new Date(orderData.scheduledDateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                                        : 'Select time'}
                                </Text>
                                <Ionicons name="chevron-forward" size={18} color={colors.text.muted} style={styles.datePickerChevron} />
                            </TouchableOpacity>

                            {Platform.OS === 'ios' ? (
                                <>
                                    {activePicker === 'date' && (
                                        <Modal visible transparent animationType="fade" onRequestClose={closePicker}>
                                            <View style={styles.datePickerModal}>
                                                <View style={styles.datePickerModalContent}>
                                                    <View style={styles.datePickerModalHeader}>
                                                        <Text style={styles.datePickerModalTitle}>Select Date</Text>
                                                        <TouchableOpacity onPress={closePicker}>
                                                            <Text style={styles.datePickerDoneText}>Done</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <DateTimePicker
                                                        value={getDatePickerValue()}
                                                        mode="date"
                                                        display="spinner"
                                                        minimumDate={minScheduleDate}
                                                        maximumDate={maxScheduleDate}
                                                        onChange={(event, selectedDate) => {
                                                            if (event?.type === 'set' && selectedDate) {
                                                                applyScheduledChange(selectedDate, 'date');
                                                            }
                                                        }}
                                                        themeVariant="dark"
                                                        style={styles.datePickerControl}
                                                    />
                                                </View>
                                            </View>
                                        </Modal>
                                    )}
                                    {activePicker === 'time' && (
                                        <Modal visible transparent animationType="fade" onRequestClose={closePicker}>
                                            <View style={styles.datePickerModal}>
                                                <View style={styles.datePickerModalContent}>
                                                    <View style={styles.datePickerModalHeader}>
                                                        <Text style={styles.datePickerModalTitle}>Select Time</Text>
                                                        <TouchableOpacity onPress={closePicker}>
                                                            <Text style={styles.datePickerDoneText}>Done</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <DateTimePicker
                                                        value={parseScheduledDateTime()}
                                                        mode="time"
                                                        display="spinner"
                                                        onChange={(event, selectedDate) => {
                                                            if (event?.type === 'set' && selectedDate) {
                                                                applyScheduledChange(selectedDate, 'time');
                                                            }
                                                        }}
                                                        themeVariant="dark"
                                                        style={styles.datePickerControl}
                                                    />
                                                </View>
                                            </View>
                                        </Modal>
                                    )}
                                </>
                            ) : (
                                <>
                                    {activePicker === 'date' && (
                                        <DateTimePicker
                                            value={getDatePickerValue()}
                                            mode="date"
                                            display="calendar"
                                            minimumDate={minScheduleDate}
                                            maximumDate={maxScheduleDate}
                                            onChange={(event, selectedDate) => {
                                                closePicker();
                                                if (event?.type === 'set' && selectedDate) {
                                                    applyScheduledChange(selectedDate, 'date');
                                                }
                                            }}
                                            themeVariant="dark"
                                        />
                                    )}
                                    {activePicker === 'time' && (
                                        <DateTimePicker
                                            value={parseScheduledDateTime()}
                                            mode="time"
                                            display="clock"
                                            onChange={(event, selectedDate) => {
                                                closePicker();
                                                if (event?.type === 'set' && selectedDate) {
                                                    applyScheduledChange(selectedDate, 'time');
                                                }
                                            }}
                                            themeVariant="dark"
                                        />
                                    )}
                                </>
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>
        </TouchableWithoutFeedback>
    );
};

export default AddressSearchStep;
