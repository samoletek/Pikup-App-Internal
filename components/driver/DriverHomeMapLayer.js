// Driver Home Map Layer component: renders its UI and handles related interactions.
import React from "react";
import { Animated, Image, TouchableOpacity, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../styles/theme";
import { logger } from "../../services/logger";

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
  insetsTop,
  mapRef,
  cameraRef,
  styles,
}) => {
  if (!region) {
    return null;
  }

  return (
    <>
      <Mapbox.MapView
        ref={mapRef}
        style={[styles.map, { bottom: -tabBarHeight }]}
        styleURL={Mapbox.StyleURL.Dark}
        scaleBarEnabled={false}
        onPress={() => logger.debug("DriverHomeMapLayer", "Map pressed")}
      >
        <Mapbox.Camera
          ref={cameraRef}
          centerCoordinate={[region.longitude, region.latitude]}
          zoomLevel={14}
          followUserLocation={isOnline && !incomingRoute}
          followUserMode={isOnline && !incomingRoute ? "compass" : "none"}
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

        {isOnline && !hasActiveTrip && !showIncomingModal && !isMinimized && availableRequests.map((request) => {
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
