// Trip Driver Rating Section component: renders its UI and handles related interactions.
import React from 'react';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DRIVER_RATING_BADGES } from '../../constants/ratingBadges';
import AppButton from '../ui/AppButton';
import { colors } from '../../styles/theme';
import { getRatingLabel } from '../../utils/tripDetails/formatStatusUtils';

const STAR_SIZE = 32;

export default function TripDriverRatingSection({
  displayTrip,
  rating,
  setRating,
  selectedBadges,
  isRatingReadOnly,
  isSubmittingRating,
  canSubmitRating,
  toggleBadge,
  onSubmit,
  ui,
}) {
  return (
    <View style={ui.sectionCard}>
      <Text style={ui.sectionTitle}>Rate Your Driver</Text>

      <Text style={ui.ratingSubtitle}>
        How was your trip with {displayTrip.driverName}?
      </Text>

      <View style={ui.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isSelected = star <= rating;
          return (
            <TouchableOpacity
              key={star}
              style={ui.starButton}
              onPress={() => setRating(star)}
              disabled={isRatingReadOnly || isSubmittingRating}
            >
              <Ionicons
                name={isSelected ? 'star' : 'star-outline'}
                size={STAR_SIZE}
                color={isSelected ? colors.warning : colors.text.muted}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {rating > 0 ? <Text style={ui.ratingLabel}>{getRatingLabel(rating)}</Text> : null}

      <Text style={ui.badgesTitle}>Badges</Text>
      <View style={ui.badgesRow}>
        {DRIVER_RATING_BADGES.map((badge) => {
          const isSelected = selectedBadges.includes(badge.id);
          return (
            <TouchableOpacity
              key={badge.id}
              style={[
                ui.badgeButton,
                isSelected && {
                  borderColor: badge.activeColor,
                  backgroundColor: `${badge.activeColor}22`,
                },
              ]}
              onPress={() => toggleBadge(badge.id)}
              disabled={isRatingReadOnly || isSubmittingRating}
            >
              <Ionicons
                name={badge.icon}
                size={18}
                color={isSelected ? badge.activeColor : colors.text.muted}
              />
              <Text
                style={[
                  ui.badgeLabel,
                  isSelected && { color: badge.activeColor },
                ]}
              >
                {badge.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <AppButton
        title={
          isRatingReadOnly
            ? 'Rating Saved'
            : !displayTrip.driverId
              ? 'Driver unavailable'
              : 'Submit Rating'
        }
        style={[
          ui.submitRatingButton,
          !canSubmitRating && ui.submitRatingButtonDisabled,
        ]}
        labelStyle={ui.submitRatingButtonText}
        onPress={onSubmit}
        disabled={!canSubmitRating}
        loading={isSubmittingRating}
      />
    </View>
  );
}
