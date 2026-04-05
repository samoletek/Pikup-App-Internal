import { formatDistance } from '../../../screens/driver/navigationMath.utils';

describe('navigationMath.formatDistance', () => {
  test('formats short distances in feet', () => {
    expect(formatDistance(120)).toBe('394 ft');
  });

  test('formats longer distances in miles', () => {
    expect(formatDistance(1609.344)).toBe('1.0 mi');
  });

  test('returns fallback text for invalid distance', () => {
    expect(formatDistance(Number.NaN)).toBe('Calculating...');
  });
});
