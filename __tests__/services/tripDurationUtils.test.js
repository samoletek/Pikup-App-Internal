const { resolveActualTripDurationMinutes } = require('../../services/tripDurationUtils');

describe('tripDurationUtils', () => {
  test('returns persisted actual duration when present', () => {
    expect(resolveActualTripDurationMinutes({
      actual_duration_minutes: 19,
      picked_up_at: '2026-04-08T10:00:00.000Z',
      completed_at: '2026-04-08T10:45:00.000Z',
    })).toBe(19);
  });

  test('derives actual duration from pickup to completion timestamps', () => {
    expect(resolveActualTripDurationMinutes({
      picked_up_at: '2026-04-08T10:00:00.000Z',
      completed_at: '2026-04-08T10:26:30.000Z',
    })).toBe(27);
  });

  test('falls back to en route timestamp when picked up timestamp is missing', () => {
    expect(resolveActualTripDurationMinutes({
      en_route_to_dropoff_at: '2026-04-08T10:10:00.000Z',
      completed_at: '2026-04-08T10:30:10.000Z',
    })).toBe(21);
  });
});
