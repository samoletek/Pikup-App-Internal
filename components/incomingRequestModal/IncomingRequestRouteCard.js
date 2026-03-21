import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/theme';

const getLocationMetaLine = (details = {}) => {
  const parts = [];

  if (details.locationType) parts.push(`Type: ${details.locationType}`);
  if (details.unitNumber) parts.push(`Unit: ${details.unitNumber}`);
  if (details.floor) parts.push(`Floor: ${details.floor}`);
  if (details.hasElevator === true) parts.push('Elevator: Yes');
  if (details.hasElevator === false) parts.push('No elevator');

  return parts.join(' • ');
};

export default function IncomingRequestRouteCard({
  pickup,
  dropoff,
  pickupDetails = {},
  dropoffDetails = {},
  styles,
}) {
  const pickupMetaLine = useMemo(
    () => getLocationMetaLine(pickupDetails),
    [pickupDetails]
  );
  const dropoffMetaLine = useMemo(
    () => getLocationMetaLine(dropoffDetails),
    [dropoffDetails]
  );

  return (
    <View style={styles.routeCard}>
      <Text style={styles.routeTitle}>Route</Text>

      <View style={styles.routeRow}>
        <View style={styles.routeIconWrap}>
          <Ionicons name="arrow-up-circle-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.routeContent}>
          <Text style={styles.routeLabel}>Pickup</Text>
          <Text style={styles.routeAddress} numberOfLines={2}>
            {pickup?.address || 'Pickup location'}
          </Text>
          {pickupMetaLine ? (
            <Text style={styles.routeMetaText} numberOfLines={2}>
              {pickupMetaLine}
            </Text>
          ) : null}
          {pickupDetails?.notes ? (
            <Text style={styles.routeNotesText} numberOfLines={2}>
              Note: {pickupDetails.notes}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.routeDivider} />

      <View style={styles.routeRow}>
        <View style={styles.routeIconWrap}>
          <Ionicons name="arrow-down-circle-outline" size={18} color={colors.success} />
        </View>
        <View style={styles.routeContent}>
          <Text style={styles.routeLabel}>Drop-off</Text>
          <Text style={styles.routeAddress} numberOfLines={2}>
            {dropoff?.address || 'Dropoff location'}
          </Text>
          {dropoffMetaLine ? (
            <Text style={styles.routeMetaText} numberOfLines={2}>
              {dropoffMetaLine}
            </Text>
          ) : null}
          {dropoffDetails?.notes ? (
            <Text style={styles.routeNotesText} numberOfLines={2}>
              Note: {dropoffDetails.notes}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
