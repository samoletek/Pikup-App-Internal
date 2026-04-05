jest.mock('../../../config/appConfig', () => ({
  isDriverReadinessBypassEnabled: jest.fn(() => false),
}));

const { resolveDriverOnboardingUiState } = require('../../../screens/driver/DriverHomeScreen.utils');

describe('DriverHomeScreen.utils.resolveDriverOnboardingUiState', () => {
  test('keeps onboarding banner visible while payout account is under review', () => {
    const uiState = resolveDriverOnboardingUiState({
      metadata: {
        onboardingStatus: 'under_review',
      },
      onboarding_complete: true,
      can_receive_payments: false,
    });

    expect(uiState).toEqual(
      expect.objectContaining({
        showOnboardingRequiredBanner: true,
      })
    );
  });

  test('hides onboarding banner only when payouts are enabled', () => {
    const uiState = resolveDriverOnboardingUiState({
      metadata: {
        onboardingStatus: 'verified',
      },
      can_receive_payments: true,
    });

    expect(uiState).toEqual(
      expect.objectContaining({
        showOnboardingRequiredBanner: false,
      })
    );
  });

  test('keeps onboarding banner visible when status is active but payouts are still disabled', () => {
    const uiState = resolveDriverOnboardingUiState({
      metadata: {
        onboardingStatus: 'active',
      },
      can_receive_payments: false,
    });

    expect(uiState).toEqual(
      expect.objectContaining({
        showOnboardingRequiredBanner: true,
      })
    );
  });
});
