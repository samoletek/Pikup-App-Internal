import {
  createRealtimeChannel,
  removeRealtimeChannel,
} from './repositories/tripRepository';

export const subscribeToTripUpdates = ({ tripId, onTripUpdate, onSubscriptionStatus }) => {
  if (!tripId) {
    return () => {};
  }

  const channel = createRealtimeChannel(`customer-trip-details-${tripId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'trips',
        filter: `id=eq.${tripId}`,
      },
      (payload) => {
        const nextTrip = payload?.new;
        if (nextTrip && typeof nextTrip === 'object') {
          onTripUpdate?.(nextTrip);
        }
      }
    )
    .subscribe((status) => {
      onSubscriptionStatus?.(status);
    });

  return () => {
    removeRealtimeChannel(channel);
  };
};
