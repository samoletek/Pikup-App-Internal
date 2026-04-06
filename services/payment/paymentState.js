const toPlainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
};

const firstDefinedBoolean = (...candidates) => {
  for (const candidate of candidates) {
    if (typeof candidate === 'boolean') {
      return candidate;
    }
  }

  return false;
};

const firstNonEmptyString = (...candidates) => {
  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const normalizeStatusToken = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  if (normalized === 'review') return 'under_review';
  if (normalized === 'verified' || normalized === 'active') return 'verified';
  if (normalized === 'requires_action' || normalized === 'incomplete') return 'action_required';
  if (normalized === 'missing' || normalized === 'not_started') return 'missing_account';

  return normalized;
};

const normalizeList = (value) => {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
};

export const normalizeDriverPaymentState = (profile = {}) => {
  const normalizedProfile = toPlainObject(profile);
  const metadata = toPlainObject(normalizedProfile.metadata);

  const connectAccountId = firstNonEmptyString(
    normalizedProfile.connectAccountId,
    normalizedProfile.stripe_account_id,
    normalizedProfile.stripeAccountId,
    metadata.connectAccountId,
  );

  const canReceivePayments = firstDefinedBoolean(
    normalizedProfile.canReceivePayments,
    normalizedProfile.can_receive_payments,
    metadata.canReceivePayments,
  );

  const onboardingComplete = firstDefinedBoolean(
    normalizedProfile.onboardingComplete,
    normalizedProfile.onboarding_complete,
    metadata.onboardingComplete,
  );

  const payoutsEnabled = firstDefinedBoolean(
    normalizedProfile.payoutsEnabled,
    normalizedProfile.payouts_enabled,
    metadata.payoutsEnabled,
  );

  const detailsSubmitted = firstDefinedBoolean(
    normalizedProfile.detailsSubmitted,
    normalizedProfile.details_submitted,
    metadata.detailsSubmitted,
  );

  const transfersCapability = firstNonEmptyString(
    normalizedProfile.transfersCapability,
    normalizedProfile.transfers_capability,
    metadata.transfersCapability,
  );

  const disabledReason = firstNonEmptyString(
    normalizedProfile.onboardingDisabledReason,
    normalizedProfile.onboarding_disabled_reason,
    metadata.onboardingDisabledReason,
  );

  const requirements = normalizeList(
    normalizedProfile.onboardingRequirements ||
    normalizedProfile.onboarding_requirements ||
    metadata.onboardingRequirements ||
    normalizedProfile.requirements,
  );

  const rawStatus = normalizeStatusToken(
    normalizedProfile.onboardingStatus ||
    normalizedProfile.onboarding_status ||
    metadata.onboardingStatus,
  );

  let onboardingStatus = rawStatus;
  if (canReceivePayments) {
    onboardingStatus = 'verified';
  } else if (!onboardingStatus) {
    onboardingStatus = connectAccountId
      ? (onboardingComplete ? 'under_review' : 'action_required')
      : 'missing_account';
  }

  return {
    ...normalizedProfile,
    metadata,
    connectAccountId,
    canReceivePayments,
    onboardingComplete,
    payoutsEnabled,
    detailsSubmitted,
    transfersCapability,
    onboardingStatus,
    onboardingRequirements: requirements,
    disabledReason,
    connectAccountCreated: Boolean(connectAccountId),
  };
};

export const shouldRefreshDriverPaymentStatus = (paymentState = {}) => {
  const normalizedState = normalizeDriverPaymentState(paymentState);
  return Boolean(
    normalizedState.connectAccountId ||
    normalizedState.onboardingComplete ||
    normalizedState.onboardingStatus === 'under_review' ||
    normalizedState.onboardingStatus === 'action_required'
  );
};

export const mergeDriverOnboardingStatus = (profile = {}, onboardingResult = {}) => {
  const normalizedProfile = toPlainObject(profile);
  const metadata = toPlainObject(normalizedProfile.metadata);
  const checkedAt = new Date().toISOString();
  const nextAccountId =
    firstNonEmptyString(onboardingResult.connectAccountId, onboardingResult.accountId) ||
    firstNonEmptyString(normalizedProfile.stripe_account_id, metadata.connectAccountId);

  return normalizeDriverPaymentState({
    ...normalizedProfile,
    stripe_account_id: nextAccountId,
    can_receive_payments: Boolean(onboardingResult.canReceivePayments),
    onboarding_complete: Boolean(onboardingResult.onboardingComplete),
    metadata: {
      ...metadata,
      connectAccountId: nextAccountId,
      canReceivePayments: Boolean(onboardingResult.canReceivePayments),
      onboardingComplete: Boolean(onboardingResult.onboardingComplete),
      onboardingStatus: firstNonEmptyString(onboardingResult.status, metadata.onboardingStatus),
      onboardingRequirements: normalizeList(
        onboardingResult.requirements || metadata.onboardingRequirements
      ),
      onboardingDisabledReason:
        firstNonEmptyString(onboardingResult.disabledReason, metadata.onboardingDisabledReason),
      transfersCapability:
        firstNonEmptyString(onboardingResult.transfersCapability, metadata.transfersCapability),
      payoutsEnabled: firstDefinedBoolean(onboardingResult.payoutsEnabled, metadata.payoutsEnabled),
      detailsSubmitted: firstDefinedBoolean(onboardingResult.detailsSubmitted, metadata.detailsSubmitted),
      onboardingRequirementsByBucket: {
        currentlyDue: normalizeList(onboardingResult.currentlyDue),
        pastDue: normalizeList(onboardingResult.pastDue),
        eventuallyDue: normalizeList(onboardingResult.eventuallyDue),
        pendingVerification: normalizeList(onboardingResult.pendingVerification),
      },
      onboardingLastCheckedAt: checkedAt,
    },
  });
};
