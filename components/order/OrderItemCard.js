import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Image,
    Alert,
    Animated,
    LayoutAnimation,
    Platform,
    UIManager
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, borderRadius, spacing, typography } from '../../styles/theme';
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
    onDelete
}) => {
    const [isUploading, setIsUploading] = useState(false);

    const handleAddPhoto = async () => {
        if (item.photos.length >= MAX_PHOTOS) {
            Alert.alert('Limit Reached', `Maximum ${MAX_PHOTOS} photos per item.`);
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8
        });

        if (!result.canceled && result.assets[0]) {
            const newPhotos = [...item.photos, result.assets[0].uri];
            onUpdate({ ...item, photos: newPhotos });
        }
    };

    const handleTakePhoto = async () => {
        if (item.photos.length >= MAX_PHOTOS) {
            Alert.alert('Limit Reached', `Maximum ${MAX_PHOTOS} photos per item.`);
            return;
        }

        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8
        });

        if (!result.canceled && result.assets[0]) {
            const newPhotos = [...item.photos, result.assets[0].uri];
            onUpdate({ ...item, photos: newPhotos });
        }
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
                            <Ionicons name="cube-outline" size={24} color="#666" />
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
                <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color="#888"
                />
            </TouchableOpacity>

            {/* Expanded Content */}
            {isExpanded && (
                <View style={styles.cardContent}>
                    {/* Name Input */}
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Item Name *</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. Couch, TV, Moving boxes..."
                            placeholderTextColor="#666"
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
                            placeholderTextColor="#666"
                            value={item.description}
                            onChangeText={(text) => onUpdate({ ...item, description: text })}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    {/* Photos */}
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Photos ({item.photos.length}/{MAX_PHOTOS})</Text>
                        <View style={styles.photoGrid}>
                            {item.photos.map((uri, index) => (
                                <View key={index} style={styles.photoContainer}>
                                    <Image source={{ uri }} style={styles.photo} />
                                    <TouchableOpacity
                                        style={styles.removePhotoBtn}
                                        onPress={() => handleRemovePhoto(index)}
                                    >
                                        <Ionicons name="close-circle" size={22} color="#FF4444" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {item.photos.length < MAX_PHOTOS && (
                                <View style={styles.addPhotoButtons}>
                                    <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto}>
                                        <Ionicons name="images-outline" size={24} color="#A77BFF" />
                                        <Text style={styles.addPhotoBtnText}>Gallery</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.addPhotoBtn} onPress={handleTakePhoto}>
                                        <Ionicons name="camera-outline" size={24} color="#A77BFF" />
                                        <Text style={styles.addPhotoBtnText}>Camera</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Toggles */}
                    <View style={styles.toggleRow}>
                        <TouchableOpacity
                            style={[styles.toggleBtn, item.isFragile && styles.toggleBtnActive]}
                            onPress={() => onUpdate({ ...item, isFragile: !item.isFragile })}
                        >
                            <Ionicons
                                name="warning-outline"
                                size={20}
                                color={item.isFragile ? '#FFF' : '#888'}
                            />
                            <Text style={[styles.toggleText, item.isFragile && styles.toggleTextActive]}>
                                Fragile
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.toggleBtn, item.hasInsurance && styles.toggleBtnActive]}
                            onPress={() => onUpdate({ ...item, hasInsurance: !item.hasInsurance })}
                        >
                            <Ionicons
                                name="shield-checkmark-outline"
                                size={20}
                                color={item.hasInsurance ? '#FFF' : '#888'}
                            />
                            <Text style={[styles.toggleText, item.hasInsurance && styles.toggleTextActive]}>
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
                                <View style={styles.invoicePreview}>
                                    <Image source={{ uri: item.invoicePhoto }} style={styles.invoiceImage} />
                                    <TouchableOpacity
                                        style={styles.removeInvoiceBtn}
                                        onPress={() => onUpdate({ ...item, invoicePhoto: null })}
                                    >
                                        <Ionicons name="trash-outline" size={18} color="#FF4444" />
                                        <Text style={styles.removeInvoiceText}>Remove</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity style={styles.uploadInvoiceBtn} onPress={handleAddInvoice}>
                                    <Ionicons name="document-attach-outline" size={24} color="#A77BFF" />
                                    <Text style={styles.uploadInvoiceText}>Upload Invoice</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Delete Button */}
                    <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
                        <Ionicons name="trash-outline" size={18} color="#FF4444" />
                        <Text style={styles.deleteBtnText}>Delete Item</Text>
                    </TouchableOpacity>
                </View>
            )}
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
        color: colors.text.muted,
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
        top: -8,
        right: -8
    },
    addPhotoButtons: {
        flexDirection: 'row'
    },
    addPhotoBtn: {
        width: 80,
        height: 80,
        borderRadius: borderRadius.sm,
        borderWidth: 2,
        borderColor: colors.primary,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm
    },
    addPhotoBtnText: {
        color: colors.primary,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        marginTop: spacing.xs
    },
    toggleRow: {
        flexDirection: 'row',
        marginTop: spacing.base
    },
    toggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.input,
        borderRadius: borderRadius.md,
        paddingVertical: 14,
        marginRight: spacing.sm
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
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.base,
        paddingVertical: spacing.md
    },
    deleteBtnText: {
        color: colors.error,
        fontWeight: typography.fontWeight.semibold,
        marginLeft: 6
    }
});

export default OrderItemCard;
