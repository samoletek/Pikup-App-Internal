// Driver Home Map Layer component: renders its UI and handles related interactions.
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Image, Platform, Text, TouchableOpacity, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../styles/theme";
import { logger } from "../../services/logger";

const dedupeRequestsById = (list = []) => {
  const seen = new Set();
  const deduped = [];

  (Array.isArray(list) ? list : []).forEach((request) => {
    const requestId = String(request?.id || "").trim();
    if (!requestId) {
      deduped.push(request);
      return;
    }

    if (seen.has(requestId)) {
      return;
    }

    seen.add(requestId);
    deduped.push(request);
  });

  return deduped;
};

const toLngLat = (point) => {
  const longitude = Number(point?.longitude);
  const latitude = Number(point?.latitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }
  return [longitude, latitude];
};

const DriverHomeMapLayer = ({
  region,
  tabBarHeight,
  shouldShowOnlineDriverMarker,
  onlineDriverMarkerCoordinate,
  onlineDriverPulseOpacity,
  onlineDriverPulseSize,
  isOnline,
  hasActiveTrip,
  showIncomingModal,
  isMinimized,
  availableRequests,
  selectedRequest,
  onRequestMarkerPress,
  incomingRoute,
  incomingMarkers,
  activeTripPickupLocation,
  activeTripDropoffLocation,
  insetsTop,
  mapRef,
  cameraRef,
  styles,
}) => {
  const activeTripFitKeyRef = useRef(null);
  const visibleRequests = dedupeRequestsById(availableRequests);
  const hasRegionCenter = Number.isFinite(region?.longitude) && Number.isFinite(region?.latitude);
  const hasMarkerFallback = (
    Array.isArray(onlineDriverMarkerCoordinate) &&
    Number.isFinite(onlineDriverMarkerCoordinate[0]) &&
    Number.isFinite(onlineDriverMarkerCoordinate[1])
  );
  const centerCoordinate = hasRegionCenter
    ? [region.longitude, region.latitude]
    : (hasMarkerFallback ? onlineDriverMarkerCoordinate : [-84.388, 33.749]);
  const shouldFollowUser = hasRegionCenter && isOnline && !incomingRoute && !hasActiveTrip;
  const activeTripPickupCoordinate = toLngLat(activeTripPickupLocation);
  const activeTripDropoffCoordinate = toLngLat(activeTripDropoffLocation);
  const activeTripLineGeoJson = useMemo(() => {
    if (!activeTripPickupCoordinate || !activeTripDropoffCoordinate) {
      return null;
    }

    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [activeTripPickupCoordinate, activeTripDropoffCoordinate],
          },
        },
      ],
    };
  }, [activeTripDropoffCoordinate, activeTripPickupCoordinate]);
  const activeTripBoundsPoints = useMemo(() => {
    if (!hasActiveTrip) {
      return [];
    }

    const points = [];
    if (activeTripPickupCoordinate) {
      points.push(activeTripPickupCoordinate);
    }
    if (activeTripDropoffCoordinate) {
      points.push(activeTripDropoffCoordinate);
    }
    if (hasRegionCenter) {
      points.push([region.longitude, region.latitude]);
    }
    return points;
  }, [
    activeTripDropoffCoordinate,
    activeTripPickupCoordinate,
    hasActiveTrip,
    hasRegionCenter,
    region?.latitude,
    region?.longitude,
  ]);

  useEffect(() => {
    if (!hasActiveTrip || !cameraRef?.current || activeTripBoundsPoints.length < 2) {
      activeTripFitKeyRef.current = null;
      return;
    }

    const fitKey = activeTripBoundsPoints
      .map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`)
      .join("|");
    if (activeTripFitKeyRef.current === fitKey) {
      return;
    }
    activeTripFitKeyRef.current = fitKey;

    const longitudes = activeTripBoundsPoints.map(([lng]) => lng);
    const latitudes = activeTripBoundsPoints.map(([, lat]) => lat);
    const west = Math.min(...longitudes) - 0.0025;
    const east = Math.max(...longitudes) + 0.0025;
    const south = Math.min(...latitudes) - 0.0025;
    const north = Math.max(...latitudes) + 0.0025;

    try {
      cameraRef.current.fitBounds(
        [east, north],
        [west, south],
        [90, 40, tabBarHeight + 260, 40],
        750
      );
    } catch (error) {
      logger.warn("DriverHomeMapLayer", "Failed to fit active trip bounds", error);
    }
  }, [activeTripBoundsPoints, cameraRef, hasActiveTrip, tabBarHeight]);

  return (
    <>
      <Mapbox.MapView
        ref={mapRef}
        style={[styles.map, { bottom: -tabBarHeight }]}
        styleURL={Mapbox.StyleURL.Dark}
        scaleBarEnabled={false}
        {...(Platform.OS === "android" ? { surfaceView: false } : {})}
        onMapLoadingError={(error) =>
          logger.error("DriverHomeMapLayer", "Map loading error", error?.nativeEvent || error)
        }
        onPress={() => logger.debug("DriverHomeMapLayer", "Map pressed")}
      >
        <Mapbox.Camera
          ref={cameraRef}
          centerCoordinate={centerCoordinate}
          zoomLevel={14}
          followUserLocation={shouldFollowUser}
          followUserMode={shouldFollowUser ? "compass" : "normal"}
        />

        <Mapbox.UserLocation
          visible={!shouldShowOnlineDriverMarker}
          showsUserHeadingIndicator={isOnline && !shouldShowOnlineDriverMarker}
        />

        {shouldShowOnlineDriverMarker && onlineDriverMarkerCoordinate && (
          <Mapbox.MarkerView
            id="online-driver-marker"
            coordinate={onlineDriverMarkerCoordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
            allowOverlapWithPuck
          >
            <View style={styles.onlineDriverMarkerContainer}>
              <Animated.View
                style={[
                  styles.onlineDriverMarkerPulse,
                  {
                    opacity: onlineDriverPulseOpacity,
                    width: onlineDriverPulseSize,
                    height: onlineDriverPulseSize,
                  },
                ]}
              />
              <View style={styles.onlineDriverMarkerCore}>
                <Image
                  source={require("../../assets/pickup-truck.png")}
                  style={styles.onlineDriverMarkerIcon}
                  resizeMode="contain"
                />
              </View>
            </View>
          </Mapbox.MarkerView>
        )}

        {isOnline && !hasActiveTrip && !showIncomingModal && !isMinimized && visibleRequests.map((request) => {
          if (!request?.pickup?.coordinates?.longitude || !request?.pickup?.coordinates?.latitude) {
            return null;
          }

          const isSelected = selectedRequest && selectedRequest.id === request.id;

          return (
            <Mapbox.MarkerView
              key={request.id}
              id={`request-${request.id}`}
              coordinate={[request.pickup.coordinates.longitude, request.pickup.coordinates.latitude]}
              anchor={{ x: 0.5, y: 1 }}
              allowOverlap
            >
              <TouchableOpacity
                onPress={() => onRequestMarkerPress(request)}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.requestMarkerCircle,
                  isSelected && styles.selectedMarker,
                ]}
                >
                  <Ionicons name="cash-outline" size={16} color={colors.white} />
                </View>
              </TouchableOpacity>
            </Mapbox.MarkerView>
          );
        })}

        {incomingRoute && (
          <Mapbox.ShapeSource id="incoming-route-source" shape={incomingRoute}>
            <Mapbox.LineLayer
              id="incoming-route-line"
              style={{
                lineColor: colors.primary,
                lineWidth: 5,
                lineCap: "round",
                lineJoin: "round",
                lineOpacity: 0.85,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {hasActiveTrip && activeTripLineGeoJson && (
          <Mapbox.ShapeSource id="active-trip-route-source" shape={activeTripLineGeoJson}>
            <Mapbox.LineLayer
              id="active-trip-route-line"
              style={{
                lineColor: colors.primary,
                lineWidth: 3,
                lineOpacity: 0.45,
                lineCap: "round",
                lineJoin: "round",
                lineDasharray: [1.25, 1.25],
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {incomingMarkers?.pickup && (
          <Mapbox.MarkerView
            id="incoming-pickup"
            coordinate={incomingMarkers.pickup}
            anchor={{ x: 0.5, y: 1 }}
            allowOverlap
          >
            <View style={[styles.routeMarker, { backgroundColor: colors.primaryDark }]} />
          </Mapbox.MarkerView>
        )}

        {incomingMarkers?.dropoff && (
          <Mapbox.MarkerView
            id="incoming-dropoff"
            coordinate={incomingMarkers.dropoff}
            anchor={{ x: 0.5, y: 1 }}
            allowOverlap
          >
            <View style={[styles.routeMarker, { backgroundColor: colors.primary }]} />
          </Mapbox.MarkerView>
        )}

        {hasActiveTrip && activeTripPickupCoordinate && (
          <Mapbox.MarkerView
            id="active-trip-pickup"
            coordinate={activeTripPickupCoordinate}
            anchor={{ x: 0.5, y: 1 }}
            allowOverlap
          >
            <View style={[styles.routeMarker, { backgroundColor: colors.primaryDark }]}>
              <Text style={styles.routeMarkerLabel}>A</Text>
            </View>
          </Mapbox.MarkerView>
        )}

        {hasActiveTrip && activeTripDropoffCoordinate && (
          <Mapbox.MarkerView
            id="active-trip-dropoff"
            coordinate={activeTripDropoffCoordinate}
            anchor={{ x: 0.5, y: 1 }}
            allowOverlap
          >
            <View style={[styles.routeMarker, { backgroundColor: colors.primary }]}>
              <Text style={styles.routeMarkerLabel}>B</Text>
            </View>
          </Mapbox.MarkerView>
        )}
      </Mapbox.MapView>

      <View style={[styles.header, { paddingTop: insetsTop }]}>
        <Image
          source={require("../../assets/pikup-logo.png")}
          style={styles.logoImage}
        />
      </View>
    </>
  );
};

export default DriverHomeMapLayer;
