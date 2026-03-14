import Mapbox from "@rnmapbox/maps";
import { appConfig } from "./appConfig";
import { logger } from "../services/logger";

let initialized = false;

export const ensureMapboxConfigured = () => {
  if (initialized) return;

  const token = appConfig.mapbox.publicToken;
  if (!token) {
    logger.warn("MapboxConfig", "EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN is missing");
    return;
  }

  Mapbox.setAccessToken(token);
  initialized = true;
};
