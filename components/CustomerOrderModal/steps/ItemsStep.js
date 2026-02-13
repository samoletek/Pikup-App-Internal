import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OrderItemCard from '../../order/OrderItemCard';
import { styles } from '../styles';
import { colors } from '../../../styles/theme';

const generateItemId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const ItemsStep = ({ orderData, setOrderData, expandedItemId, setExpandedItemId }) => {
    const handleAddWithAI = () => {
        Alert.alert(
            'AI Intake Coming Soon',
            'This button will open AI-assisted item capture. For now, add items manually below.'
        );
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
                <TouchableOpacity style={styles.aiPrimaryBtn} onPress={handleAddWithAI}>
                    <View style={styles.aiPrimaryIconContainer}>
                        <Ionicons name="sparkles" size={20} color={colors.white} />
                    </View>
                    <View style={styles.aiActionTextContainer}>
                        <Text style={styles.aiPrimaryTitle}>Add Item with AI</Text>
                        <Text style={styles.aiActionSubtitle}>Snap a photo and prefill item details instantly</Text>
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
