import React from 'react';
import { View, Text, Animated } from 'react-native';

export default function OnboardingProgressBar({
  styles,
  progressAnim,
  currentStep,
  totalSteps,
}) {
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressBackground}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
      <Text style={styles.progressText}>
        {currentStep + 1} of {totalSteps}
      </Text>
    </View>
  );
}
