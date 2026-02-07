import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OrderItemCard from '../../order/OrderItemCard';
import { styles } from '../styles';
import { colors } from '../../../styles/theme';

const generateItemId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const ItemsStep = ({ orderData, setOrderData, expandedItemId, setExpandedItemId }) => {
    const handleAddItem = () => {
        const newItem = {
            id: generateItemId(),
            name: '',
            description: '',
            photos: [],
            isFragile: false,
            condition: 'used',
            hasInsurance: false,
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
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            {orderData.items.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="cube-outline" size={64} color={colors.border.light} />
                    <Text style={styles.emptyStateText}>No items added yet</Text>
                    <Text style={styles.emptyStateSubtext}>Tap below to add your first item</Text>
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
                <Text style={styles.addItemBtnText}>Add Item</Text>
            </TouchableOpacity>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
};

export default ItemsStep;
