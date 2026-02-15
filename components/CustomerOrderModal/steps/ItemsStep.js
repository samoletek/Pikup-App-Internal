import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OrderItemCard from '../../order/OrderItemCard';
import { styles } from '../styles';
import { colors } from '../../../styles/theme';

const generateItemId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

import * as ImagePicker from 'expo-image-picker';
import { analyzeImage } from '../../../services/AIService';

const ItemsStep = ({ orderData, setOrderData, expandedItemId, setExpandedItemId }) => {
    const [isAnalyzing, setIsAnalyzing] = React.useState(false);

    const handleAddWithAI = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant camera roll permissions to upload photos.');
                return;
            }

            Alert.alert(
                'Analyze Item',
                'Choose a photo of your item',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Take Photo',
                        onPress: () => pickImage('camera')
                    },
                    {
                        text: 'Choose from Library',
                        onPress: () => pickImage('library')
                    }
                ]
            );
        } catch (error) {
            console.error('Error initiating AI analysis:', error);
            Alert.alert('Error', 'Could not start image picker.');
        }
    };

    const pickImage = async (source) => {
        try {
            let result;
            const options = {
                mediaTypes: 'images',
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.5,
                base64: true,
            };

            if (source === 'camera') {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Please grant camera permissions.');
                    return;
                }
                result = await ImagePicker.launchCameraAsync(options);
            } else {
                result = await ImagePicker.launchImageLibraryAsync(options);
            }

            if (!result.canceled && result.assets && result.assets.length > 0) {
                analyzeItemPhoto(result.assets[0]);
            }
        } catch (error) {
            console.error('Image picker error:', error);
            Alert.alert('Error', 'Failed to pick image.');
        }
    };

    const analyzeItemPhoto = async (asset) => {
        if (!asset.base64) {
            Alert.alert('Error', 'Could not process image data.');
            return;
        }

        setIsAnalyzing(true);
        try {
            const aiResult = await analyzeImage(asset.base64);

            const newItem = {
                id: generateItemId(),
                name: aiResult.description || 'Unknown Item',
                description: aiResult.description || '',
                photos: [asset.uri],
                isFragile: false, // AI could potentially guess this too
                condition: (aiResult.condition === 'New' ? 'new' : 'used'),
                hasInsurance: false,
                value: '',
                invoicePhoto: null,
                category: aiResult.category || 'Other', // Add category if schema supports it
                weightEstimate: aiResult.weight_estimate
            };

            setOrderData(prev => ({ ...prev, items: [...prev.items, newItem] }));
            setExpandedItemId(newItem.id);

            // Optional: Show success toast or small alert
            // Alert.alert('Success', 'Item analyzed and added!');

        } catch (error) {
            console.error('AI Analysis Failed:', error);
            Alert.alert('Analysis Failed', 'Could not analyze the image. Please try again or add manually.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAddItem = () => {
        const newItem = {
            id: generateItemId(),
            name: '',
            description: '',
            photos: [],
            isFragile: false,
            condition: 'used',
            hasInsurance: false,
            value: '',
            invoicePhoto: null
        };
        setOrderData(prev => ({ ...prev, items: [...prev.items, newItem] }));
        setExpandedItemId(newItem.id);
    };

    const handleUpdateItem = (updatedItem) => {
        setOrderData(prev => ({
            ...prev,
            items: prev.items.map(item => item.id === updatedItem.id ? updatedItem : item)
        }));
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

    return (
        <ScrollView
            style={styles.stepContent}
            contentContainerStyle={styles.itemsStepContentContainer}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.aiActionsSection}>
                <TouchableOpacity
                    style={[styles.aiPrimaryBtn, isAnalyzing && { opacity: 0.7 }]}
                    onPress={handleAddWithAI}
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
                            {isAnalyzing ? 'Analyzing Item...' : 'Add Item with AI'}
                        </Text>
                        <Text style={styles.aiActionSubtitle}>
                            {isAnalyzing ? 'Identifying item details...' : 'Snap a photo and prefill item details instantly'}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.aiSecondaryBtn, styles.aiSecondaryBtnDisabled]} disabled>
                    <View style={styles.aiSecondaryIconContainer}>
                        <Ionicons name="images-outline" size={20} color={colors.text.muted} />
                    </View>
                    <View style={styles.aiActionTextContainer}>
                        <Text style={styles.aiSecondaryTitle}>Add Multiple Items with AI</Text>
                        <Text style={styles.aiActionSubtitle}>Upload up to 3 photos at once (coming soon)</Text>
                    </View>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.text.muted} />
                </TouchableOpacity>

                <View style={styles.aiPoweredByRow}>
                    <Ionicons name="sparkles-outline" size={14} color={colors.text.muted} />
                    <Text style={styles.aiPoweredByText}>Powered by Gemini</Text>
                </View>
            </View>

            <View style={styles.manualSectionRow}>
                <View style={styles.manualSectionLine} />
                <Text style={styles.manualSectionText}>Or add items manually</Text>
                <View style={styles.manualSectionLine} />
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
                    />
                ))
            )}

            <TouchableOpacity style={styles.addItemBtn} onPress={handleAddItem}>
                <Ionicons name="add-circle" size={24} color={colors.primary} />
                <Text style={styles.addItemBtnText}>Add Item Manually</Text>
            </TouchableOpacity>

            <View style={styles.itemsBottomSpacer} />
        </ScrollView>
    );
};

export default ItemsStep;
