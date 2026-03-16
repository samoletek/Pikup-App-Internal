// Review payment methods component: renders saved cards list and entry point to add new card.
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../styles';
import { colors } from '../../../../styles/theme';

const getSelectedMethodDisplay = (selectedPaymentMethod) => {
  if (!selectedPaymentMethod) {
    return {
      title: 'Select a card',
      subtitle: 'Choose a saved payment method',
      icon: 'alert-circle-outline',
      iconColor: colors.warning,
    };
  }

  const brand = selectedPaymentMethod.brand || selectedPaymentMethod.cardBrand || 'Card';

  return {
    title: `${brand.toUpperCase()} •••• ${selectedPaymentMethod.last4}`,
    subtitle: `Expires ${selectedPaymentMethod.expMonth}/${selectedPaymentMethod.expYear}`,
    icon: 'card',
    iconColor: colors.success,
  };
};

const ReviewPaymentMethodsCard = ({
  paymentMethods,
  selectedPaymentMethod,
  defaultPaymentMethodId,
  onSelectPaymentMethod,
  onAddCard,
}) => {
  const selectedMethodDisplay = useMemo(
    () => getSelectedMethodDisplay(selectedPaymentMethod),
    [selectedPaymentMethod],
  );

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryCardTitle}>Choose Card</Text>

      {paymentMethods.length === 0 ? (
        <View style={styles.noCardsContainer}>
          <Ionicons name={selectedMethodDisplay.icon} size={20} color={selectedMethodDisplay.iconColor} />
          <View style={styles.paymentSummaryCopy}>
            <Text style={styles.paymentSummaryTitle}>{selectedMethodDisplay.title}</Text>
            <Text style={styles.paymentSummarySubtitle}>{selectedMethodDisplay.subtitle}</Text>
          </View>
        </View>
      ) : (
        paymentMethods.map((method) => {
          const methodBrand = method.brand || method.cardBrand || 'Card';
          const isSelected = selectedPaymentMethod?.id === method.id;
          const isDefault = defaultPaymentMethodId
            ? defaultPaymentMethodId === method.id
            : method.isDefault;

          return (
            <TouchableOpacity
              key={method.id}
              style={[styles.paymentMethodRow, isSelected && styles.paymentMethodRowSelected]}
              onPress={() => onSelectPaymentMethod?.(method)}
            >
              <View style={styles.paymentMethodRowLeft}>
                <Ionicons name="card" size={20} color={isSelected ? colors.success : colors.text.secondary} />
                <View style={styles.paymentMethodCopy}>
                  <Text style={styles.paymentMethodTitle}>
                    {methodBrand.toUpperCase()} •••• {method.last4}
                  </Text>
                  <Text style={styles.paymentMethodSubtitle}>
                    Expires {method.expMonth}/{method.expYear}
                  </Text>
                </View>
              </View>
              <View style={styles.paymentMethodBadges}>
                {isDefault && <Text style={styles.defaultMethodBadge}>Default</Text>}
                {isSelected && <Ionicons name="checkmark-circle" size={22} color={colors.success} />}
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <TouchableOpacity
        style={styles.addPaymentCardButton}
        onPress={onAddCard}
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.white} />
        <Text style={styles.addPaymentCardButtonText}>Add Card</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ReviewPaymentMethodsCard;
