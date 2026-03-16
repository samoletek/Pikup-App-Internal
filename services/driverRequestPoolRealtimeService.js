import {
  createRealtimeChannel,
  removeRealtimeChannel,
} from './repositories/tripRepository';

export const subscribeToDriverRequestPoolUpdates = ({ currentUserId, onTripUnavailable }) => {
  if (!currentUserId) {
    return () => {};
  }

  const channel = createRealtimeChannel(`driver-request-pool-${currentUserId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'trips' },
      (payload) => {
        onTripUnavailable?.({ type: 'trip_update', payload });
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'trips' },
      (payload) => {
        onTripUnavailable?.({ type: 'trip_delete', payload });
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'driver_request_offers',
        filter: `driver_id=eq.${currentUserId}`,
      },
      (payload) => {
        onTripUnavailable?.({ type: 'offer_update', payload });
      }
    )
    .subscribe();

  return () => {
    removeRealtimeChannel(channel);
  };
};
