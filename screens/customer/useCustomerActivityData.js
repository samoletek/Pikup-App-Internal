import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { ENABLE_DEV_MOCK_ACTIVITY, MOCK_TRIPS } from './activity.constants';
import {
  ACTIVITY_STATUSES,
  mapTripToActivityItem,
  statusLabel,
} from './activity.utils';
import { logger } from '../../services/logger';

export default function useCustomerActivityData({
  currentUser,
  getUserPickupRequests,
}) {
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);

  const fetchTrips = useCallback(async () => {
    if (!currentUser) {
      setTrips([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userTrips = await getUserPickupRequests();
      const tripsList = Array.isArray(userTrips) ? userTrips : [];
      const normalizedTrips = tripsList
        .map(mapTripToActivityItem)
        .filter(
          (trip) =>
            trip.activityStatus === ACTIVITY_STATUSES.SCHEDULED ||
            trip.activityStatus === ACTIVITY_STATUSES.COMPLETED ||
            trip.activityStatus === ACTIVITY_STATUSES.CANCELLED
        )
        .sort((firstTrip, secondTrip) => {
          const firstScheduled = firstTrip.activityStatus === ACTIVITY_STATUSES.SCHEDULED;
          const secondScheduled = secondTrip.activityStatus === ACTIVITY_STATUSES.SCHEDULED;

          if (firstScheduled && secondScheduled) {
            return new Date(firstTrip.scheduledTime || firstTrip.timestamp).getTime() -
              new Date(secondTrip.scheduledTime || secondTrip.timestamp).getTime();
          }

          if (firstScheduled) return -1;
          if (secondScheduled) return 1;
          return new Date(secondTrip.timestamp) - new Date(firstTrip.timestamp);
        });

      setTrips(
        normalizedTrips.length > 0
          ? normalizedTrips
          : ENABLE_DEV_MOCK_ACTIVITY
            ? MOCK_TRIPS
            : []
      );
    } catch (error) {
      logger.error('CustomerActivityData', 'Error fetching trips', error);
      Alert.alert('Unable to Load Activity', 'Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, getUserPickupRequests]);

  const filteredTrips = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return trips;
    }

    return trips.filter((trip) => {
      const haystack = [
        trip.pickup,
        trip.dropoff,
        trip.item,
        trip.driver,
        statusLabel(trip.activityStatus),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [searchText, trips]);

  return {
    loading,
    searchText,
    setSearchText,
    filteredTrips,
    fetchTrips,
  };
}
