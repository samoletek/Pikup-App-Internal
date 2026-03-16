// Request Page Indicators component: renders its UI and handles related interactions.
import React from 'react';
import { View } from 'react-native';

export default function RequestPageIndicators({
  requests,
  selectedIndex,
  styles,
}) {
  if (!Array.isArray(requests) || requests.length <= 1) {
    return null;
  }

  return (
    <View style={styles.pageIndicators}>
      {requests.map((request, index) => (
        <View
          key={request?.id || index}
          style={[
            styles.pageIndicator,
            index === selectedIndex && styles.activePageIndicator,
          ]}
        />
      ))}
    </View>
  );
}
