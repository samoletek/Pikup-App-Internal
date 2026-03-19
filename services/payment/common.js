import { appConfig } from '../../config/appConfig';
import { fetchDriverRowById } from '../repositories/paymentRepository';

export const isNoRowsError = (error) => error?.code === 'PGRST116';

export const getUserId = (currentUser) => currentUser?.uid || currentUser?.id || null;

export const defaultOnboardingRefreshUrl = appConfig.stripe.onboardingRefreshUrl;
export const defaultOnboardingReturnUrl = appConfig.stripe.onboardingReturnUrl;

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
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return monthStart.toISOString();
  }

  const currentDay = now.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const mondayDate = new Date(now);
  mondayDate.setDate(now.getDate() + mondayOffset);
  mondayDate.setHours(0, 0, 0, 0);
  return mondayDate.toISOString();
};
