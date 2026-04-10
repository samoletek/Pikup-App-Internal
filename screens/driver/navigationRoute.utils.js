import { DROPOFF_PHASE_STATUSES, PICKUP_PHASE_STATUSES, TRIP_STATUS } from '../../constants/tripStatus';
import { formatDistance, getDistanceFromLatLonInKm } from './navigationMath.utils';
import { logger } from '../../services/logger';

const FALLBACK_DRIVER_DESTINATION = {
  latitude: 33.7540,
  longitude: -84.3830,
};
const DRIVER_NAVIGATION_PARENT_SEARCH_DEPTH = 5;
const createDriverTabsHomeRoute = (homeParams) => ({
  name: 'DriverTabs',
  params: homeParams
    ? { screen: 'Home', params: homeParams }
    : { screen: 'Home' },
});

export function parseCoordinates(coords) {
  if (!coords) {
    return null;
  }

  const tryArrayCoordinates = (candidate) => {
    if (!Array.isArray(candidate) || candidate.length < 2) {
      return null;
    }

    const longitude = Number(candidate[0]);
    const latitude = Number(candidate[1]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }

    return null;
  };

  if (Array.isArray(coords) && coords.length >= 2) {
    const parsedFromArray = tryArrayCoordinates(coords);
    if (parsedFromArray) {
      return parsedFromArray;
    }
  }

  if (typeof coords === 'object' && !Array.isArray(coords)) {
    const nestedCoordinates = tryArrayCoordinates(coords.coordinates);
    if (nestedCoordinates) {
      return nestedCoordinates;
    }

    const latitude = Number(coords.latitude ?? coords.lat ?? coords.y);
    const longitude = Number(coords.longitude ?? coords.lng ?? coords.lon ?? coords.x);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  if (typeof coords === 'string') {
    try {
      const parsed = JSON.parse(coords);
      const parsedFromArray = tryArrayCoordinates(parsed);
      if (parsedFromArray) {
        return parsedFromArray;
      }

      if (parsed && typeof parsed === 'object') {
        const nestedCoordinates = tryArrayCoordinates(parsed.coordinates);
        if (nestedCoordinates) {
          return nestedCoordinates;
        }

        const latitude = Number(parsed.latitude ?? parsed.lat ?? parsed.y);
        const longitude = Number(parsed.longitude ?? parsed.lng ?? parsed.lon ?? parsed.x);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          return { latitude, longitude };
        }
      }
    } catch (error) {
      logger.error('NavigationRouteUtils', 'Failed to parse coordinates', error);
    }
  }

  return null;
}

function toLatLng(coords) {
  if (!coords) {
    return null;
  }

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
}

export function extractDestinationFromStatus(requestData) {
  if (!requestData) {
    return null;
  }

  if (PICKUP_PHASE_STATUSES.includes(requestData.status)) {
    return requestData.pickup?.coordinates || null;
  }

  return requestData.dropoff?.coordinates || null;
}

export function extractCustomerLocationFromRequest({ requestData, routeRequest, driverLocation }) {
  if (requestData) {
    if (PICKUP_PHASE_STATUSES.includes(requestData.status)) {
      const coords = parseCoordinates(requestData.pickup?.coordinates);
      if (coords) {
        logger.debug('NavigationRouteUtils', 'Using pickup coordinates from requestData', coords);
        return toLatLng(coords);
      }
    } else if (DROPOFF_PHASE_STATUSES.includes(requestData.status)) {
      const coords = parseCoordinates(requestData.dropoff?.coordinates);
      if (coords) {
        logger.debug('NavigationRouteUtils', 'Using dropoff coordinates from requestData', coords);
        return toLatLng(coords);
      }
    }
  }

  if (routeRequest) {
    const status = routeRequest.status || requestData?.status || TRIP_STATUS.ACCEPTED;
    if (PICKUP_PHASE_STATUSES.includes(status)) {
      const coords = parseCoordinates(routeRequest.pickup?.coordinates);
      if (coords) {
        logger.debug('NavigationRouteUtils', 'Using pickup coordinates from route params', coords);
        return toLatLng(coords);
      }
    } else if (DROPOFF_PHASE_STATUSES.includes(status)) {
      const coords = parseCoordinates(routeRequest.dropoff?.coordinates);
      if (coords) {
        logger.debug('NavigationRouteUtils', 'Using dropoff coordinates from route params', coords);
        return toLatLng(coords);
      }
    }
  }

  logger.warn('NavigationRouteUtils', 'No valid customer location found, using fallback location');

  if (driverLocation) {
    return {
      latitude: driverLocation.latitude + 0.005,
      longitude: driverLocation.longitude + 0.003,
    };
  }

  return { ...FALLBACK_DRIVER_DESTINATION };
}

export function calculateDistanceAndEta(driverCoords, customerCoords) {
  const distanceInKm = getDistanceFromLatLonInKm(
    driverCoords.latitude,
    driverCoords.longitude,
    customerCoords.latitude,
    customerCoords.longitude
  );

  const distanceText = formatDistance(distanceInKm * 1000);

  const timeInMinutes = Math.ceil((distanceInKm / 30) * 60);
  const etaText = timeInMinutes < 1 ? '<1 min' : `${timeInMinutes} min`;

  return {
    distanceText,
    etaText,
  };
}

export function generateFallbackRoute(start, end) {
  return [start, end];
}

function resolveDriverHomeRouteFromNavigation(navigation, homeParams) {
  if (!navigation || typeof navigation.getState !== 'function') {
    return null;
  }

  const routeNames = navigation.getState()?.routeNames;
  if (!Array.isArray(routeNames) || routeNames.length === 0) {
    return null;
  }

  if (routeNames.includes('DriverTabs')) {
    return createDriverTabsHomeRoute(homeParams);
  }
  if (routeNames.includes('Home')) {
    return { name: 'Home', params: homeParams };
  }
  if (routeNames.includes('DriverHomeScreen')) {
    return { name: 'DriverHomeScreen', params: homeParams };
  }

  return null;
}

export function navigateDriverToHome(navigation, homeParams = undefined) {
  let cursor = navigation;

  for (let depth = 0; depth < DRIVER_NAVIGATION_PARENT_SEARCH_DEPTH; depth += 1) {
    if (!cursor) {
      break;
    }

    const targetRoute = resolveDriverHomeRouteFromNavigation(cursor, homeParams);
    if (targetRoute) {
      if (typeof cursor.reset === 'function') {
        cursor.reset({
          index: 0,
          routes: [targetRoute],
        });
        return true;
      }

      if (typeof cursor.navigate === 'function') {
        cursor.navigate(targetRoute.name, targetRoute.params);
        return true;
      }
    }

    cursor = typeof cursor.getParent === 'function' ? cursor.getParent() : null;
  }

  logger.warn('NavigationRouteUtils', 'Unable to resolve driver home navigation route');
  return false;
}
