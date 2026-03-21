import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { ENABLE_DEV_MOCK_ACTIVITY, MOCK_TRIPS } from './activity.constants';
import { mapTripToActivityItem, statusLabel } from './activity.utils';
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
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

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
        statusLabel(trip.status, { scheduledTime: trip.scheduledTime }),
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
    trips,
    filteredTrips,
    fetchTrips,
  };
}
