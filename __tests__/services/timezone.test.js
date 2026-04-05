const {
  resolveAtlantaMonthStartIso,
  resolveAtlantaWeekStartIso,
  resolveAtlantaWeekStartKey,
  resolveAtlantaWeekdayIndex,
} = require('../../services/timezone');

describe('services/timezone', () => {
  test('uses Atlanta week boundary around UTC day crossover', () => {
    expect(resolveAtlantaWeekStartKey('2026-04-06T02:30:00.000Z')).toBe('2026-03-30');
    expect(resolveAtlantaWeekStartKey('2026-04-06T05:30:00.000Z')).toBe('2026-04-06');
  });

  test('returns Atlanta weekday index with Monday as 0', () => {
    expect(resolveAtlantaWeekdayIndex('2026-04-06T05:30:00.000Z')).toBe(0);
    expect(resolveAtlantaWeekdayIndex('2026-04-06T02:30:00.000Z')).toBe(6);
  });

  test('returns week and month period starts at Atlanta midnight converted to UTC', () => {
    expect(resolveAtlantaWeekStartIso('2026-04-08T12:00:00.000Z')).toBe('2026-04-06T04:00:00.000Z');
    expect(resolveAtlantaMonthStartIso('2026-04-08T12:00:00.000Z')).toBe('2026-04-01T04:00:00.000Z');
  });
});
