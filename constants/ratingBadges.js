import { colors } from '../styles/theme';

export const DRIVER_RATING_BADGES = Object.freeze([
  {
    id: 'fast_loader',
    label: 'Fast Loader',
    icon: 'flash',
    activeColor: colors.success,
  },
  {
    id: 'fragile_handler',
    label: 'Fragile Handler',
    icon: 'shield-checkmark',
    activeColor: colors.info,
  },
  {
    id: 'friendly_service',
    label: 'Friendly',
    icon: 'happy',
    activeColor: colors.warning,
  },
  {
    id: 'followed_instructions',
    label: 'Followed Instructions',
    icon: 'checkmark-circle',
    activeColor: colors.success,
  },
  {
    id: 'punctuality',
    label: 'Punctuality',
    icon: 'time',
    activeColor: colors.info,
  },
  {
    id: 'good_communication',
    label: 'Communication',
    icon: 'chatbubble',
    activeColor: colors.primary,
  },
  {
    id: 'careful_handling',
    label: 'Careful Handling',
    icon: 'hand-left',
    activeColor: colors.secondary,
  },
  {
    id: 'professional',
    label: 'Professional',
    icon: 'briefcase',
    activeColor: colors.warning,
  },
]);

export const CUSTOMER_RATING_BADGES = Object.freeze([
  {
    id: 'ready_on_time',
    label: 'Ready on Time',
    icon: 'time',
    activeColor: colors.success,
  },
  {
    id: 'clear_instructions',
    label: 'Clear Instructions',
    icon: 'map',
    activeColor: colors.info,
  },
  {
    id: 'friendly_customer',
    label: 'Friendly Customer',
    icon: 'thumbs-up',
    activeColor: colors.warning,
  },
]);

export const getRatingBadgesByTargetRole = (targetRole = 'driver') => {
  return targetRole === 'customer'
    ? CUSTOMER_RATING_BADGES
    : DRIVER_RATING_BADGES;
};

export const getRatingBadgeMeta = (targetRole = 'driver', badgeId) => {
  return getRatingBadgesByTargetRole(targetRole).find((badge) => badge.id === badgeId) || null;
};
