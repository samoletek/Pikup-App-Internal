import { useEffect, useMemo, useState } from 'react';
import { shouldRenderRequestTimer } from '../components/requestModal/requestModalUtils';

const formatTimer = (timeLeftMs) => {
  const minutes = Math.floor(timeLeftMs / (1000 * 60));
  const seconds = Math.floor((timeLeftMs % (1000 * 60)) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function useRequestModalTimers({ visible, requests = [] }) {
  const [timers, setTimers] = useState({});

  const hasTimedRequests = useMemo(
    () => requests.some((request) => shouldRenderRequestTimer(request)),
    [requests]
  );

  useEffect(() => {
    if (!visible || requests.length === 0 || !hasTimedRequests) {
      setTimers((previousTimers) => (
        Object.keys(previousTimers).length === 0 ? previousTimers : {}
      ));
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

      setTimers((previousTimers) => {
        const previousKeys = Object.keys(previousTimers);
        const nextKeys = Object.keys(nextTimers);
        if (previousKeys.length !== nextKeys.length) {
          return nextTimers;
        }

        for (const key of nextKeys) {
          if (previousTimers[key] !== nextTimers[key]) {
            return nextTimers;
          }
        }

        return previousTimers;
      });
    };

    updateTimers();
    const intervalId = setInterval(updateTimers, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [hasTimedRequests, requests, visible]);

  return timers;
}
