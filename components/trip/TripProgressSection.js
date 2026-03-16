// Trip Progress Section component: renders its UI and handles related interactions.
import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/theme';
import { STATUS_STEPS } from '../../utils/tripDetails/formatStatusUtils';

export default function TripProgressSection({ displayTrip, ui }) {
  return (
    <View style={ui.sectionCard}>
      <Text style={ui.sectionTitle}>Trip Status</Text>

      {displayTrip.progressStep ? (
        <View style={ui.progressList}>
          {STATUS_STEPS.map((step, index) => {
            const isCompleted = displayTrip.progressIndex > index;
            const isCurrent = displayTrip.progressIndex === index;
            const isReached = displayTrip.progressIndex >= index;

            return (
              <View key={step.key} style={ui.progressStepRow}>
                <View style={ui.progressStepRail}>
                  <View
                    style={[
                      ui.progressStepIconWrap,
                      isReached && ui.progressStepIconWrapReached,
                      isCurrent && ui.progressStepIconWrapCurrent,
                    ]}
                  >
                    <Ionicons
                      name={step.icon}
                      size={14}
                      color={isReached ? colors.white : colors.text.muted}
                    />
                  </View>
                  {index < STATUS_STEPS.length - 1 && (
                    <View
                      style={[
                        ui.progressConnector,
                        isCompleted && ui.progressConnectorReached,
                      ]}
                    />
                  )}
                </View>

                <View style={ui.progressStepTextWrap}>
                  <Text
                    style={[
                      ui.progressStepLabel,
                      isReached && ui.progressStepLabelReached,
                      isCurrent && ui.progressStepLabelCurrent,
                    ]}
                  >
                    {step.label}
                  </Text>
                  <Text style={ui.progressStepDescription}>{step.description}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={ui.sectionHint}>
          Detailed step tracking is unavailable for this status.
        </Text>
      )}
    </View>
  );
}
