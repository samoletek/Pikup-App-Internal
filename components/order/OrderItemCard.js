import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Image,
    Alert,
    LayoutAnimation,
    Platform,
    UIManager
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, borderRadius, spacing, typography, hitSlopDefault } from '../../styles/theme';
import AIPhotoPickerModal from '../CustomerOrderModal/AIPhotoPickerModal';
// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MAX_PHOTOS = 3;

const OrderItemCard = ({
    item,
    isExpanded,
    onToggleExpand,
    onUpdate,
    onDelete,
    errors,
}) => {
    const [showPhotoPicker, setShowPhotoPicker] = useState(false);

    const remainingSlots = MAX_PHOTOS - item.photos.length;
    const hasPhotoError = !!errors?.photos;

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

        onUpdate({ ...item, photos: selectedUris });
        setShowPhotoPicker(false);
    };

    const handleRemovePhoto = (index) => {
        const newPhotos = item.photos.filter((_, i) => i !== index);
        onUpdate({ ...item, photos: newPhotos });
    };

    const handleAddInvoice = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.8
        });

        if (!result.canceled && result.assets[0]) {
            onUpdate({ ...item, invoicePhoto: result.assets[0].uri });
        }
    };

    const handleToggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onToggleExpand();
    };

    return (
        <View style={styles.card}>
            {/* Collapsed Header */}
            <TouchableOpacity style={styles.cardHeader} onPress={handleToggleExpand}>
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
                            {item.hasInsurance && (
                                <View style={[styles.badge, styles.badgeInsured]}>
                                    <Text style={styles.badgeText}>Insured</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
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
                        onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
                        hitSlop={hitSlopDefault}
                    >
                        <Ionicons name="trash-outline" size={22} color={colors.error} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>

            {/* Expanded Content */}
            {isExpanded && (
                <View style={styles.cardContent}>
                    {/* Add Photo Button (Top) */}
                    <TouchableOpacity
                        style={[styles.addPhotoBtnTop, hasPhotoError && styles.errorBorder]}
                        onPress={openPhotoPicker}
                    >
                        <Ionicons name="camera" size={24} color={colors.text.primary} />
                        <View style={{ marginLeft: 12 }}>
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
                        <Ionicons name="add-circle" size={24} color={colors.primary} style={{ marginLeft: 'auto' }} />
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
                                    >
                                        <View style={styles.removePhotoIconBg}>
                                            <Ionicons name="close" size={14} color={colors.text.primary} />
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Name Input */}
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Item Name *</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. Couch, TV, Moving boxes..."
                            placeholderTextColor={colors.text.placeholder}
                            value={item.name}
                            onChangeText={(text) => onUpdate({ ...item, name: text })}
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
                            onChangeText={(text) => onUpdate({ ...item, description: text })}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    {/* Condition Toggle (New / Used) */}
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Condition *</Text>
                        <View style={[styles.conditionBtnGroup, errors?.condition && styles.errorBorder]}>
                            <TouchableOpacity
                                style={[styles.conditionBtn, item.condition === 'new' && styles.conditionBtnActive]}
                                onPress={() => {
                                    // New = Auto insurance ON (user can toggle off later)
                                    onUpdate({ ...item, condition: 'new', hasInsurance: true });
                                }}
                            >
                                <Text style={[styles.conditionBtnText, item.condition === 'new' && styles.conditionBtnTextActive]}>New</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.conditionBtn, item.condition === 'used' && styles.conditionBtnActive]}
                                onPress={() => {
                                    // Used = Insurance OFF, Value cleared
                                    onUpdate({ ...item, condition: 'used', hasInsurance: false, value: '' });
                                }}
                            >
                                <Text style={[styles.conditionBtnText, item.condition === 'used' && styles.conditionBtnTextActive]}>Used</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Value (only for New items) */}
                    {item.condition === 'new' && (
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>Item Value *</Text>
                            <TextInput
                                style={[styles.textInput, errors?.value && styles.errorBorder]}
                                placeholder="Estimated value in dollars"
                                placeholderTextColor={colors.text.placeholder}
                                value={item.value}
                                onChangeText={(text) => onUpdate({ ...item, value: text.replace(/[^0-9.]/g, '') })}
                                keyboardType="decimal-pad"
                            />
                        </View>
                    )}

                    {/* Toggles */}
                    <View style={styles.toggleRow}>
                        <TouchableOpacity
                            style={[styles.toggleBtn, item.isFragile && styles.toggleBtnActive]}
                            onPress={() => onUpdate({ ...item, isFragile: !item.isFragile })}
                        >
                            <Ionicons
                                name="warning-outline"
                                size={20}
                                color={item.isFragile ? colors.text.primary : colors.text.muted}
                            />
                            <Text style={[styles.toggleText, item.isFragile && styles.toggleTextActive]}>
                                Fragile
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.toggleBtn,
                                item.hasInsurance && styles.toggleBtnActive,
                                item.condition !== 'new' && styles.toggleBtnDisabled
                            ]}
                            disabled
                            activeOpacity={1}
                        >
                            <Ionicons
                                name={item.hasInsurance ? "shield-checkmark" : "shield-checkmark-outline"}
                                size={20}
                                color={
                                    item.condition !== 'new'
                                        ? colors.border.light
                                        : (item.hasInsurance ? colors.text.primary : colors.text.muted)
                                }
                            />
                            <Text style={[
                                styles.toggleText,
                                item.hasInsurance && styles.toggleTextActive,
                                item.condition !== 'new' && styles.toggleTextDisabled
                            ]}>
                                Insurance
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Invoice Upload (if insurance is enabled) */}
                    {item.hasInsurance && (
                        <View style={styles.invoiceSection}>
                            <Text style={styles.invoiceLabel}>
                                Upload invoice to confirm item is new
                            </Text>
                            {item.invoicePhoto ? (
                                <View style={{ position: 'relative', alignSelf: 'flex-start' }}>
                                    <Image source={{ uri: item.invoicePhoto }} style={[styles.invoiceImage, { marginRight: 0 }]} />
                                    <TouchableOpacity
                                        style={styles.removePhotoBtn}
                                        onPress={() => onUpdate({ ...item, invoicePhoto: null })}
                                    >
                                        <View style={styles.removePhotoIconBg}>
                                            <Ionicons name="close" size={14} color={colors.text.primary} />
                                        </View>
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

                    {/* Footer Actions */}
                    <View style={styles.footerActions}>
                        <TouchableOpacity style={[styles.footerActionBtn, styles.deleteActionBtn]} onPress={onDelete}>
                            <Ionicons name="trash-outline" size={18} color={colors.error} />
                            <Text style={[styles.footerActionText, styles.deleteActionText]}>Delete Item</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.footerActionBtn, styles.addActionBtn]} onPress={handleToggleExpand}>
                            <Ionicons name="checkmark-circle-outline" size={18} color={colors.text.primary} />
                            <Text style={[styles.footerActionText, styles.addActionText]}>Add</Text>
                        </TouchableOpacity>
                    </View>
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

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border.default
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.base
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    thumbnail: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.sm
    },
    placeholderThumb: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.border.default,
        alignItems: 'center',
        justifyContent: 'center'
    },
    cardHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerActionButton: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.circle,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardHeaderInfo: {
        marginLeft: spacing.md,
        flex: 1
    },
    itemName: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: typography.fontWeight.semibold
    },
    badges: {
        flexDirection: 'row',
        marginTop: spacing.xs
    },
    badge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.xs,
        marginRight: 6
    },
    badgeFragile: {
        backgroundColor: colors.secondaryLight
    },
    badgeInsured: {
        backgroundColor: colors.primaryLight
    },
    badgeText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white
    },
    cardContent: {
        padding: spacing.base,
        paddingTop: 0,
        borderTopWidth: 1,
        borderTopColor: colors.border.default
    },
    field: {
        marginTop: spacing.base
    },
    fieldLabel: {
        color: colors.text.primary,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        marginBottom: spacing.sm,
        textTransform: 'uppercase'
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
        height: 80,
        textAlignVertical: 'top'
    },
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap'
    },
    photoContainer: {
        position: 'relative',
        marginRight: spacing.sm,
        marginBottom: spacing.sm
    },
    photo: {
        width: 80,
        height: 80,
        borderRadius: borderRadius.sm
    },
    removePhotoBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        zIndex: 10
    },
    removePhotoIconBg: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.error,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: colors.background.tertiary // Matches card bg to create "cutout" effect
    },
    addPhotoBtnTop: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        marginBottom: spacing.md,
        marginTop: spacing.md // Added top spacing
    },
    addPhotoBtnTopTitle: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: typography.fontWeight.semibold
    },
    addPhotoBtnTopSubtitle: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.xs,
        marginTop: 2
    },
    errorText: {
        color: colors.error,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        marginBottom: spacing.sm,
    },
    photoGridTop: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: spacing.base
    },
    toggleRow: {
        flexDirection: 'row',
        marginTop: spacing.sm,
        gap: spacing.sm // Use gap for consistent spacing
    },
    // ... (skipping condition styles) ...
    conditionBtnGroup: {
        flexDirection: 'row',
        backgroundColor: colors.background.input,
        borderRadius: borderRadius.full,
        padding: 2, // Reduced padding to bring buttons closer to edges
        marginBottom: spacing.base // Add margin bottom to group instead
    },
    conditionBtn: {
        flex: 1,
        paddingVertical: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.xl
    },
    conditionBtnActive: {
        backgroundColor: colors.primary
    },
    conditionBtnText: {
        color: colors.text.muted,
        fontWeight: typography.fontWeight.semibold
        // Removed fontSize: typography.fontSize.sm to match toggleText default size
    },
    conditionBtnTextActive: {
        color: colors.white
    },
    // ...
    toggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.input,
        borderRadius: borderRadius.md,
        paddingVertical: 14
        // Removed marginRight, handled by gap in parent
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
    toggleBtnDisabled: {
        // No background change, just disable interaction visual via text/icon
    },
    toggleTextDisabled: {
        color: colors.border.light
    },
    invoiceSection: {
        marginTop: spacing.base,
        padding: spacing.base,
        backgroundColor: colors.background.input,
        borderRadius: borderRadius.md
    },
    invoiceLabel: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        marginBottom: spacing.md
    },
    invoicePreview: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    invoiceImage: {
        width: 60,
        height: 80,
        borderRadius: borderRadius.sm,
        marginRight: spacing.md
    },
    removeInvoiceBtn: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    removeInvoiceText: {
        color: colors.error,
        marginLeft: 6,
        fontWeight: typography.fontWeight.semibold
    },
    uploadInvoiceBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.primary,
        borderStyle: 'dashed',
        borderRadius: borderRadius.md,
        padding: spacing.base
    },
    uploadInvoiceText: {
        color: colors.primary,
        fontWeight: typography.fontWeight.semibold,
        marginLeft: spacing.sm
    },
    footerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.base
    },
    footerActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1
    },
    deleteActionBtn: {
        borderColor: colors.error,
        backgroundColor: colors.errorLight
    },
    addActionBtn: {
        borderColor: colors.success,
        backgroundColor: colors.success
    },
    footerActionText: {
        fontWeight: typography.fontWeight.semibold,
        marginLeft: spacing.xs
    },
    deleteActionText: {
        color: colors.error,
    },
    addActionText: {
        color: colors.text.primary,
    },
    errorBorder: {
        borderWidth: 1,
        borderColor: colors.error,
    },
});

export default OrderItemCard;
