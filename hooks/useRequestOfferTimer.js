import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_REQUEST_TIMER_SECONDS,
} from '../screens/driver/DriverHomeScreen.utils';

const normalizeRequestId = (value) => String(value || '').trim();

const resolveOfferPresentationKey = (request) => {
  const requestId = normalizeRequestId(request?.id);
  if (!requestId) {
    return '';
  }

  const offeredAtRaw = (
    request?.dispatchOffer?.offeredAt ||
    request?.dispatchOffer?.offered_at ||
    request?.offeredAt ||
    request?.offered_at ||
    null
  );
  const offeredAtMs = new Date(offeredAtRaw || '').getTime();

  if (Number.isFinite(offeredAtMs)) {
    return `${requestId}:${offeredAtMs}`;
  }

  return requestId;
};

const resolveOfferTtlSeconds = (request) => {
  const candidates = [
    request?.dispatchOffer?.ttlSeconds,
    request?.dispatchOffer?.ttl_seconds,
    request?.ttlSeconds,
    request?.ttl_seconds,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }

  return DEFAULT_REQUEST_TIMER_SECONDS;
};

const resolveOfferExpiryMs = (request) => {
  const candidates = [
    request?.expiresAt,
    request?.expires_at,
    request?.dispatchOffer?.expiresAt,
    request?.dispatchOffer?.expires_at,
  ];

  for (const candidate of candidates) {
    const parsed = new Date(candidate || '').getTime();
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Number.NaN;
};

export default function useRequestOfferTimer({ incomingRequest, offerTimeoutRef }) {
  const requestTimerRef = useRef(null);
  const localOfferDeadlineRef = useRef(Number.NaN);
  const activeOfferKeyRef = useRef('');
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
      localOfferDeadlineRef.current = Number.NaN;
      activeOfferKeyRef.current = '';
      return undefined;
    }

    const offerPresentationKey = resolveOfferPresentationKey(incomingRequest);
    const offerTtlSeconds = resolveOfferTtlSeconds(incomingRequest);
    const hasNewOfferPresentation = (
      offerPresentationKey &&
      offerPresentationKey !== activeOfferKeyRef.current
    );
    activeOfferKeyRef.current = offerPresentationKey;

    const backendExpiryMs = resolveOfferExpiryMs(incomingRequest);
    if (Number.isFinite(backendExpiryMs)) {
      localOfferDeadlineRef.current = backendExpiryMs;
    } else if (
      hasNewOfferPresentation ||
      !Number.isFinite(localOfferDeadlineRef.current)
    ) {
      localOfferDeadlineRef.current = Date.now() + (offerTtlSeconds * 1000);
    }

    if (!Number.isFinite(localOfferDeadlineRef.current)) {
      localOfferDeadlineRef.current = Number.NaN;
    }

    const effectiveExpiryMs = Number.isFinite(localOfferDeadlineRef.current)
      ? localOfferDeadlineRef.current
      : Number.NaN;
    const initialRemainingSeconds = Number.isFinite(effectiveExpiryMs)
      ? Math.max(0, Math.ceil((effectiveExpiryMs - Date.now()) / 1000))
      : offerTtlSeconds;

    setRequestTimeRemaining(initialRemainingSeconds);
    setRequestTimerTotal(offerTtlSeconds);

    if (initialRemainingSeconds <= 0) {
      localOfferDeadlineRef.current = Number.NaN;
      setTimeout(() => offerTimeoutRef.current?.(), 0);
      return undefined;
    }

    requestTimerRef.current = setInterval(() => {
      setRequestTimeRemaining((prev) => {
        const nextRemaining = Number.isFinite(effectiveExpiryMs)
          ? Math.max(0, Math.ceil((effectiveExpiryMs - Date.now()) / 1000))
          : Math.max(0, prev - 1);

        if (nextRemaining <= 0) {
          clearInterval(requestTimerRef.current);
          requestTimerRef.current = null;
          localOfferDeadlineRef.current = Number.NaN;
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
