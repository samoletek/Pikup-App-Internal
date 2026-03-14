import {
  CLAIM_WORKFLOW_STATUS,
  mapEligibleTripsForClaims,
  normalizeClaimWorkflowStatus,
  splitClaimsByState,
} from '../../services/ClaimsService';

jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe('ClaimsService', () => {
  test('normalizes external claim statuses to workflow statuses', () => {
    expect(normalizeClaimWorkflowStatus('pending')).toBe(CLAIM_WORKFLOW_STATUS.FILED);
    expect(normalizeClaimWorkflowStatus('in_progress')).toBe(CLAIM_WORKFLOW_STATUS.PROCESSING);
    expect(normalizeClaimWorkflowStatus('UNDER_REVIEW')).toBe(CLAIM_WORKFLOW_STATUS.REVIEW);
    expect(normalizeClaimWorkflowStatus('closed')).toBe(CLAIM_WORKFLOW_STATUS.COMPLETED);
    expect(normalizeClaimWorkflowStatus('unknown')).toBe(CLAIM_WORKFLOW_STATUS.FILED);
  });

  test('splits ongoing and completed claims correctly', () => {
    const claims = [
      {
        id: 'c1',
        status: 'PENDING',
        loss_description: 'Damaged monitor',
        created_at: '2026-03-01T10:00:00.000Z',
      },
      {
        id: 'c2',
        status: 'COMPLETED',
        loss_description: 'Broken table',
        created_at: '2026-03-02T10:00:00.000Z',
        updated_at: '2026-03-03T10:00:00.000Z',
      },
    ];

    const { ongoing, completed } = splitClaimsByState(claims);

    expect(ongoing).toHaveLength(1);
    expect(completed).toHaveLength(1);
    expect(ongoing[0].workflowStatus).toBe(CLAIM_WORKFLOW_STATUS.FILED);
    expect(completed[0].workflowStatus).toBe(CLAIM_WORKFLOW_STATUS.COMPLETED);
    expect(completed[0].resolution).toBe('Resolved');
  });

  test('maps only completed insured trips eligible for claims', () => {
    const requests = [
      {
        id: 'trip_ok',
        status: 'completed',
        insurance: {
          included: true,
          bookingId: 'book_1',
          quoteId: 'quote_1',
        },
        itemValue: '120',
        pickup: { address: 'A' },
        dropoff: { address: 'B' },
        item: { description: 'Laptop' },
        pricing: { total: 49.99 },
        completedAt: '2026-03-03T10:00:00.000Z',
      },
      {
        id: 'trip_no_insurance',
        status: 'completed',
        insurance: { included: false },
      },
      {
        id: 'trip_not_completed',
        status: 'pending',
        insurance: { included: true, bookingId: 'book_x' },
      },
    ];

    const result = mapEligibleTripsForClaims(requests);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trip_ok');
    expect(result[0].bookingId).toBe('book_1');
    expect(result[0].quoteId).toBe('quote_1');
    expect(result[0].insuranceValue).toBe(120);
  });
});
