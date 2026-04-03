const {
  buildDispatchRequirementsFromRequest,
} = require('../../services/dispatch/requirements');

describe('dispatch requirements duration estimates', () => {
  test('preserves explicit duration from pricing payload', () => {
    const requirements = buildDispatchRequirementsFromRequest({
      pricing: {
        distance: 7.8,
        durationMinutes: 42,
      },
      items: [{ name: 'Sofa', weight: 110 }],
    });

    expect(requirements.estimatedDistanceMiles).toBe(7.8);
    expect(requirements.estimatedDurationMinutes).toBe(42);
  });

  test('derives duration when explicit route time is missing', () => {
    const requirements = buildDispatchRequirementsFromRequest({
      pricing: {
        distance: 4.9,
      },
      items: [{ name: 'Side Table', weight: 30 }],
    });

    expect(requirements.estimatedDurationMinutes).toBe(48);
  });
});
