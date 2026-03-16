import { TRIP_STATUS, normalizeTripStatus } from '../constants/tripStatus';
import { logger } from './logger';
import { normalizeError } from './errorService';
import { failureResult, successResult } from './contracts/result';
import { fetchClaimsByUserId, invokeSubmitClaim } from './repositories/claimsRepository';

export const CLAIM_WORKFLOW_STATUS = Object.freeze({
  FILED: 'filed',
  PROCESSING: 'processing',
  REVIEW: 'review',
  COMPLETED: 'completed',
});

export const CLAIM_WORKFLOW_LABELS = Object.freeze({
  [CLAIM_WORKFLOW_STATUS.FILED]: 'Claim Filed',
  [CLAIM_WORKFLOW_STATUS.PROCESSING]: 'Processing',
  [CLAIM_WORKFLOW_STATUS.REVIEW]: 'Under Review',
  [CLAIM_WORKFLOW_STATUS.COMPLETED]: 'Completed',
});

const CLAIM_WORKFLOW_PROGRESS = Object.freeze({
  [CLAIM_WORKFLOW_STATUS.FILED]: 20,
  [CLAIM_WORKFLOW_STATUS.PROCESSING]: 50,
  [CLAIM_WORKFLOW_STATUS.REVIEW]: 75,
  [CLAIM_WORKFLOW_STATUS.COMPLETED]: 100,
});

const CLAIM_STATUS_TO_WORKFLOW_MAP = Object.freeze({
  SUBMITTED: CLAIM_WORKFLOW_STATUS.FILED,
  PENDING: CLAIM_WORKFLOW_STATUS.FILED,
  IN_PROGRESS: CLAIM_WORKFLOW_STATUS.PROCESSING,
  INVESTIGATING: CLAIM_WORKFLOW_STATUS.PROCESSING,
  UNDER_REVIEW: CLAIM_WORKFLOW_STATUS.REVIEW,
  COMPLETED: CLAIM_WORKFLOW_STATUS.COMPLETED,
  CLOSED: CLAIM_WORKFLOW_STATUS.COMPLETED,
});

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : '';
};

export const normalizeClaimWorkflowStatus = (status) => {
  const normalized = String(status || '').trim().toUpperCase();
  return CLAIM_STATUS_TO_WORKFLOW_MAP[normalized] || CLAIM_WORKFLOW_STATUS.FILED;
};

export const toClaimWorkflowProgress = (workflowStatus) =>
  CLAIM_WORKFLOW_PROGRESS[workflowStatus] || CLAIM_WORKFLOW_PROGRESS[CLAIM_WORKFLOW_STATUS.FILED];

const toClaimItem = (claim) => {
  const workflowStatus = normalizeClaimWorkflowStatus(claim?.status);
  return {
    id: claim.id,
    bookingId: claim.booking_id,
    date: formatDate(claim.created_at || claim.loss_date),
    status: claim.status,
    workflowStatus,
    progress: toClaimWorkflowProgress(workflowStatus),
    item: claim.loss_description || 'Item',
    description: claim.loss_description,
    amount: claim.estimated_value ? `$${claim.estimated_value}` : 'Pending',
    lossDate: claim.loss_date,
    claimantName: claim.claimant_name,
    claimantEmail: claim.claimant_email,
    rawClaim: claim,
  };
};

export const splitClaimsByState = (claims = []) => {
  const ongoing = [];
  const completed = [];

  (Array.isArray(claims) ? claims : []).forEach((claim) => {
    const claimItem = toClaimItem(claim);
    const isCompleted = claimItem.workflowStatus === CLAIM_WORKFLOW_STATUS.COMPLETED;

    if (isCompleted) {
      completed.push({
        ...claimItem,
        resolution: claim.resolution || 'Resolved',
        completedDate: formatDate(claim.updated_at || claim.created_at),
      });
    } else {
      ongoing.push(claimItem);
    }
  });

  return { ongoing, completed };
};

export const fetchClaimsForUser = async (userId) => {
  try {
    if (!userId) {
      return successResult({ ongoingClaims: [], completedClaims: [] });
    }

    const { data, error } = await fetchClaimsByUserId(userId);

    if (error) {
      const normalized = normalizeError(error, 'Failed to load claims history');
      logger.error('ClaimsService', 'fetchClaimsForUser failed', normalized, error);
      return failureResult(normalized.message, normalized.code || null, {
        ongoingClaims: [],
        completedClaims: [],
      });
    }

    const { ongoing, completed } = splitClaimsByState(data || []);
    return successResult({
      ongoingClaims: ongoing,
      completedClaims: completed,
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to load claims history');
    logger.error('ClaimsService', 'fetchClaimsForUser failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null, {
      ongoingClaims: [],
      completedClaims: [],
    });
  }
};

export const mapEligibleTripsForClaims = (requests = []) => {
  return (Array.isArray(requests) ? requests : [])
    .filter((request) => {
      const status = normalizeTripStatus(request?.status);
      return (
        status === TRIP_STATUS.COMPLETED &&
        request?.insurance &&
        request.insurance.included &&
        request.insurance.bookingId
      );
    })
    .map((request) => {
      const parsedInsuranceValue = Number(request.itemValue);
      const insuranceValue =
        Number.isFinite(parsedInsuranceValue) && parsedInsuranceValue > 0 ? parsedInsuranceValue : null;

      return {
        id: request.id,
        date: formatDate(request.completedAt || request.createdAt),
        pickup: request.pickup?.address || 'Pickup Location',
        dropoff: request.dropoff?.address || 'Dropoff Location',
        item: request.item?.description || 'Items',
        driver: 'Driver',
        amount: `${request.pricing?.total || '0.00'}`,
        insuranceValue,
        bookingId: request.insurance.bookingId,
        quoteId: request.insurance.quoteId,
      };
    });
};

export const submitClaimRequest = async ({
  selectedTrip,
  claimType,
  claimDescription,
  currentUser,
  selectedDocuments = [],
}) => {
  try {
    if (!selectedTrip?.bookingId) {
      return failureResult('Delivery does not contain insurance booking details.');
    }

    const { data, error } = await invokeSubmitClaim({
      bookingId: selectedTrip.bookingId,
      lossType: claimType,
      lossDate: new Date().toISOString().split('T')[0],
      lossDescription: claimDescription,
      lossEstimatedClaimValue: Number.isFinite(Number(selectedTrip.insuranceValue))
        ? Number(selectedTrip.insuranceValue)
        : null,
      claimantName: currentUser?.displayName || currentUser?.email || null,
      claimantEmail: currentUser?.email || null,
      documentTypes: (Array.isArray(selectedDocuments) ? selectedDocuments : []).map(
        (doc) => doc.documentType
      ),
    });

    if (error) {
      const normalized = normalizeError(error, 'Failed to submit claim. Please try again.');
      logger.error('ClaimsService', 'submitClaimRequest failed', normalized, error);
      return failureResult(normalized.message, normalized.code || null);
    }
    return successResult({ data });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to submit claim. Please try again.');
    logger.error('ClaimsService', 'submitClaimRequest failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};
