import { TRIP_STATUS } from '../../constants/tripStatus';
import {
  ensureOrderCanBeCancelled,
  getCancellationInfoFromOrder,
  resolveCancellationActorRole,
  resolveOrderCustomerId,
} from '../../services/tripCancellationUtils';

jest.mock('../../services/repositories/tripRepository', () => ({
  updateTripById: jest.fn(),
}));

const createOrder = (status, total = 120, extra = {}) => ({
  status,
  pricing: { total },
  ...extra,
});

describe('tripCancellationUtils', () => {
  test.each([
    TRIP_STATUS.PENDING,
    TRIP_STATUS.ACCEPTED,
    TRIP_STATUS.IN_PROGRESS,
  ])('ensureOrderCanBeCancelled allows status %s', (status) => {
    expect(ensureOrderCanBeCancelled(createOrder(status))).toBe(status);
  });

  test.each([
    TRIP_STATUS.ARRIVED_AT_PICKUP,
    TRIP_STATUS.PICKED_UP,
    TRIP_STATUS.EN_ROUTE_TO_DROPOFF,
    TRIP_STATUS.ARRIVED_AT_DROPOFF,
    TRIP_STATUS.COMPLETED,
    TRIP_STATUS.CANCELLED,
  ])('ensureOrderCanBeCancelled blocks status %s', (status) => {
    expect(() => ensureOrderCanBeCancelled(createOrder(status))).toThrow();
  });

  test('arrived_at_pickup is not cancellable for customer once driver has arrived', () => {
    const info = getCancellationInfoFromOrder(createOrder(TRIP_STATUS.ARRIVED_AT_PICKUP, 88));
    expect(info.canCancel).toBe(false);
    expect(info.refundAmount).toBe(0);
    expect(info.reason).toContain('driver has arrived');
  });

  test('picked_up is not cancellable once loading has started', () => {
    const info = getCancellationInfoFromOrder(createOrder(TRIP_STATUS.PICKED_UP, 88));
    expect(info.canCancel).toBe(false);
    expect(info.refundAmount).toBe(0);
    expect(info.reason).toContain('loading has started');
  });

  test('driver can cancel before loading starts', () => {
    expect(
      ensureOrderCanBeCancelled(createOrder(TRIP_STATUS.ACCEPTED, 88), { actorRole: 'driver' })
    ).toBe(TRIP_STATUS.ACCEPTED);

    expect(
      ensureOrderCanBeCancelled(createOrder(TRIP_STATUS.IN_PROGRESS, 88), { actorRole: 'driver' })
    ).toBe(TRIP_STATUS.IN_PROGRESS);

    expect(
      ensureOrderCanBeCancelled(createOrder(TRIP_STATUS.ARRIVED_AT_PICKUP, 88), { actorRole: 'driver' })
    ).toBe(TRIP_STATUS.ARRIVED_AT_PICKUP);

    expect(() =>
      ensureOrderCanBeCancelled(createOrder(TRIP_STATUS.PICKED_UP, 88), { actorRole: 'driver' })
    ).toThrow('Cannot cancel - loading has started');
  });

  test('actor role resolver uses trip ids', () => {
    const order = createOrder(TRIP_STATUS.ACCEPTED, 100, {
      customer_id: 'customer-1',
      driver_id: 'driver-1',
    });

    expect(resolveCancellationActorRole({ currentUser: { id: 'driver-1' }, orderData: order })).toBe('driver');
    expect(resolveCancellationActorRole({ currentUser: { id: 'customer-1' }, orderData: order })).toBe('customer');
    expect(resolveCancellationActorRole({ currentUser: { id: 'unknown' }, orderData: order })).toBe('customer');
  });

  test('resolveOrderCustomerId supports snake_case and camelCase fields', () => {
    expect(resolveOrderCustomerId({ customer_id: 'cust-a' })).toBe('cust-a');
    expect(resolveOrderCustomerId({ customerId: 'cust-b' })).toBe('cust-b');
    expect(resolveOrderCustomerId({})).toBeNull();
  });
});
