export const DRIVER_RATING_BADGES = Object.freeze([
  {
    id: 'fast_loader',
    label: 'Fast Loader',
    icon: 'flash',
    activeColor: '#00D4AA',
  },
  {
    id: 'fragile_handler',
    label: 'Fragile Handler',
    icon: 'shield-checkmark',
    activeColor: '#4A90E2',
  },
  {
    id: 'friendly_service',
    label: 'Friendly Service',
    icon: 'happy',
    activeColor: '#FFB800',
  },
]);

export const CUSTOMER_RATING_BADGES = Object.freeze([
  {
    id: 'ready_on_time',
    label: 'Ready on Time',
    icon: 'time',
    activeColor: '#00D4AA',
  },
  {
    id: 'clear_instructions',
    label: 'Clear Instructions',
    icon: 'map',
    activeColor: '#4A90E2',
  },
  {
    id: 'friendly_customer',
    label: 'Friendly Customer',
    icon: 'thumbs-up',
    activeColor: '#FFB800',
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
