jest.mock('../../config/appConfig', () => ({
  appConfig: {
    dispatch: {
      maxDistanceAsapMiles: '15',
      maxDistanceScheduledMiles: '35',
      asapBatchRadiiMiles: '20,40,80,100',
      asapBatchIntervalSeconds: '60',
      requestSearchMaxHours: '10',
      scheduledLookaheadHours: '72',
      scheduledPastGraceMinutes: '5',
    },
  },
}));

jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
    },
  },
}));

jest.mock('../../services/repositories/tripRepository', () => ({
  invokeDriverRequestPool: jest.fn(),
}));

jest.mock('../../services/dispatch/scheduleConflicts', () => ({
  findDriverScheduleConflictForTrip: jest.fn().mockReturnValue(null),
}));

jest.mock('../../services/dispatch/requirements', () => ({
  resolveDispatchRequirements: jest.fn().mockReturnValue({}),
}));

const {
  REQUEST_POOLS,
  isTripOutsideSearchLifetime,
  getAsapDispatchRadiusMiles,
  getAsapDispatchWaveIndex,
  isTripOutsideDistanceWindow,
} = require('../../services/tripDispatchUtils');

const PICKUP = {
  latitude: 33.749,
  longitude: -84.388,
};

const createTrip = (createdAt) => ({
  createdAt,
  pickup: {
    coordinates: PICKUP,
  },
});

const createDriverLocationMilesNorth = (miles) => ({
  latitude: PICKUP.latitude + (miles / 69),
  longitude: PICKUP.longitude,
});

describe('tripDispatchUtils dispatch wave radius', () => {
  test('uses 20-mile radius in the first minute', () => {
    const nowDate = new Date('2026-04-15T12:00:00.000Z');
    const trip = createTrip(new Date(nowDate.getTime() - 30 * 1000).toISOString());

    expect(getAsapDispatchWaveIndex(trip, nowDate)).toBe(0);
    expect(getAsapDispatchRadiusMiles(trip, nowDate)).toBe(20);

    expect(isTripOutsideDistanceWindow({
      trip,
      requirements: { scheduleType: REQUEST_POOLS.ASAP },
      requestPool: REQUEST_POOLS.ASAP,
      driverLocation: createDriverLocationMilesNorth(25),
      nowDate,
    })).toBe(true);
  });

  test('expands to 40-mile radius after one minute', () => {
    const nowDate = new Date('2026-04-15T12:00:00.000Z');
    const trip = createTrip(new Date(nowDate.getTime() - 61 * 1000).toISOString());

    expect(getAsapDispatchWaveIndex(trip, nowDate)).toBe(1);
    expect(getAsapDispatchRadiusMiles(trip, nowDate)).toBe(40);

    expect(isTripOutsideDistanceWindow({
      trip,
      requirements: { scheduleType: REQUEST_POOLS.ASAP },
      requestPool: REQUEST_POOLS.ASAP,
      driverLocation: createDriverLocationMilesNorth(35),
      nowDate,
    })).toBe(false);
  });

  test('caps ASAP radius at 100 miles on final wave', () => {
    const nowDate = new Date('2026-04-15T12:00:00.000Z');
    const trip = createTrip(new Date(nowDate.getTime() - 10 * 60 * 1000).toISOString());

    expect(getAsapDispatchWaveIndex(trip, nowDate)).toBe(3);
    expect(getAsapDispatchRadiusMiles(trip, nowDate)).toBe(100);

    expect(isTripOutsideDistanceWindow({
      trip,
      requirements: { scheduleType: REQUEST_POOLS.ASAP },
      requestPool: REQUEST_POOLS.ASAP,
      driverLocation: createDriverLocationMilesNorth(95),
      nowDate,
    })).toBe(false);

    expect(isTripOutsideDistanceWindow({
      trip,
      requirements: { scheduleType: REQUEST_POOLS.ASAP },
      requestPool: REQUEST_POOLS.ASAP,
      driverLocation: createDriverLocationMilesNorth(120),
      nowDate,
    })).toBe(true);
  });

  test('applies the same wave radius to scheduled pool', () => {
    const nowDate = new Date('2026-04-15T12:00:00.000Z');
    const trip = createTrip(new Date(nowDate.getTime() - 20 * 1000).toISOString());

    expect(isTripOutsideDistanceWindow({
      trip,
      requirements: { scheduleType: REQUEST_POOLS.SCHEDULED },
      requestPool: REQUEST_POOLS.SCHEDULED,
      driverLocation: createDriverLocationMilesNorth(18),
      nowDate,
    })).toBe(false);

    expect(isTripOutsideDistanceWindow({
      trip,
      requirements: { scheduleType: REQUEST_POOLS.SCHEDULED },
      requestPool: REQUEST_POOLS.SCHEDULED,
      driverLocation: createDriverLocationMilesNorth(26),
      nowDate,
    })).toBe(true);
  });

  test('stops search after 10 hours', () => {
    const nowDate = new Date('2026-04-15T12:00:00.000Z');
    const oldTrip = createTrip(new Date(nowDate.getTime() - 10 * 60 * 60 * 1000 - 1000).toISOString());
    const freshTrip = createTrip(new Date(nowDate.getTime() - 2 * 60 * 60 * 1000).toISOString());

    expect(isTripOutsideSearchLifetime(oldTrip, nowDate)).toBe(true);
    expect(isTripOutsideSearchLifetime(freshTrip, nowDate)).toBe(false);
  });
});
