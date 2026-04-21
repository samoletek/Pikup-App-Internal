// Order Item Card component: renders its UI and handles related interactions.
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Image,
    Alert,
    LayoutAnimation,
    Platform,
    UIManager
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors, hitSlopDefault } from '../../styles/theme';
import AIPhotoPickerModal from '../CustomerOrderModal/AIPhotoPickerModal';
import styles from './OrderItemCard.styles';
import { logger } from '../../services/logger';
// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MAX_PHOTOS = 3;
const VALUE_LIMITS = {
    general: { min: 1, max: 8000 },
    electronics: { min: 1, max: 4000 },
};

const ELECTRONICS_KEYWORDS = [
    'tv', 'television', 'monitor', 'laptop', 'computer', 'desktop', 'tablet',
    'smartphone', 'iphone', 'ipad', 'macbook', 'chromebook',
    'smartwatch', 'apple watch', 'airpods', 'earbuds', 'headphones', 'headset',
    'soundbar', 'home theater', 'streaming device', 'roku', 'fire stick', 'apple tv',
    'smart thermostat', 'smart doorbell', 'security camera', 'smart speaker', 'echo dot',
    'google home', 'google nest', 'ring doorbell',
    'playstation', 'xbox', 'nintendo switch', 'game console', 'vr headset',
    'gopro', 'drone', 'digital camera', 'action cam',
];

const ELECTRONICS_CATEGORIES = [
    'electronics', 'computers', 'phones', 'gaming', 'smart home',
    'audio', 'photography', 'mobile',
];

const isElectronicsItem = (draftItem) => {
    const category = String(draftItem?.category || '').toLowerCase();
    const name = String(draftItem?.name || '').toLowerCase();
    const description = String(draftItem?.description || '').toLowerCase();
    const text = `${name} ${description}`;

    if (ELECTRONICS_CATEGORIES.some((entry) => category.includes(entry))) return true;
    if (ELECTRONICS_KEYWORDS.some((entry) => text.includes(entry))) return true;
    return false;
};

const getItemValueLimits = (draftItem) => (
    isElectronicsItem(draftItem) ? VALUE_LIMITS.electronics : VALUE_LIMITS.general
);

const sanitizeValueInput = (rawInput, maxAllowed) => {
    const sanitized = String(rawInput || '').replace(/[^0-9.]/g, '');
    if (!sanitized) return '';

    const parts = sanitized.split('.');
    const integerPart = parts[0] || '0';
    const fractionalPart = parts.slice(1).join('').slice(0, 2);

    const hasDecimal = parts.length > 1;
    const normalizedValue = hasDecimal
        ? `${integerPart}.${fractionalPart}`
        : integerPart;

    const parsedValue = Number.parseFloat(normalizedValue);
    if (!Number.isFinite(parsedValue)) return '';
    if (parsedValue > maxAllowed) return String(maxAllowed);

    if (hasDecimal && fractionalPart.length === 0) {
        return `${integerPart}.`;
    }

    return normalizedValue;
};

const resolvePreferredAssetRepresentationMode = () => {
    const modes = ImagePicker?.UIImagePickerPreferredAssetRepresentationMode;
    return (
        modes?.Current ||
        modes?.current ||
        modes?.Compatible ||
        modes?.compatible ||
        modes?.Automatic ||
        modes?.automatic ||
        undefined
    );
};

const launchInvoiceLibrary = async () => {
    const preferredAssetRepresentationMode = resolvePreferredAssetRepresentationMode();
    const baseOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        exif: false,
        quality: 0.8,
    };

    if (preferredAssetRepresentationMode) {
        try {
            return await ImagePicker.launchImageLibraryAsync({
                ...baseOptions,
                preferredAssetRepresentationMode,
            });
        } catch (error) {
            logger.warn(
                'OrderItemCard',
                'Invoice image picker failed with preferred representation mode, retrying without it',
                error
            );
        }
    }

    return ImagePicker.launchImageLibraryAsync(baseOptions);
};

