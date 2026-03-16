import { DRIVER_RATING_BADGES } from '../constants/ratingBadges';
import { logger } from './logger';
import {
  fetchProfileByTableAndUserId,
  updateProfileByTableAndUserId,
} from './repositories/authRepository';

const DEFAULT_DRIVER_BADGE_STATS = Object.freeze(
  DRIVER_RATING_BADGES.reduce((accumulator, badge) => {
    accumulator[badge.id] = 0;
    return accumulator;
  }, {})
);

export const getMissingColumnFromError = (error) => {
  const message = String(error?.message || '');
  let match = message.match(/Could not find the '([^']+)' column/i);
  if (match?.[1]) {
    return match[1];
  }

  match = message.match(/column\s+([a-zA-Z0-9_.]+)\s+does not exist/i);
  if (match?.[1]) {
    return match[1].split('.').pop();
  }

  return null;
};

export const applyProfileUpdateWithColumnFallback = async (
  tableName,
  userId,
  rawUpdates = {}
) => {
  const updates = { ...rawUpdates };

  while (Object.keys(updates).length > 0) {
    const { error } = await updateProfileByTableAndUserId(tableName, userId, updates);

    if (!error) {
      return true;
    }

    const missingColumn = getMissingColumnFromError(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(updates, missingColumn)) {
      logger.warn('AuthProfileSeedUtils', `"${tableName}" is missing optional column "${missingColumn}". Retrying without it.`);
      delete updates[missingColumn];
      continue;
    }

    throw error;
  }

  return false;
};

export const seedInitialProfileStats = async (tableName, userId, userType) => {
  const timestamp = new Date().toISOString();
  const baseUpdates = {
    rating_count: 0,
    updated_at: timestamp,
  };

  if (userType === 'driver') {
    baseUpdates.badge_stats = { ...DEFAULT_DRIVER_BADGE_STATS };
  }

  await applyProfileUpdateWithColumnFallback(tableName, userId, baseUpdates);

  if (userType !== 'driver') {
    return;
  }

  const { data: profileRow } = await fetchProfileByTableAndUserId(tableName, userId, {
    columns: 'metadata',
    maybeSingle: true,
  });

  const currentMetadata =
    profileRow?.metadata &&
    typeof profileRow.metadata === 'object' &&
    !Array.isArray(profileRow.metadata)
      ? profileRow.metadata
      : {};

  const currentBadgeStats =
    currentMetadata.badge_stats &&
    typeof currentMetadata.badge_stats === 'object' &&
    !Array.isArray(currentMetadata.badge_stats)
      ? currentMetadata.badge_stats
      : {};

  const metadataBadgeStats = {
    ...DEFAULT_DRIVER_BADGE_STATS,
    ...currentBadgeStats,
  };

  await applyProfileUpdateWithColumnFallback(tableName, userId, {
    metadata: {
      ...currentMetadata,
      badge_stats: metadataBadgeStats,
    },
    updated_at: timestamp,
  });
};
