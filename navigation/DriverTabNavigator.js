import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Alert } from "react-native";
import RoleTabNavigator from "./RoleTabNavigator";
import { driverTabs } from "./tabRoutes";
import { useAuthIdentity, useTripActions } from "../contexts/AuthContext";
import { logger } from "../services/logger";

const CHECKIN_POLL_INTERVAL_MS = 60 * 1000;
const CHECKIN_PROMPT_COOLDOWN_MS = 5 * 60 * 1000;

const parseTimestamp = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
};

const resolveTripId = (trip) => String(trip?.id || "").trim();

const resolveTripScheduleAt = (trip) => (
  parseTimestamp(trip?.scheduledTime || trip?.scheduled_time || null)
);

const resolveTripCheckinDeadlineAt = (trip) => (
  parseTimestamp(trip?.driver_checkin_deadline_at || trip?.driverCheckinDeadlineAt || null)
);

const formatDateTime = (value) => {
  const date = parseTimestamp(value);
  if (!date) {
    return "unknown time";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const createPromptMessage = (trip) => {
  const scheduleLabel = formatDateTime(trip?.scheduledTime || trip?.scheduled_time);
  const deadlineLabel = formatDateTime(
    trip?.driver_checkin_deadline_at || trip?.driverCheckinDeadlineAt
  );
  return [
    `Trip starts at ${scheduleLabel}.`,
    `Please confirm or decline within 30 minutes (until ${deadlineLabel}).`,
    "If there is no response, the trip will be reassigned automatically.",
  ].join("\n");
};

const sortTripsByDeadline = (firstTrip, secondTrip) => {
  const firstDeadline = resolveTripCheckinDeadlineAt(firstTrip)?.getTime() ?? Number.POSITIVE_INFINITY;
  const secondDeadline = resolveTripCheckinDeadlineAt(secondTrip)?.getTime() ?? Number.POSITIVE_INFINITY;
  return firstDeadline - secondDeadline;
};

const isTripPromptable = (trip) => {
  const nowMs = Date.now();
  const tripId = resolveTripId(trip);
  if (!tripId) {
    return false;
  }

  const scheduleAt = resolveTripScheduleAt(trip);
  if (!scheduleAt || scheduleAt.getTime() <= nowMs) {
    return false;
  }

  const deadlineAt = resolveTripCheckinDeadlineAt(trip);
  if (deadlineAt && deadlineAt.getTime() <= nowMs) {
    return false;
  }

  return true;
};

export default function DriverTabNavigator() {
  const { currentUser, userType } = useAuthIdentity();
  const {
    confirmScheduledTripCheckin,
    declineScheduledTripCheckin,
    getPendingDriverScheduledCheckins,
  } = useTripActions();
  const activePromptTripIdRef = useRef(null);
  const pollingInProgressRef = useRef(false);
  const lastPromptByTripRef = useRef(new Map());

  const canPollScheduledCheckins = useMemo(() => {
    return (
      userType === "driver" &&
      Boolean(currentUser?.id || currentUser?.uid) &&
      typeof getPendingDriverScheduledCheckins === "function" &&
      typeof confirmScheduledTripCheckin === "function" &&
      typeof declineScheduledTripCheckin === "function"
    );
  }, [
    confirmScheduledTripCheckin,
    currentUser?.id,
    currentUser?.uid,
    declineScheduledTripCheckin,
    getPendingDriverScheduledCheckins,
    userType,
  ]);

  const releaseActivePrompt = useCallback((tripId) => {
    if (activePromptTripIdRef.current === tripId) {
      activePromptTripIdRef.current = null;
    }
  }, []);

  const handleConfirmPrompt = useCallback(async (tripId) => {
    try {
      const result = await confirmScheduledTripCheckin(tripId);
      if (!result?.success) {
        logger.warn("DriverTabNavigator", "Scheduled check-in confirm failed", {
          tripId,
          error: result?.error || "unknown_error",
        });
        Alert.alert("Unable to confirm", result?.error || "Please try again.");
        return;
      }

      logger.info("DriverTabNavigator", "Scheduled check-in confirmed", { tripId });
    } catch (error) {
      logger.error("DriverTabNavigator", "Unexpected scheduled check-in confirm error", error);
      Alert.alert("Unable to confirm", "Please try again.");
    } finally {
      releaseActivePrompt(tripId);
    }
  }, [confirmScheduledTripCheckin, releaseActivePrompt]);

  const handleDeclinePrompt = useCallback(async (tripId) => {
    try {
      const result = await declineScheduledTripCheckin(tripId, {
        reason: "scheduled_checkin_declined_by_driver",
      });

      if (!result?.success) {
        logger.warn("DriverTabNavigator", "Scheduled check-in decline failed", {
          tripId,
          error: result?.error || "unknown_error",
        });
        Alert.alert("Unable to decline", result?.error || "Please try again.");
        return;
      }

      logger.info("DriverTabNavigator", "Scheduled check-in declined", { tripId });
      Alert.alert("Trip declined", "The order has been released to find another driver.");
    } catch (error) {
      logger.error("DriverTabNavigator", "Unexpected scheduled check-in decline error", error);
      Alert.alert("Unable to decline", "Please try again.");
    } finally {
      releaseActivePrompt(tripId);
    }
  }, [declineScheduledTripCheckin, releaseActivePrompt]);

  const showCheckinPrompt = useCallback((trip) => {
    const tripId = resolveTripId(trip);
    if (!tripId || activePromptTripIdRef.current) {
      return;
    }

    const lastPromptAt = Number(lastPromptByTripRef.current.get(tripId) || 0);
    if (Date.now() - lastPromptAt < CHECKIN_PROMPT_COOLDOWN_MS) {
      return;
    }

    activePromptTripIdRef.current = tripId;
    lastPromptByTripRef.current.set(tripId, Date.now());

    Alert.alert(
      "Scheduled Trip Check-in",
      createPromptMessage(trip),
      [
        {
          text: "Decline",
          style: "destructive",
          onPress: () => {
            void handleDeclinePrompt(tripId);
          },
        },
        {
          text: "Confirm",
          onPress: () => {
            void handleConfirmPrompt(tripId);
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          releaseActivePrompt(tripId);
        },
      }
    );
  }, [handleConfirmPrompt, handleDeclinePrompt, releaseActivePrompt]);

  const pollDriverCheckins = useCallback(async () => {
    if (!canPollScheduledCheckins || pollingInProgressRef.current || activePromptTripIdRef.current) {
      return;
    }

    pollingInProgressRef.current = true;
    try {
      const result = await getPendingDriverScheduledCheckins();
      if (!result?.success) {
        logger.warn("DriverTabNavigator", "Failed to load due scheduled check-ins", {
          error: result?.error || "unknown_error",
        });
        return;
      }

      const dueTrips = Array.isArray(result?.trips) ? result.trips : [];
      const promptCandidate = dueTrips
        .filter(isTripPromptable)
        .sort(sortTripsByDeadline)[0];

      if (!promptCandidate) {
        return;
      }

      showCheckinPrompt(promptCandidate);
    } catch (error) {
      logger.error("DriverTabNavigator", "Unexpected due check-in polling error", error);
    } finally {
      pollingInProgressRef.current = false;
    }
  }, [canPollScheduledCheckins, getPendingDriverScheduledCheckins, showCheckinPrompt]);

  useEffect(() => {
    if (!canPollScheduledCheckins) {
      return undefined;
    }

    void pollDriverCheckins();
    const intervalId = setInterval(() => {
      void pollDriverCheckins();
    }, CHECKIN_POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [canPollScheduledCheckins, pollDriverCheckins]);

  return <RoleTabNavigator tabs={driverTabs} />;
}
