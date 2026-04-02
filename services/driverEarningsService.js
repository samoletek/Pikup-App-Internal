import { TRIP_STATUS } from '../constants/tripStatus';
import { mapTripFromDb } from './tripMapper';
import { getPlatformFees, resolveDriverPayoutAmount } from './PricingService';
import { logger } from './logger';
import { normalizeError } from './errorService';
import { fetchDriverRowById, updateDriverRowById } from './repositories/paymentRepository';
import {
  createRealtimeChannel,
  fetchTripsByDriverId,
  removeRealtimeChannel,
} from './repositories/tripRepository';

export const calculateDriverEarnings = async (totalAmount) => {
  const platformFees = await getPlatformFees();
  return resolveDriverPayoutAmount(totalAmount, platformFees);
};

export const getDriverTrips = async (driverId) => {
  if (!driverId) {
    logger.error('DriverEarningsService', 'Driver ID is required');
    return [];
  }

  try {
    logger.info('DriverEarningsService', 'Fetching trips for driver', { driverId });

    const { data, error } = await fetchTripsByDriverId({
      driverId,
      columns: '*',
      status: TRIP_STATUS.COMPLETED,
      ascending: false,
    });

    if (error) throw error;

    logger.info('DriverEarningsService', 'Completed trips fetched', {
      driverId,
      tripCount: data.length,
    });

    return Promise.all(data.map(async (trip) => {
      const mappedTrip = mapTripFromDb(trip);
      const driverEarnings = await calculateDriverEarnings({
        ...trip,
        pricing: mappedTrip?.pricing || trip?.pricing || {},
      });
      return {
        ...mappedTrip,
        driverEarnings,
        pricing: {
          ...(mappedTrip?.pricing || {}),
          total: parseFloat(trip.price || 0),
          driverPayout: driverEarnings,
        },
      };
    }));
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to load driver trips');
    logger.error('DriverEarningsService', 'Error getting driver trips', normalized, error);
    return [];
  }
};

export const getDriverStats = async (driverId) => {
  try {
    logger.info('DriverEarningsService', 'Getting driver stats', { driverId });

    const completedTrips = await getDriverTrips(driverId);
    let totalAssignedTrips = completedTrips.length;

    try {
      const { data: assignedTrips, error: assignedTripsError } = await fetchTripsByDriverId({
        driverId,
        columns: 'id',
        ascending: false,
      });

      if (assignedTripsError) throw assignedTripsError;
      totalAssignedTrips = Array.isArray(assignedTrips) ? assignedTrips.length : 0;
    } catch (assignedTripsError) {
      const normalized = normalizeError(
        assignedTripsError,
        'Could not load assigned trips for acceptance rate'
      );
      logger.warn(
        'DriverEarningsService',
        'Could not load assigned trips for acceptance rate, falling back to completed trips',
        normalized,
        assignedTripsError
      );
    }

    const now = new Date();
    const currentDay = now.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const mondayDate = new Date(now);
    mondayDate.setDate(now.getDate() + mondayOffset);
    mondayDate.setHours(0, 0, 0, 0);

    const thisWeekTrips = completedTrips.filter((trip) => {
      const tripDate = new Date(trip.created_at);
      return tripDate >= mondayDate;
    });

    const currentWeekTrips = thisWeekTrips.length;
    const weeklyEarnings = thisWeekTrips.reduce((sum, trip) => sum + (trip.driverEarnings || 0), 0);

    const totalTrips = completedTrips.length;
    const totalEarnings = completedTrips.reduce((sum, trip) => sum + (trip.driverEarnings || 0), 0);
    const acceptanceRate = totalAssignedTrips > 0
      ? Math.round((totalTrips / totalAssignedTrips) * 100)
      : 0;

    let driverProfile = {};
    try {
      const { data } = await fetchDriverRowById(driverId, '*', false);
      if (data) {
        driverProfile = { ...data, ...data.metadata };
      }
    } catch (_profileError) {
      logger.info('DriverEarningsService', 'No driver profile found, using defaults');
    }

    const parsedRatingCount = Number(driverProfile.rating_count);
    const ratingCount = Number.isFinite(parsedRatingCount) ? parsedRatingCount : 0;
    const parsedRating = Number(driverProfile.rating);
    const rating = ratingCount > 0 && Number.isFinite(parsedRating) ? parsedRating : 0;
    const totalPayouts = Number(driverProfile.totalPayouts || 0);
    const calculatedAvailableBalance = Number.isFinite(Number(driverProfile.availableBalance))
      ? Number(driverProfile.availableBalance)
      : Math.max(0, totalEarnings - totalPayouts);

    const stats = {
      currentWeekTrips,
      weeklyEarnings,
      totalTrips,
      totalEarnings,
      availableBalance: calculatedAvailableBalance,
      totalPayouts,
      rating,
      acceptanceRate,
      lastTripCompletedAt: completedTrips.length > 0 ? completedTrips[0].created_at : null,
    };

    logger.info('DriverEarningsService', 'Driver stats calculated', stats);
    return stats;
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to load driver stats');
    logger.error('DriverEarningsService', 'Error getting driver stats', normalized, error);
    return {
      currentWeekTrips: 0,
      weeklyEarnings: 0,
      totalTrips: 0,
      totalEarnings: 0,
      availableBalance: 0,
      rating: 0,
      acceptanceRate: 0,
      lastTripCompletedAt: null,
    };
  }
};

