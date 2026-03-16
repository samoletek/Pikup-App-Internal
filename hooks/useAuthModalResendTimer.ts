import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

type SetStateNumber = Dispatch<SetStateAction<number>>;

export default function useAuthModalResendTimer(
  resendTimer: number,
  setResendTimer: SetStateNumber,
) {
  useEffect(() => {
    if (resendTimer <= 0) return undefined;

    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [resendTimer, setResendTimer]);
}
