jest.mock('../../services/repositories/paymentRepository', () => ({
  fetchDriverRowById: jest.fn(),
}));

const { periodStartIso } = require('../../services/payment/common');

describe('payment/common.periodStartIso', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('returns Atlanta week start midnight for weekly period', () => {
    expect(periodStartIso('week')).toBe('2026-04-06T04:00:00.000Z');
  });

  test('returns Atlanta month start midnight for monthly period', () => {
    expect(periodStartIso('month')).toBe('2026-04-01T04:00:00.000Z');
  });
});
