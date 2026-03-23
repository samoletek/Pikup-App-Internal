import { useEffect, useMemo, useState } from 'react';
import { shouldRenderRequestTimer } from '../components/requestModal/requestModalUtils';

const EMPTY_REQUESTS = Object.freeze([]);
const EMPTY_TIMERS = Object.freeze({});

const formatTimer = (timeLeftMs) => {
  const minutes = Math.floor(timeLeftMs / (1000 * 60));
  const seconds = Math.floor((timeLeftMs % (1000 * 60)) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const timersEqual = (left, right) => {
  if (left === right) {
    return true;
  }

  const leftKeys = Object.keys(left || {});
  const rightKeys = Object.keys(right || {});
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
};

export default function useRequestModalTimers({ visible, requests = EMPTY_REQUESTS }) {
  const [timers, setTimers] = useState(EMPTY_TIMERS);

  const hasTimedRequests = useMemo(
    () => requests.some((request) => shouldRenderRequestTimer(request)),
    [requests]
  );

  useEffect(() => {
    if (!visible || requests.length === 0 || !hasTimedRequests) {
      setTimers((prev) => (Object.keys(prev).length === 0 ? prev : EMPTY_TIMERS));
      return undefined;
    }

    const updateTimers = () => {
      const now = new Date();
      const nextTimers = {};

      requests.forEach((request) => {
        if (!shouldRenderRequestTimer(request)) {
          return;
        }

        const expiryTime = new Date(request.expiresAt);
        const timeLeft = Math.max(0, expiryTime - now);
        nextTimers[request.id] = timeLeft > 0 ? formatTimer(timeLeft) : 'Expired';
      });

      setTimers((prev) => (timersEqual(prev, nextTimers) ? prev : nextTimers));
    };

    updateTimers();
    const intervalId = setInterval(updateTimers, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [hasTimedRequests, requests, visible]);

  return timers;
}
