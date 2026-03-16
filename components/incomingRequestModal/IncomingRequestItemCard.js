// Incoming Request Item Card component: renders its UI and handles related interactions.
import React from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { spacing } from '../../styles/theme';
import { resolvePhotoSource } from './incomingRequestModal.utils';

export default function IncomingRequestItemCard({
  item,
  index,
  photoOffset = 0,
  allPhotos = [],
  onOpenPhotoViewer,
  styles,
}) {
  const photos = Array.isArray(item.photos) ? item.photos : [];

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemCardHeader}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.description || item.name || item.type || `Item ${index + 1}`}
        </Text>
        {item.weightEstimate > 0 ? (
          <Text style={styles.itemWeight}>{item.weightEstimate} lbs</Text>
        ) : null}
      </View>

      {item.dimensions ? <Text style={styles.itemDims}>{item.dimensions}</Text> : null}

      {photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing.sm }}
        >
          {photos.map((photo, photoIndex) => {
            const source = resolvePhotoSource(photo);
            if (!source) return null;
            return (
              <TouchableOpacity
                key={photoIndex}
                onPress={() => onOpenPhotoViewer(allPhotos, photoOffset + photoIndex)}
                activeOpacity={0.8}
              >
                <Image source={source} style={styles.itemPhoto} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}