export const updateDriverEarnings = async (driverId, tripData) => {
  try {
    logger.info('DriverEarningsService', 'Updating driver earnings', { driverId });
    const tripEarnings = tripData.driverEarnings || await calculateDriverEarnings(tripData);

    const { data: profile } = await fetchDriverRowById(driverId, '*', false);

    const currentMeta = profile?.metadata || {};
    const currentEarnings = currentMeta.totalEarnings || 0;
    const currentTrips = currentMeta.totalTrips || 0;
    const currentPayouts = currentMeta.totalPayouts || 0;
    const nextTotalEarnings = Number((currentEarnings + tripEarnings).toFixed(2));
    const nextAvailableBalance = Number((Math.max(0, nextTotalEarnings - currentPayouts)).toFixed(2));

    const newMeta = {
      ...currentMeta,
      totalEarnings: nextTotalEarnings,
      availableBalance: nextAvailableBalance,
      totalTrips: currentTrips + 1,
      lastTripEarnings: tripEarnings,
      lastTripCompletedAt: new Date().toISOString(),
    };

    const driverUpdates = {
      metadata: newMeta,
    };

    if (profile && Object.prototype.hasOwnProperty.call(profile, 'completed_orders')) {
      driverUpdates.completed_orders = (profile?.completed_orders || 0) + 1;
    }

    const { data, error } = await updateDriverRowById(driverId, driverUpdates, true);

    if (error) throw error;
    return data;
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to update driver earnings');
    logger.error('DriverEarningsService', 'Error updating driver earnings', normalized, error);
    throw new Error(normalized.message);
  }
};

export const creditDriverTip = async (driverId, tipAmount) => {
  try {
    if (!driverId || !Number.isFinite(tipAmount) || tipAmount <= 0) {
      return;
    }

    logger.info('DriverEarningsService', 'Crediting tip to driver balance', { driverId, tipAmount });

    const { data: profile } = await fetchDriverRowById(driverId, '*', false);
    const currentMeta = profile?.metadata || {};
    const currentEarnings = currentMeta.totalEarnings || 0;
    const currentPayouts = currentMeta.totalPayouts || 0;
    const currentTips = currentMeta.totalTips || 0;
    const nextTotalEarnings = Number((currentEarnings + tipAmount).toFixed(2));
    const nextTotalTips = Number((currentTips + tipAmount).toFixed(2));
    const nextAvailableBalance = Number((Math.max(0, nextTotalEarnings - currentPayouts)).toFixed(2));

    const { error } = await updateDriverRowById(
      driverId,
      {
        metadata: {
          ...currentMeta,
          totalEarnings: nextTotalEarnings,
          totalTips: nextTotalTips,
          availableBalance: nextAvailableBalance,
          lastTipAt: new Date().toISOString(),
        },
      },
      true
    );

    if (error) throw error;
    logger.info('DriverEarningsService', 'Tip credited to driver balance', {
      driverId,
      tipAmount,
      nextAvailableBalance,
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to credit driver tip');
    logger.error('DriverEarningsService', 'Error crediting driver tip', normalized, error);
  }
};

export const subscribeToDriverEarningsUpdates = (driverId, onChange) => {
  if (!driverId) {
    return () => {};
  }

  const channelSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const handler = () => onChange?.();

  const tripsChannel = createRealtimeChannel(`driver:earnings:${driverId}:${channelSuffix}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'trips',
        filter: `driver_id=eq.${driverId}`,
      },
      handler
    )
    .subscribe();

  const driversChannel = createRealtimeChannel(`driver:profile:${driverId}:${channelSuffix}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'drivers',
        filter: `id=eq.${driverId}`,
      },
      handler
    )
    .subscribe();

  return () => {
    removeRealtimeChannel(tripsChannel);
    removeRealtimeChannel(driversChannel);
  };
};
