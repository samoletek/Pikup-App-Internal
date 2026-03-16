// Incoming Request Location Card component: renders its UI and handles related interactions.
import React from 'react';
import { Text, View } from 'react-native';
import { colors } from '../../styles/theme';

const renderLocationDetail = (styles, label, value) => {
  if (!value) return null;
  return <Text style={styles.locDetailText}>{label}: {value}</Text>;
};

export default function IncomingRequestLocationCard({
  label,
  location,
  details = {},
  dotColor,
  styles,
}) {
  return (
    <View style={styles.locCard}>
      <View style={styles.locCardHeader}>
        <View style={[styles.locDot, { backgroundColor: dotColor }]} />
        <Text style={styles.locLabel}>{label}</Text>
      </View>

      <Text style={styles.locAddress} numberOfLines={2}>
        {location?.address || `${label} location`}
      </Text>

      {(details.locationType || details.floor || details.unitNumber) && (
        <View style={styles.locDetailsRow}>
          {renderLocationDetail(styles, 'Type', details.locationType)}
          {renderLocationDetail(styles, 'Unit', details.unitNumber)}
          {renderLocationDetail(styles, 'Floor', details.floor)}
          {details.hasElevator === true ? (
            <Text style={styles.locDetailText}>Elevator: Yes</Text>
          ) : null}
          {details.hasElevator === false ? (
            <Text style={[styles.locDetailText, { color: colors.warning }]}>No elevator</Text>
          ) : null}
        </View>
      )}

      {details.notes ? (
        <Text style={styles.locNotes} numberOfLines={2}>
          Note: {details.notes}
        </Text>
      ) : null}
    </View>
  );
}
