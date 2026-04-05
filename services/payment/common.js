import { fetchDriverRowById } from '../repositories/paymentRepository';
import { resolveAtlantaMonthStartIso, resolveAtlantaWeekStartIso } from '../timezone';

export const isNoRowsError = (error) => error?.code === 'PGRST116';

export const getUserId = (currentUser) => currentUser?.uid || currentUser?.id || null;

export const defaultOnboardingRefreshUrl = 'https://pikup-app.com';
export const defaultOnboardingReturnUrl = 'https://pikup-app.com';

export const getDriverProfileRow = async (driverId) => {
  if (!driverId) return null;
  const { data, error } = await fetchDriverRowById(driverId);

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return data || null;
};

export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const periodStartIso = (period = 'week') => {
  const now = new Date();
  if (period === 'month') {
    return resolveAtlantaMonthStartIso(now);
  }

  return resolveAtlantaWeekStartIso(now);
};
