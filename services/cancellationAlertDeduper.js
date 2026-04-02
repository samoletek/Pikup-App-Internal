const ALERT_DEDUPE_WINDOW_MS = 15000;
const recentCancellationAlertKeys = new Map();

const compactExpiredKeys = (nowMs) => {
  for (const [key, timestamp] of recentCancellationAlertKeys.entries()) {
    if (nowMs - timestamp > ALERT_DEDUPE_WINDOW_MS) {
      recentCancellationAlertKeys.delete(key);
    }
  }
};

export const shouldShowCancellationAlert = ({ tripId, reason }) => {
  const normalizedTripId = String(tripId || '').trim();
  const normalizedReason = String(reason || '').trim().toLowerCase() || 'unknown';

  if (!normalizedTripId) {
    return true;
  }

  const nowMs = Date.now();
  compactExpiredKeys(nowMs);

  const key = `${normalizedTripId}:${normalizedReason}`;
  const lastShownAtMs = Number(recentCancellationAlertKeys.get(key) || 0);

  if (lastShownAtMs > 0 && nowMs - lastShownAtMs <= ALERT_DEDUPE_WINDOW_MS) {
    return false;
  }

  recentCancellationAlertKeys.set(key, nowMs);
  return true;
};
