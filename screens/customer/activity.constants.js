import { TRIP_STATUS } from '../../constants/tripStatus';
import { appConfig } from '../../config/appConfig';

export const HEADER_ROW_HEIGHT = 56;
export const SEARCH_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;
export const TITLE_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;
export const TOTAL_COLLAPSE_DISTANCE =
  SEARCH_COLLAPSE_DISTANCE + TITLE_COLLAPSE_DISTANCE;

// TODO(cleanup): Remove mock fallback before production release.
// This data is only for local UI development when no trips are returned.
export const MOCK_TRIPS = [
  {
    id: 'mock-trip-1',
    status: TRIP_STATUS.COMPLETED,
    dateLabel: 'Jan 15, 2026',
    pickup: '123 Main Street, Los Angeles, CA 90012',
    dropoff: '456 Oak Avenue, Beverly Hills, CA 90210',
    item: 'Small Package',
    driver: 'Michael',
    amount: '$24.50',
    timestamp: '2026-01-15T14:30:00Z',
  },
  {
    id: 'mock-trip-2',
    status: TRIP_STATUS.COMPLETED,
    dateLabel: 'Jan 12, 2026',
    pickup: '789 Sunset Blvd, West Hollywood, CA 90069',
    dropoff: '321 Wilshire Blvd, Santa Monica, CA 90401',
    item: 'Documents',
    driver: 'Sarah',
    amount: '$18.75',
    timestamp: '2026-01-12T10:15:00Z',
  },
  {
    id: 'mock-trip-3',
    status: TRIP_STATUS.CANCELLED,
    dateLabel: 'Jan 10, 2026',
    pickup: '555 Hollywood Blvd, Hollywood, CA 90028',
    dropoff: '888 Venice Beach, Venice, CA 90291',
    item: 'Electronics',
    driver: 'James',
    amount: '$0.00',
    timestamp: '2026-01-10T16:45:00Z',
  },
  {
    id: 'mock-trip-4',
    status: TRIP_STATUS.COMPLETED,
    dateLabel: 'Jan 8, 2026',
    pickup: '200 Downtown LA, Los Angeles, CA 90015',
    dropoff: '400 Pasadena Ave, Pasadena, CA 91101',
    item: 'Fragile Box',
    driver: 'Emma',
    amount: '$32.00',
    timestamp: '2026-01-08T09:00:00Z',
  },
  {
    id: 'mock-trip-5',
    status: TRIP_STATUS.CANCELLED,
    dateLabel: 'Jan 5, 2026',
    pickup: '100 Century City, Los Angeles, CA 90067',
    dropoff: '700 Marina del Rey, Marina del Rey, CA 90292',
    item: 'Gift Package',
    driver: 'David',
    amount: '$0.00',
    timestamp: '2026-01-05T13:20:00Z',
  },
];

export const ENABLE_DEV_MOCK_ACTIVITY = appConfig.devMocks.enabled;
