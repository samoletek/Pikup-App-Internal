import {
  TRIP_STATUS,
  getTripScheduledAtMs,
  isActiveTripStatus,
  normalizeTripStatus,
  toDbTripStatus,
} from "../../constants/tripStatus";

describe("tripStatus", () => {
  test("normalizes snake_case aliases into app status format", () => {
    expect(normalizeTripStatus("in_progress")).toBe(TRIP_STATUS.IN_PROGRESS);
    expect(normalizeTripStatus("arrived_at_dropoff")).toBe(TRIP_STATUS.ARRIVED_AT_DROPOFF);
  });

  test("falls back to pending for invalid input", () => {
    expect(normalizeTripStatus("")).toBe(TRIP_STATUS.PENDING);
    expect(normalizeTripStatus(null)).toBe(TRIP_STATUS.PENDING);
  });

  test("maps app statuses to DB statuses", () => {
    expect(toDbTripStatus(TRIP_STATUS.PICKED_UP)).toBe("picked_up");
    expect(toDbTripStatus("accepted")).toBe("accepted");
  });

  test("detects active vs non-active statuses", () => {
    expect(isActiveTripStatus("accepted")).toBe(true);
    expect(isActiveTripStatus("completed")).toBe(false);
  });

  test("resolves scheduled timestamp from nested dispatch requirements fallback fields", () => {
    const timestamp = getTripScheduledAtMs({
      originalData: {
        dispatch_requirements: {
          scheduledTime: '2026-04-10T15:30:00.000Z',
        },
      },
    });

    expect(timestamp).toBe(new Date('2026-04-10T15:30:00.000Z').getTime());
  });
});
