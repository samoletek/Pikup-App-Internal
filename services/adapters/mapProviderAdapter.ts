type RoutePoint = {
  latitude: number;
  longitude: number;
};

type GeocodeFeature = {
  center: [number, number];
  place_name: string;
};

type DirectionsResponse = {
  routes?: {
    distance: number;
    duration: number;
    geometry: {
      coordinates: [number, number][];
    };
    legs: {
      steps: unknown[];
    }[];
  }[];
  message?: string;
};

type GeocodeResponse = {
  features?: GeocodeFeature[];
};

export type MapProviderAdapter = {
  fetchDirections: (params: {
    accessToken: string;
    origin: RoutePoint;
    destination: RoutePoint;
    waypoints?: RoutePoint[];
  }) => Promise<DirectionsResponse>;
  geocodeAddress: (params: {
    accessToken: string;
    address: string;
    bbox?: string;
    country?: string;
  }) => Promise<GeocodeResponse>;
  reverseGeocode: (params: {
    accessToken: string;
    latitude: number;
    longitude: number;
    country?: string;
    types?: string;
  }) => Promise<GeocodeResponse>;
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  return response.json() as Promise<T>;
};

const defaultMapProviderAdapter: MapProviderAdapter = {
  fetchDirections: async ({ accessToken, origin, destination, waypoints = [] }) => {
    const originStr = `${origin.longitude},${origin.latitude}`;
    const destinationStr = `${destination.longitude},${destination.latitude}`;
    const waypointsStr =
      waypoints.length > 0
        ? waypoints.map((point) => `${point.longitude},${point.latitude}`).join(';')
        : '';

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originStr}${waypointsStr ? `;${waypointsStr}` : ''};${destinationStr}?access_token=${accessToken}&geometries=geojson&steps=true&voice_instructions=true&alternatives=true`;
    return fetchJson<DirectionsResponse>(url);
  },
  geocodeAddress: async ({
    accessToken,
    address,
    bbox = '-85.605166,30.355757,-80.751429,35.000659',
    country = 'US',
  }) => {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${accessToken}&bbox=${bbox}&country=${country}`;
    return fetchJson<GeocodeResponse>(url);
  },
  reverseGeocode: async ({
    accessToken,
    latitude,
    longitude,
    country = 'US',
    types = 'address,poi',
  }) => {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${accessToken}&types=${types}&country=${country}`;
    return fetchJson<GeocodeResponse>(url);
  },
};

let activeMapProviderAdapter: MapProviderAdapter = defaultMapProviderAdapter;

export const getMapProviderAdapter = (): MapProviderAdapter => activeMapProviderAdapter;

export const setMapProviderAdapter = (nextAdapter: MapProviderAdapter) => {
  activeMapProviderAdapter = nextAdapter || defaultMapProviderAdapter;
};

export const resetMapProviderAdapter = () => {
  activeMapProviderAdapter = defaultMapProviderAdapter;
};