const pickInvoiceFromDocumentPicker = async () => {
    const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
        multiple: false,
    });

    if (result?.canceled) {
        return null;
    }

    return result?.assets?.[0]?.uri || null;
};

const OrderItemCard = ({
    item,
    isExpanded,
    onToggleExpand,
    onUpdate,
    onDelete,
    errors,
}) => {
    const [showPhotoPicker, setShowPhotoPicker] = useState(false);

    const normalizedCondition = String(item.condition || '').trim().toLowerCase();
    const remainingSlots = MAX_PHOTOS - item.photos.length;
    const hasPhotoError = !!errors?.photos;
    const isInsuranceActive = normalizedCondition === 'new' && item.hasInsurance;
    const hasEnteredValue = Number.parseFloat(String(item.value || '').trim()) > 0;
    const hasInvoicePhoto = Boolean(item.invoicePhoto);
    const showCoverageInfo = isInsuranceActive && hasEnteredValue && hasInvoicePhoto;
    const valueLimits = getItemValueLimits(item);

    const updateItemDraft = (patch) => {
        onUpdate({ ...item, ...patch });
    };

    const handleValueChange = (rawText) => {
        const nextValue = sanitizeValueInput(rawText, valueLimits.max);
        updateItemDraft({ value: nextValue });
    };

    const handleValueBlur = () => {
        const currentValue = String(item.value || '').trim();
        if (!currentValue) return;

        const parsedValue = Number.parseFloat(currentValue);
        if (!Number.isFinite(parsedValue)) {
            updateItemDraft({ value: '' });
            return;
        }

        const normalizedValue = Math.min(valueLimits.max, Math.max(valueLimits.min, parsedValue));
        if (normalizedValue !== parsedValue) {
            updateItemDraft({ value: String(normalizedValue) });
        }
    };

    const openPhotoPicker = () => {
        if (remainingSlots <= 0) {
            Alert.alert('Limit Reached', `Maximum ${MAX_PHOTOS} photos per item.`);
            return;
        }
        setShowPhotoPicker(true);
    };

    const handlePhotoSelectionDone = (selectedPhotos = []) => {
        const selectedUris = selectedPhotos
            .map(photo => photo?.uri)
            .filter(Boolean)
            .slice(0, MAX_PHOTOS);

        updateItemDraft({ photos: selectedUris });
        setShowPhotoPicker(false);
    };

    const handleRemovePhoto = (index) => {
        const newPhotos = item.photos.filter((_, i) => i !== index);
        updateItemDraft({ photos: newPhotos });
    };

    const handleAddInvoice = async () => {
        let selectedInvoiceUri = null;

        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Photo library permission is required to upload invoice images.');
                return;
            }

            const result = await launchInvoiceLibrary();
            selectedInvoiceUri = result?.assets?.[0]?.uri || null;
        } catch (error) {
            logger.warn('OrderItemCard', 'Invoice image picker failed', error);
        }

        if (!selectedInvoiceUri) {
            try {
                selectedInvoiceUri = await pickInvoiceFromDocumentPicker();
            } catch (fallbackError) {
                logger.warn('OrderItemCard', 'Invoice document picker fallback failed', fallbackError);
            }
        }

        if (!selectedInvoiceUri) {
            Alert.alert('Invoice Upload', 'Failed to pick invoice image. Please try again.');
            return;
        }

        updateItemDraft({ invoicePhoto: selectedInvoiceUri });
    };

    const handleToggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onToggleExpand();
    };

    return (
        <View style={styles.card}>
            {/* Collapsed Header */}
            <View style={styles.cardHeader}>
                <TouchableOpacity
                    style={styles.cardHeaderMain}
                    onPress={handleToggleExpand}
                    activeOpacity={0.85}
                >
                    <View style={styles.cardHeaderLeft}>
                        {item.photos.length > 0 ? (
                            <Image source={{ uri: item.photos[0] }} style={styles.thumbnail} />
                        ) : (
                            <View style={styles.placeholderThumb}>
                                <Ionicons name="cube-outline" size={24} color={colors.text.placeholder} />
                            </View>
                        )}
                        <View style={styles.cardHeaderInfo}>
                            <Text style={styles.itemName} numberOfLines={1}>
                                {item.name || 'Unnamed Item'}
                            </Text>
                            <View style={styles.badges}>
                                {item.isFragile && (
                                    <View style={[styles.badge, styles.badgeFragile]}>
                                        <Text style={styles.badgeText}>Fragile</Text>
                                    </View>
                                )}
                                {isInsuranceActive && (
                                    <View style={[styles.badge, styles.badgeInsured]}>
                                        <Text style={styles.badgeText}>Insured</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
                <View style={styles.cardHeaderActions}>
                    <TouchableOpacity
                        style={styles.headerActionButton}
                        onPress={handleToggleExpand}
                        hitSlop={hitSlopDefault}
                    >
                        <Ionicons name="create-outline" size={22} color={colors.text.muted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerActionButton}
                        onPress={onDelete}
                        hitSlop={hitSlopDefault}
                    >
                        <Ionicons name="trash-outline" size={22} color={colors.error} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Expanded Content */}
            {isExpanded && (
                <View style={styles.cardContent}>
                    {/* Add Photo Button (Top) */}
                    <TouchableOpacity
                        style={[styles.addPhotoBtnTop, hasPhotoError && styles.errorBorder]}
                        onPress={openPhotoPicker}
                    >
                        <Ionicons name="camera" size={24} color={colors.text.primary} />
                        <View style={styles.addPhotoTextWrap}>
                            <Text style={styles.addPhotoBtnTopTitle}>
                                {item.photos.length === 0
                                    ? `Add Photos (up to ${MAX_PHOTOS})`
                                    : `${item.photos.length}/${MAX_PHOTOS} Photos`}
                            </Text>
                            <Text style={styles.addPhotoBtnTopSubtitle}>
                                {remainingSlots > 0
                                    ? `You can select ${remainingSlots} more photo${remainingSlots > 1 ? 's' : ''}`
                                    : 'Photo limit reached'}
                            </Text>
                        </View>
                        <Ionicons name="add-circle" size={24} color={colors.primary} style={styles.addPhotoIconTrailing} />
                    </TouchableOpacity>
                    {hasPhotoError && (
                        <Text style={styles.errorText}>Please add at least one photo.</Text>
                    )}

                    {/* Photo Preview Grid (Moved here) */}
                    {item.photos.length > 0 && (
                        <View style={styles.photoGridTop}>
                            {item.photos.map((uri, index) => (
                                <View key={index} style={styles.photoContainer}>
                                    <Image source={{ uri }} style={styles.photo} />
                                    <TouchableOpacity
                                        style={styles.removePhotoBtn}
                                        onPress={() => handleRemovePhoto(index)}
                                        hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                                    >
                                        <Ionicons name="close-circle" size={30} color={colors.error} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Name Input */}
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Item Name *</Text>
                        <TextInput
                            style={[styles.textInput, errors?.name && styles.errorBorder]}
                            placeholder="e.g. Couch, TV, Moving boxes..."
                            placeholderTextColor={colors.text.placeholder}
                            value={item.name}
                            onChangeText={(text) => updateItemDraft({ name: text })}
                        />
                    </View>

                    {/* Description */}
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Description</Text>
                        <TextInput
                            style={[styles.textInput, styles.textArea]}
                            placeholder="Additional details about this item..."
                            placeholderTextColor={colors.text.placeholder}
                            value={item.description}
                            onChangeText={(text) => updateItemDraft({ description: text })}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    {/* Condition Toggle (New / Used) */}
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Condition *</Text>
                        <View style={[styles.conditionBtnGroup, errors?.condition && styles.errorBorder]}>
                            <TouchableOpacity
                                style={[styles.conditionBtn, normalizedCondition === 'new' && styles.conditionBtnActive]}
                                onPress={() => {
                                    // New = Auto insurance ON (user can toggle off later)
                                    updateItemDraft({ condition: 'new', hasInsurance: true });
                                }}
                            >
                                <Text style={[styles.conditionBtnText, normalizedCondition === 'new' && styles.conditionBtnTextActive]}>New</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.conditionBtn, normalizedCondition === 'used' && styles.conditionBtnActive]}
                                onPress={() => {
                                    // Used = Insurance OFF, Value cleared
                                    updateItemDraft({ condition: 'used', hasInsurance: false, value: '', invoicePhoto: null });
                                }}
                            >
                                <Text style={[styles.conditionBtnText, normalizedCondition === 'used' && styles.conditionBtnTextActive]}>Used</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Value (only for New items) */}
                    {normalizedCondition === 'new' && (
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>Item Value *</Text>
                            <TextInput
                                style={[styles.textInput, errors?.value && styles.errorBorder]}
                                placeholder={`Estimated value in dollars (${valueLimits.min}-${valueLimits.max})`}
                                placeholderTextColor={colors.text.placeholder}
                                value={item.value}
                                onChangeText={handleValueChange}
                                onBlur={handleValueBlur}
                                keyboardType="decimal-pad"
                            />
                        </View>
                    )}

                    {/* Fragile Yes/No */}
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Fragile</Text>
                        <View style={styles.booleanBtnGroup}>
                            <TouchableOpacity
                                style={[styles.booleanBtn, item.isFragile === true && styles.booleanBtnActive]}
                                onPress={() => updateItemDraft({ isFragile: true })}
                            >
                                <Text style={[styles.booleanBtnText, item.isFragile === true && styles.booleanBtnTextActive]}>
                                    Yes
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.booleanBtn, item.isFragile === false && styles.booleanBtnActive]}
                                onPress={() => updateItemDraft({ isFragile: false })}
                            >
                                <Text style={[styles.booleanBtnText, item.isFragile === false && styles.booleanBtnTextActive]}>
                                    No
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Invoice Upload (if insurance is enabled) */}
                    {isInsuranceActive && (
                        <View style={styles.invoiceSection}>
                            <Text style={styles.invoiceLabel}>
                                Upload invoice to confirm item is new
                            </Text>
                            {item.invoicePhoto ? (
                                <View style={styles.invoicePreviewContainer}>
                                    <Image source={{ uri: item.invoicePhoto }} style={[styles.invoiceImage, styles.invoiceImageNoMargin]} />
                                    <TouchableOpacity
                                        style={styles.removePhotoBtn}
                                        onPress={() => updateItemDraft({ invoicePhoto: null })}
                                        hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                                    >
                                        <Ionicons name="close-circle" size={30} color={colors.error} />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity style={styles.uploadInvoiceBtn} onPress={handleAddInvoice}>
                                    <Ionicons name="document-attach-outline" size={24} color={colors.primary} />
                                    <Text style={styles.uploadInvoiceText}>Upload Invoice</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {showCoverageInfo && (
                        <View style={styles.coverageInfoBox}>
                            <View style={styles.coverageInfoHeader}>
                                <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
                                <Text style={styles.coverageInfoTitle}>Full Coverage Applied</Text>
                            </View>
                            <Text style={styles.coverageInfoBody}>
                                This item is fully protected during transit. Coverage is valid for new, store-bought products with a physical or digital receipt.
                            </Text>
                        </View>
                    )}

                </View>
            )}

            <AIPhotoPickerModal
                visible={showPhotoPicker}
                onClose={() => setShowPhotoPicker(false)}
                mode="select"
                title="Item Photos"
                maxPhotos={MAX_PHOTOS}
                initialPhotos={item.photos}
                onConfirm={handlePhotoSelectionDone}
                isAnalyzing={false}
            />
        </View>
    );
};

export default OrderItemCard;
