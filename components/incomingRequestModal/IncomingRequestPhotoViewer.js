// Incoming Request Photo Viewer component: renders its UI and handles related interactions.
import React from 'react';
import {
  View,
  Image,
  FlatList,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from '../IncomingRequestModal.styles';
import { colors } from '../../styles/theme';
import { SCREEN_WIDTH } from './incomingRequestModal.utils';

export default function IncomingRequestPhotoViewer({
  visible,
  photos,
  currentIndex,
  onIndexChange,
  onClose,
}) {
  if (!visible) {
    return null;
  }

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.photoViewerOverlay}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={currentIndex}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const page = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            onIndexChange(page);
          }}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item }) => (
            <TouchableWithoutFeedback onPress={onClose}>
              <View style={styles.photoViewerPage}>
                <TouchableWithoutFeedback>
                  <Image source={{ uri: item }} style={styles.photoViewerImage} resizeMode="contain" />
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          )}
        />
        {photos.length > 1 ? (
          <View style={styles.photoViewerCounter}>
            <Text style={styles.photoViewerCounterText}>
              {currentIndex + 1}/{photos.length}
            </Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.photoViewerClose}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={28} color={colors.white} />
        </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
}
