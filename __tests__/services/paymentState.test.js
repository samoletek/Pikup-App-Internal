const {
  mergeDriverOnboardingStatus,
  normalizeDriverPaymentState,
  shouldRefreshDriverPaymentStatus,
} = require('../../services/payment/paymentState');

describe('paymentState', () => {
  test('normalizes payout fields from driver profile columns and metadata', () => {
    const state = normalizeDriverPaymentState({
      stripe_account_id: 'acct_123',
      metadata: {
        onboardingStatus: 'review',
        onboardingRequirements: ['external_account'],
      },
    });

    expect(state).toEqual(
      expect.objectContaining({
        connectAccountId: 'acct_123',
        canReceivePayments: false,
        onboardingComplete: false,
        onboardingStatus: 'under_review',
        onboardingRequirements: ['external_account'],
        connectAccountCreated: true,
      })
    );
  });

  test('merges live onboarding check result into normalized driver state', () => {
    const state = mergeDriverOnboardingStatus(
      {
        stripe_account_id: 'acct_123',
        metadata: {
          onboardingStatus: 'action_required',
        },
      },
      {
        success: true,
        accountId: 'acct_123',
        onboardingComplete: true,
        canReceivePayments: true,
        status: 'verified',
        requirements: [],
      }
    );

    expect(state).toEqual(
      expect.objectContaining({
        connectAccountId: 'acct_123',
        canReceivePayments: true,
        onboardingComplete: true,
        onboardingStatus: 'verified',
        onboardingRequirements: [],
      })
    );
  });

  test('refreshes Stripe status when account exists or onboarding is in progress', () => {
    expect(shouldRefreshDriverPaymentStatus({ stripe_account_id: 'acct_123' })).toBe(true);
    expect(
      shouldRefreshDriverPaymentStatus({
        metadata: {
          onboardingStatus: 'action_required',
        },
      })
    ).toBe(true);
    expect(shouldRefreshDriverPaymentStatus({})).toBe(false);
  });
});
