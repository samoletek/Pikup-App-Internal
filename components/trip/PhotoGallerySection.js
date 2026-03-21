// Photo Gallery Section component: renders its UI and handles related interactions.
import React from "react";
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const PhotoGallerySection = ({
  title,
  photos = [],
  emptyLabel,
  onOpenPhoto,
  ui,
}) => {
  const styles = ui || {};

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoScrollContent}
        >
	          {photos.map((photoUri, index) => (
	            <View key={`${title}-${index}`} style={styles.photoTile}>
	              <TouchableOpacity
	                style={styles.photoTilePressable}
	                activeOpacity={0.9}
	                onPress={() => onOpenPhoto?.(photos, index)}
	              >
	                <Image source={{ uri: photoUri }} style={styles.photoTileImage} resizeMode="cover" />
	              </TouchableOpacity>
              <View style={styles.photoTileBadge}>
                <Text style={styles.photoTileBadgeText}>{index + 1}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.sectionHint}>{emptyLabel}</Text>
      )}
    </View>
  );
};

export default PhotoGallerySection;
