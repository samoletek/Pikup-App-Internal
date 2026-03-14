import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OrderItemCard from '../../order/OrderItemCard';
import { styles } from '../styles';
import { colors } from '../../../styles/theme';
import AIPhotoPickerModal from '../AIPhotoPickerModal';
import * as ImageManipulator from 'expo-image-manipulator';
import { analyzeImages } from '../../../services/AIService';

const generateItemId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const ANALYSIS_IMAGE_MAX_SIDE = 1080;
const ANALYSIS_IMAGE_QUALITY = 0.4;

const ItemsStep = ({
    orderData,
    setOrderData,
    expandedItemId,
    setExpandedItemId,
    itemErrors,
    setItemErrors,
    pendingAttentionCount = 0,
}) => {
    const [isAnalyzing, setIsAnalyzing] = React.useState(false);
    const [showAIModal, setShowAIModal] = React.useState(false);

    const analyzeItemPhotos = async (assets) => {
        setIsAnalyzing(true);

        try {
            const processedImages = [];
            const assetMap = {};

            const buildResizeActions = (asset) => {
                const width = Number(asset?.width) || 0;
                const height = Number(asset?.height) || 0;

                if (width <= 0 || height <= 0) {
                    return [{ resize: { width: ANALYSIS_IMAGE_MAX_SIDE } }];
                }

                const largestSide = Math.max(width, height);
                if (largestSide <= ANALYSIS_IMAGE_MAX_SIDE) return [];

                if (width >= height) {
                    return [{ resize: { width: ANALYSIS_IMAGE_MAX_SIDE } }];
                }

                return [{ resize: { height: ANALYSIS_IMAGE_MAX_SIDE } }];
            };

            for (let i = 0; i < assets.length; i++) {
                const asset = assets[i];
                try {
                    if (!asset?.uri) {
                        console.warn(`Image ${i} missing uri`);
                        continue;
                    }

                    const optimizedAsset = await ImageManipulator.manipulateAsync(
                        asset.uri,
                        buildResizeActions(asset),
                        {
                            compress: ANALYSIS_IMAGE_QUALITY,
                            format: ImageManipulator.SaveFormat.JPEG,
                            base64: true,
                        }
                    );

                    if (optimizedAsset?.base64) {
                        processedImages.push(optimizedAsset.base64);
                        assetMap[i + 1] = asset.uri;
                    } else {
                        console.warn(`Image ${i} missing base64`);
                    }
                } catch (e) {
                    console.error("Error processing image", e);
                }
            }

            if (processedImages.length === 0) {
                Alert.alert('Error', 'No valid image data to analyze.');
                setIsAnalyzing(false);
                return;
            }

            const result = await analyzeImages(processedImages);

            if (result && result.items) {
                const newItems = [];

                result.items.forEach(aiItem => {
                    const qty = aiItem.quantity || 1;

                    for (let q = 0; q < qty; q++) {
                        const itemPhotos = (aiItem.source_photos || []).map(idx => assetMap[idx]).filter(Boolean);
                        const finalPhotos = itemPhotos.length > 0 ? itemPhotos.slice(0, 3) : (assetMap[1] ? [assetMap[1]] : []);

                        const newItem = {
                            id: generateItemId(),
                            name: aiItem.item_name || 'Unknown Item',
                            description: aiItem.description || '',
                            photos: finalPhotos,
                            isFragile: aiItem.is_fragile || false,
                            condition: '',
                            hasInsurance: false,
                            value: '',
                            invoicePhoto: null,
                            category: aiItem.category || 'Other',
                            weightEstimate: aiItem.estimated_weight_lbs,
                            addedByAI: true,
                        };

                        newItems.push(newItem);
                    }
                });

                setOrderData(prev => ({ ...prev, items: [...prev.items, ...newItems] }));
                if (newItems.length > 0) {
                    setExpandedItemId(newItems[0].id);
                }

                Alert.alert(
                    'Analysis Complete',
                    `AI found ${result.total_items} unique items (Total count: ${newItems.length}).`
                );

            } else {
                throw new Error('Invalid AI response structure');
            }

        } catch (error) {
            console.error('Batch analysis error:', error);
            Alert.alert('Analysis Failed', error?.message || 'Could not analyze images. Please try again.');
        } finally {
            setIsAnalyzing(false);
            setShowAIModal(false);
        }
    };

    const handleUpdateItem = (updatedItem) => {
        setOrderData(prev => ({
            ...prev,
            items: prev.items.map(item => item.id === updatedItem.id ? updatedItem : item)
        }));
        if (itemErrors?.[updatedItem.id]) {
            setItemErrors?.(prev => {
                const next = { ...prev };
                delete next[updatedItem.id];
                return next;
            });
        }
    };

    const handleDeleteItem = (itemId) => {
        Alert.alert('Delete Item?', 'This action cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    setOrderData(prev => ({ ...prev, items: prev.items.filter(item => item.id !== itemId) }));
                    if (expandedItemId === itemId) setExpandedItemId(null);
                }
            }
        ]);
    };

    const hasPendingAttention = pendingAttentionCount > 0;
    const pendingAttentionText = pendingAttentionCount === 1
        ? '1 item still needs your review before continuing.'
        : `${pendingAttentionCount} items still need your review before continuing.`;

    return (
        <>
            <ScrollView
                style={styles.stepContent}
                contentContainerStyle={styles.itemsStepContentContainer}
                showsVerticalScrollIndicator={false}
                stickyHeaderIndices={[0]}
            >
                <View style={styles.itemsStickyHeader}>
                    <TouchableOpacity
                        style={[styles.aiPrimaryBtn, isAnalyzing && { opacity: 0.7 }]}
                        onPress={() => setShowAIModal(true)}
                        disabled={isAnalyzing}
                    >
                        <View style={styles.aiPrimaryIconContainer}>
                            {isAnalyzing ? (
                                <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                                <Ionicons name="sparkles" size={20} color={colors.white} />
                            )}
                        </View>
                        <View style={styles.aiActionTextContainer}>
                            <Text style={styles.aiPrimaryTitle}>
                                {isAnalyzing ? 'Analyzing Items...' : 'Add Items'}
                            </Text>
                            <Text style={styles.aiActionSubtitle}>
                                {isAnalyzing ? 'Identifying item details...' : '✦ Powered by Gemini'}
                            </Text>
                        </View>
                        <View style={styles.addItemsPill}>
                            <Text style={styles.addItemsPillText}>Add Items</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {orderData.items.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="cube-outline" size={64} color={colors.border.light} />
                        <Text style={styles.emptyStateText}>No items added yet</Text>
                        <Text style={styles.emptyStateSubtext}>You can add multiple items to your order</Text>
                    </View>
                ) : (
                    orderData.items.map(item => (
                        <OrderItemCard
                            key={item.id}
                            item={item}
                            isExpanded={expandedItemId === item.id}
                            onToggleExpand={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                            onUpdate={handleUpdateItem}
                            onDelete={() => handleDeleteItem(item.id)}
                            errors={itemErrors?.[item.id]}
                        />
                    ))
                )}

                {orderData.items.length > 0 && hasPendingAttention && (
                    <View style={styles.itemsDisclaimerBox}>
                        <Ionicons
                            name="information-circle-outline"
                            size={18}
                            color={colors.warning}
                            style={styles.itemsDisclaimerIcon}
                        />
                        <Text style={styles.itemsDisclaimerText}>{pendingAttentionText}</Text>
                    </View>
                )}

                <View style={styles.itemsBottomSpacer} />
            </ScrollView>

            <AIPhotoPickerModal
                visible={showAIModal}
                onClose={() => setShowAIModal(false)}
                onAnalyze={analyzeItemPhotos}
                isAnalyzing={isAnalyzing}
            />
        </>
    );
};

export default ItemsStep;
