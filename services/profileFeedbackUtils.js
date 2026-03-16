import { DRIVER_RATING_BADGES } from '../constants/ratingBadges';

export const PROFILE_TABLE_BY_TYPE = Object.freeze({
  driver: 'drivers',
  customer: 'customers',
});

export const FEEDBACK_ROLE_BY_TYPE = Object.freeze({
  driver: 'driver',
  customer: 'customer',
});

const DEFAULT_DRIVER_BADGE_STATS = Object.freeze(
  DRIVER_RATING_BADGES.reduce((accumulator, badge) => {
    accumulator[badge.id] = 0;
    return accumulator;
  }, {})
);

export const normalizeUserType = (value, fallback = 'customer') => {
  if (value === 'driver' || value === 'customer') {
    return value;
  }
  return fallback;
};

export const toBadgeStats = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return { ...value };
};

export const withDefaultDriverBadgeStats = (value) => {
  const source = toBadgeStats(value);
  const normalized = {
    ...DEFAULT_DRIVER_BADGE_STATS,
  };

  Object.entries(source).forEach(([badgeId, badgeCount]) => {
    const parsedCount = Number(badgeCount);
    normalized[badgeId] = Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : 0;
  });

  return normalized;
};

export const hasMissingColumnError = (error, columnName) => {
  const text = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    text.includes('does not exist') &&
    text.includes('column') &&
    text.includes(String(columnName || '').toLowerCase())
  );
};

export const hasMissingTableError = (error, tableName) => {
  const text = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  const normalizedTable = String(tableName || '').toLowerCase();
  return (
    (text.includes('does not exist') && text.includes('relation') && text.includes(normalizedTable)) ||
    (text.includes('could not find the table') && text.includes(normalizedTable))
  );
};

export const toSafeRating = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 5;
  }
  return Math.max(1, Math.min(5, parsed));
};

export const normalizeFeedbackRow = (row = {}) => {
  const timestamp = row.timestamp || row.created_at || row.updated_at || null;
  return {
    ...row,
    timestamp,
  };
};
