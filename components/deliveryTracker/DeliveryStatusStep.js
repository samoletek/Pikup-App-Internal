import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DeliveryStatusStep({
  step,
  index,
  isLast,
  currentStatusIndex,
  styles,
  colors,
}) {
  const isActive = index <= currentStatusIndex;
  const isCurrent = index === currentStatusIndex;

  return (
    <View style={styles.statusStep}>
      <View style={styles.statusIconContainer}>
        <View style={[
          styles.statusDot,
          isActive ? styles.activeDot : styles.inactiveDot,
          isCurrent ? styles.currentDot : null,
        ]}>
          <Ionicons
            name={step.icon}
            size={16}
            color={isActive ? colors.white : colors.text.subtle}
          />
        </View>

        {!isLast && (
          <View style={[
            styles.statusLine,
            index < currentStatusIndex ? styles.activeLine : styles.inactiveLine,
          ]} />
        )}
      </View>

      <View style={styles.statusTextContainer}>
        <Text style={[
          styles.statusLabel,
          isActive ? styles.activeLabel : styles.inactiveLabel,
          isCurrent ? styles.currentLabel : null,
        ]}>
          {step.label}
        </Text>

        {isCurrent && (
          <Text style={styles.statusDescription}>{step.description}</Text>
        )}
      </View>
    </View>
  );
}
