// Trip Rating Modal component: renders its UI and handles related interactions.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getRatingBadgesByTargetRole } from '../constants/ratingBadges';
import AppButton from './ui/AppButton';
import { borderRadius, colors, spacing, typography } from '../styles/theme';

const getRatingLabel = (rating) => {
  if (rating >= 5) return 'Excellent';
  if (rating >= 4) return 'Great';
  if (rating >= 3) return 'Good';
  if (rating >= 2) return 'Fair';
  return 'Needs improvement';
};

export default function TripRatingModal({
  visible,
  targetName = 'Driver',
  targetRole = 'driver',
  title,
  subtitle,
  submitLabel = 'Submit',
  cancelLabel = 'Later',
  submitting = false,
  showBadges = true,
  onClose,
  onSubmit,
}) {
  const [rating, setRating] = useState(5);
  const [selectedBadges, setSelectedBadges] = useState([]);

  const badgeOptions = useMemo(
    () => getRatingBadgesByTargetRole(targetRole),
    [targetRole]
  );

  useEffect(() => {
    if (!visible) return;
    setRating(5);
    setSelectedBadges([]);
  }, [visible]);

  const toggleBadge = (badgeId) => {
    setSelectedBadges((prev) => {
      if (prev.includes(badgeId)) {
        return prev.filter((id) => id !== badgeId);
      }
      return [...prev, badgeId];
    });
  };

  const handleSubmit = () => {
    if (submitting || typeof onSubmit !== 'function') return;
    onSubmit({ rating, badges: selectedBadges });
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={submitting ? undefined : onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>{title || `Rate ${targetName}`}</Text>
          <Text style={styles.subtitle}>
            {subtitle || `How was your trip with ${targetName}?`}
          </Text>

          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                style={styles.starButton}
                onPress={() => setRating(star)}
                disabled={submitting}
              >
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={34}
                  color={star <= rating ? colors.warning : colors.text.muted}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.ratingLabel}>{getRatingLabel(rating)}</Text>

          {showBadges && (
            <View style={styles.badgesSection}>
              <Text style={styles.badgesTitle}>What stood out?</Text>
              <View style={styles.badgesRow}>
                {badgeOptions.map((badge) => {
                  const isSelected = selectedBadges.includes(badge.id);
                  return (
                    <TouchableOpacity
                      key={badge.id}
                      style={[
                        styles.badgeButton,
                        isSelected && {
                          borderColor: badge.activeColor,
                          backgroundColor: `${badge.activeColor}22`,
                        },
                      ]}
                      onPress={() => toggleBadge(badge.id)}
                      disabled={submitting}
                    >
                      <Ionicons
                        name={badge.icon}
                        size={20}
                        color={isSelected ? badge.activeColor : colors.text.muted}
                      />
                      <Text
                        style={[
                          styles.badgeLabel,
                          isSelected && { color: badge.activeColor },
                        ]}
                      >
                        {badge.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.footerRow}>
            <AppButton
              title={cancelLabel}
              variant="secondary"
              style={styles.laterButton}
              onPress={onClose}
              disabled={submitting}
            />

            <AppButton
              title={submitLabel}
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={submitting}
              loading={submitting}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  modalCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.lg,
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  starButton: {
    paddingHorizontal: spacing.xs,
  },
  ratingLabel: {
    color: colors.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  badgesSection: {
    marginTop: spacing.lg,
  },
  badgesTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  badgeButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  badgeLabel: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.xs + 1,
    textAlign: 'center',
    color: colors.text.muted,
    fontWeight: typography.fontWeight.medium,
  },
  footerRow: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  laterButton: {
    flex: 1,
    height: 46,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.primary,
  },
  submitButton: {
    flex: 1,
    height: 46,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
});
