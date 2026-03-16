// Request Map Section component: renders its UI and handles related interactions.
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import MapboxMap from '../mapbox/MapboxMap';
import { colors } from '../../styles/theme';

export default function RequestMapSection({
  showMap,
  onShowMap,
  onHideMap,
  currentLocation,
  requests,
  selectedIndex,
  onSelectRequestIndex,
  flatListRef,
  mapRef,
  selectedRoute,
  selectedRouteMarkers,
  styles,
}) {
  if (!showMap) {
    return (
      <TouchableOpacity style={styles.showMapButton} onPress={onShowMap}>
        <Ionicons name="map" size={20} color={colors.primary} />
        <Text style={styles.showMapText}>Show Map</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.mapContainer}>
      <MapboxMap
        ref={mapRef}
        style={styles.modalMap}
        centerCoordinate={
          currentLocation
            ? [currentLocation.longitude, currentLocation.latitude]
            : [-84.388, 33.749]
        }
        zoomLevel={11}
        customMapStyle={Mapbox.StyleURL.Dark}
      >
        {currentLocation && (
          <Mapbox.MarkerView
            id="currentLocation"
            coordinate={[currentLocation.longitude, currentLocation.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
          >
            <View style={styles.currentLocationMarker}>
              <View style={styles.currentLocationDot} />
            </View>
          </Mapbox.MarkerView>
        )}

        {selectedRoute && (
          <Mapbox.ShapeSource id="scheduled-request-route-source" shape={selectedRoute}>
            <Mapbox.LineLayer
              id="scheduled-request-route-line"
              style={{
                lineColor: colors.primary,
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.85,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {selectedRouteMarkers?.pickup && (
          <Mapbox.MarkerView
            id="scheduled-request-pickup"
            coordinate={selectedRouteMarkers.pickup}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
          >
            <View style={[styles.routeMarkerCircle, { backgroundColor: colors.primaryDark }]} />
          </Mapbox.MarkerView>
        )}

        {selectedRouteMarkers?.dropoff && (
          <Mapbox.MarkerView
            id="scheduled-request-dropoff"
            coordinate={selectedRouteMarkers.dropoff}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
          >
            <View style={[styles.routeMarkerCircle, { backgroundColor: colors.success }]} />
          </Mapbox.MarkerView>
        )}

        {requests.map((request, index) => (
          <Mapbox.MarkerView
            key={request.id}
            id={`request-marker-${request.id}`}
            coordinate={[
              request.pickup.coordinates.longitude,
              request.pickup.coordinates.latitude,
            ]}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
          >
            <TouchableOpacity
              onPress={() => {
                onSelectRequestIndex(index);
                if (flatListRef.current) {
                  flatListRef.current.scrollToIndex({
                    index,
                    animated: true,
                    viewPosition: 0.5,
                  });
                }
              }}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.markerCircle,
                  selectedIndex === index && styles.selectedMarkerCircle,
                ]}
              >
                <View style={styles.markerCircleInner} />
              </View>
            </TouchableOpacity>
          </Mapbox.MarkerView>
        ))}
      </MapboxMap>

      <TouchableOpacity style={styles.mapToggle} onPress={onHideMap}>
        <Ionicons name="chevron-up" size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}
