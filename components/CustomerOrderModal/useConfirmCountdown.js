import { useCallback, useEffect, useRef, useState } from 'react';

export default function useConfirmCountdown() {
  const [confirmCountdown, setConfirmCountdown] = useState(0);
  const timerRef = useRef(null);
  const resolveRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (!timerRef.current) {
      return;
    }

    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const resolvePending = useCallback((wasCancelled) => {
    if (!resolveRef.current) {
      return;
    }

    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve(wasCancelled);
  }, []);

  const finishCountdown = useCallback((wasCancelled) => {
    clearTimer();
    setConfirmCountdown(0);
    resolvePending(wasCancelled);
  }, [clearTimer, resolvePending]);

  const cancelCountdown = useCallback(() => {
    finishCountdown(true);
  }, [finishCountdown]);

  const skipCountdown = useCallback(() => {
    finishCountdown(false);
  }, [finishCountdown]);

  const resetCountdown = useCallback(() => {
    finishCountdown(true);
  }, [finishCountdown]);

  const startCountdown = useCallback((countdownSeconds) => {
    resetCountdown();
    setConfirmCountdown(countdownSeconds);

    return new Promise((resolve) => {
      resolveRef.current = resolve;
      let remaining = countdownSeconds;

      timerRef.current = setInterval(() => {
        remaining -= 1;
        setConfirmCountdown(remaining);

        if (remaining <= 0) {
          clearTimer();
          resolvePending(false);
        }
      }, 1000);
    });
  }, [clearTimer, resetCountdown, resolvePending]);

  useEffect(() => {
    return () => {
      resetCountdown();
    };
  }, [resetCountdown]);

  return {
    confirmCountdown,
    startCountdown,
    cancelCountdown,
    skipCountdown,
    resetCountdown,
  };
}
