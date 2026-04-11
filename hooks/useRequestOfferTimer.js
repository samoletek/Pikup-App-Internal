import { useEffect, useRef, useState } from 'react';
import { getTripScheduledAtMs } from '../constants/tripStatus';
import {
  DEFAULT_REQUEST_TIMER_SECONDS,
  resolveRequestOfferExpiry,
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

const isScheduledRequest = (request) => Number.isFinite(getTripScheduledAtMs(request));

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
    const scheduledRequest = isScheduledRequest(incomingRequest);
    const requestExpiresAtMs = resolveRequestOfferExpiry(incomingRequest);
    const hasServerExpiry = Number.isFinite(requestExpiresAtMs);
    const hasNewOfferPresentation = (
      offerPresentationKey &&
      offerPresentationKey !== activeOfferKeyRef.current
    );

    if (!scheduledRequest) {
      if (hasServerExpiry) {
        localOfferDeadlineRef.current = Number.NaN;
      } else if (hasNewOfferPresentation || !Number.isFinite(localOfferDeadlineRef.current)) {
        localOfferDeadlineRef.current = Date.now() + (DEFAULT_REQUEST_TIMER_SECONDS * 1000);
      }
    } else {
      localOfferDeadlineRef.current = Number.NaN;
    }
    activeOfferKeyRef.current = offerPresentationKey;

    const hasEffectiveLocalExpiry = Number.isFinite(localOfferDeadlineRef.current);
    const effectiveExpiryMs = hasServerExpiry
      ? requestExpiresAtMs
      : hasEffectiveLocalExpiry
        ? localOfferDeadlineRef.current
        : Number.NaN;
    const hasEffectiveExpiry = Number.isFinite(effectiveExpiryMs);
    const initialRemainingSeconds = hasEffectiveExpiry
      ? Math.max(0, Math.ceil((effectiveExpiryMs - Date.now()) / 1000))
      : DEFAULT_REQUEST_TIMER_SECONDS;

    setRequestTimeRemaining(initialRemainingSeconds);
    setRequestTimerTotal(
      hasEffectiveExpiry
        ? Math.max(initialRemainingSeconds, 1)
        : DEFAULT_REQUEST_TIMER_SECONDS
    );

    if (initialRemainingSeconds <= 0) {
      localOfferDeadlineRef.current = Number.NaN;
      setTimeout(() => offerTimeoutRef.current?.(), 0);
      return undefined;
    }

    requestTimerRef.current = setInterval(() => {
      setRequestTimeRemaining((prev) => {
        const nextRemaining = hasEffectiveExpiry
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
