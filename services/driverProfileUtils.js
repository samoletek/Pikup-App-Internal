import { DRIVER_RATING_BADGES } from '../constants/ratingBadges';

const DEFAULT_DRIVER_BADGE_STATS = Object.freeze(
  DRIVER_RATING_BADGES.reduce((acc, badge) => {
    acc[badge.id] = 0;
    return acc;
  }, {})
);

export const normalizeDriverBadgeStats = (value) => {
  const safeValue =
    value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};
  const normalized = {
    ...DEFAULT_DRIVER_BADGE_STATS,
  };

  Object.entries(safeValue).forEach(([badgeId, badgeCount]) => {
    const parsedCount = Number(badgeCount);
    normalized[badgeId] = Number.isFinite(parsedCount) && parsedCount >= 0
      ? parsedCount
      : 0;
  });

  return normalized;
};
