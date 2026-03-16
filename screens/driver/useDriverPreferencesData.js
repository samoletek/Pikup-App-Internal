import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_DRIVER_PREFERENCES,
  mergeDriverPreferences,
} from "./driverPreferences.constants";
import { logger } from "../../services/logger";

export default function useDriverPreferencesData({
  getDriverProfile,
  updateDriverPaymentProfile,
  userId,
}) {
  const [preferences, setPreferences] = useState(DEFAULT_DRIVER_PREFERENCES);

  useEffect(() => {
    let isMounted = true;

    const hydratePreferences = async () => {
      if (!userId || typeof getDriverProfile !== "function") {
        return;
      }

      try {
        const profile = await getDriverProfile(userId);
        const savedPreferences = profile?.metadata?.driverPreferences;

        if (savedPreferences && isMounted) {
          setPreferences(mergeDriverPreferences(savedPreferences));
        }
      } catch (error) {
        logger.error("DriverPreferencesData", "Failed to load driver preferences", error);
      }
    };

    void hydratePreferences();

    return () => {
      isMounted = false;
    };
  }, [getDriverProfile, userId]);

  const persistPreferences = useCallback(
    async (nextPreferences) => {
      if (!userId || typeof updateDriverPaymentProfile !== "function") {
        return;
      }

      try {
        await updateDriverPaymentProfile(userId, {
          driverPreferences: {
            ...nextPreferences,
            updatedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        logger.error("DriverPreferencesData", "Failed to persist driver preferences", error);
      }
    },
    [updateDriverPaymentProfile, userId]
  );

  const handleToggleChange = useCallback(
    (sectionKey, key, value) => {
      setPreferences((prev) => {
        const nextPreferences = {
          ...prev,
          [sectionKey]: {
            ...prev[sectionKey],
            [key]: value,
          },
        };
        void persistPreferences(nextPreferences);
        return nextPreferences;
      });
    },
    [persistPreferences]
  );

  const getSectionSummary = useCallback(
    (sectionKey) => {
      const state = preferences[sectionKey];
      if (!state) {
        return null;
      }

      const boolEntries = Object.entries(state).filter(([, entryValue]) => (
        typeof entryValue === "boolean"
      ));
      const enabled = boolEntries.filter(([, entryValue]) => !!entryValue).length;

      return {
        enabled,
        total: boolEntries.length,
      };
    },
    [preferences]
  );

  return {
    getSectionSummary,
    handleToggleChange,
    preferences,
  };
}
