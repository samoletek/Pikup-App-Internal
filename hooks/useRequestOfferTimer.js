import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_REQUEST_TIMER_SECONDS,
  resolveRequestOfferExpiry,
} from '../screens/driver/DriverHomeScreen.utils';

export default function useRequestOfferTimer({ incomingRequest, offerTimeoutRef }) {
  const requestTimerRef = useRef(null);
  const [requestTimeRemaining, setRequestTimeRemaining] = useState(0);
  const [requestTimerTotal, setRequestTimerTotal] = useState(DEFAULT_REQUEST_TIMER_SECONDS);

  useEffect(() => {
    if (requestTimerRef.current) {
      clearInterval(requestTimerRef.current);
      requestTimerRef.current = null;
    }

    if (!incomingRequest) {
      setRequestTimeRemaining(0);
      setRequestTimerTotal(DEFAULT_REQUEST_TIMER_SECONDS);
      return undefined;
    }

    const requestExpiresAtMs = resolveRequestOfferExpiry(incomingRequest);
    const hasServerExpiry = Number.isFinite(requestExpiresAtMs);
    const initialRemainingSeconds = hasServerExpiry
      ? Math.max(0, Math.ceil((requestExpiresAtMs - Date.now()) / 1000))
      : DEFAULT_REQUEST_TIMER_SECONDS;

    setRequestTimeRemaining(initialRemainingSeconds);
    setRequestTimerTotal(
      hasServerExpiry
        ? Math.max(initialRemainingSeconds, 1)
        : DEFAULT_REQUEST_TIMER_SECONDS
    );

    if (initialRemainingSeconds <= 0) {
      setTimeout(() => offerTimeoutRef.current?.(), 0);
      return undefined;
    }

    requestTimerRef.current = setInterval(() => {
      setRequestTimeRemaining((prev) => {
        const nextRemaining = hasServerExpiry
          ? Math.max(0, Math.ceil((requestExpiresAtMs - Date.now()) / 1000))
          : Math.max(0, prev - 1);

        if (nextRemaining <= 0) {
          clearInterval(requestTimerRef.current);
          requestTimerRef.current = null;
          setTimeout(() => offerTimeoutRef.current?.(), 0);
          return 0;
        }

        return nextRemaining;
      });
    }, 1000);

    return () => {
      if (requestTimerRef.current) {
        clearInterval(requestTimerRef.current);
        requestTimerRef.current = null;
      }
    };
  }, [incomingRequest, offerTimeoutRef]);

  return {
    requestTimeRemaining,
    requestTimerTotal,
  };
}
