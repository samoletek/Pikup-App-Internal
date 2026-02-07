import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BaseModal from './BaseModal';
import { colors } from '../styles/theme';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DeliveryPhotosModal({
  visible,
  onClose,
  pickupPhotos = [],
  deliveryPhotos = [],
  requestDetails,
  initialTab = 'pickup'
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Update active tab when visible or initialTab changes
  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
    }
  }, [visible, initialTab]);

  const renderNoPhotosMessage = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="images-outline" size={40} color={colors.text.placeholder} />
      </View>
      <Text style={styles.emptyStateText}>
        {activeTab === 'pickup'
          ? 'No pickup photos available'
          : 'No delivery photos available'}
      </Text>
    </View>
  );

  const renderPhotos = (photos) => {
    if (!photos || photos.length === 0) {
      return renderNoPhotosMessage();
    }

    return (
      <View style={styles.photosWrapper}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.photoScroll}
          contentContainerStyle={styles.photoScrollContent}
        >
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoContainer}>
              <Image
                source={{ uri: photo.uri || photo }}
                style={styles.photo}
                resizeMode="cover"
              />
              <View style={styles.photoOverlay}>
                <Text style={styles.photoIndex}>{index + 1} / {photos.length}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderHeader = (closeModal) => (
    <View style={styles.header}>
      <Text style={styles.title}>Delivery Photos</Text>
      <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
        <Ionicons name="close" size={24} color={colors.text.primary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      height={SCREEN_HEIGHT * 0.85}
      backgroundColor={colors.background.secondary}
      renderHeader={renderHeader}
      showHandle={true}
      handleStyle={{ backgroundColor: colors.border.strong }}
    >
      {() => (
        <View style={styles.content}>
          {requestDetails && (
            <View style={styles.requestInfo}>
              <View style={styles.requestIcon}>
                <Ionicons name="cube-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.requestTexts}>
                <Text style={styles.requestTitle}>{requestDetails.item?.description || 'Package details'}</Text>
                <Text style={styles.requestDate}>
                  {new Date(requestDetails.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'pickup' && styles.activeTab]}
              onPress={() => setActiveTab('pickup')}
            >
              <Text style={[styles.tabText, activeTab === 'pickup' && styles.activeTabText]}>
                Pickup
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'delivery' && styles.activeTab]}
              onPress={() => setActiveTab('delivery')}
            >
              <Text style={[styles.tabText, activeTab === 'delivery' && styles.activeTabText]}>
                Delivery
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mainContainer}>
            {activeTab === 'pickup' ? renderPhotos(pickupPhotos) : renderPhotos(deliveryPhotos)}
          </View>
        </View>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.input,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  requestIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(167, 123, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  requestTexts: {
    flex: 1,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  requestDate: {
    fontSize: 12,
    color: colors.text.muted,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: colors.background.input,
    borderRadius: 30,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 26,
  },
  activeTab: {
    backgroundColor: colors.border.strong,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.placeholder,
  },
  activeTabText: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: colors.black, // Black background for photos
  },
  photosWrapper: {
    flex: 1,
  },
  photoScroll: {
    flex: 1,
  },
  photoScrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoContainer: {
    width: width,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain', // Changed to contain to see full photo
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(20, 20, 38, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  photoIndex: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateText: {
    color: colors.text.muted,
    fontSize: 16,
  },
});
