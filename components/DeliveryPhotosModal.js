import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function DeliveryPhotosModal({ 
  visible, 
  onClose, 
  pickupPhotos = [], 
  deliveryPhotos = [],
  requestDetails
}) {
  const [activeTab, setActiveTab] = useState('pickup');

  const renderNoPhotosMessage = () => (
    <View style={styles.emptyState}>
      <Ionicons name="images-outline" size={48} color="#666" />
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
      <ScrollView 
        horizontal 
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.photoScroll}
      >
        {photos.map((photo, index) => (
          <View key={index} style={styles.photoContainer}>
            <Image 
              source={{ uri: photo.uri }} 
              style={styles.photo}
              resizeMode="cover"
            />
            <View style={styles.photoOverlay}>
              <Text style={styles.photoIndex}>{index + 1}/{photos.length}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Verification Photos</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {requestDetails && (
            <View style={styles.requestInfo}>
              <Text style={styles.requestTitle}>{requestDetails.item?.description || 'Item'}</Text>
              <Text style={styles.requestDate}>
                {new Date(requestDetails.createdAt).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </View>
          )}

          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'pickup' && styles.activeTab]}
              onPress={() => setActiveTab('pickup')}
            >
              <Text style={[styles.tabText, activeTab === 'pickup' && styles.activeTabText]}>
                Pickup Photos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'delivery' && styles.activeTab]}
              onPress={() => setActiveTab('delivery')}
            >
              <Text style={[styles.tabText, activeTab === 'delivery' && styles.activeTabText]}>
                Delivery Photos
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.photosContainer}>
            {activeTab === 'pickup' ? renderPhotos(pickupPhotos) : renderPhotos(deliveryPhotos)}
          </View>

          <TouchableOpacity 
            style={styles.closeModalButton}
            onPress={onClose}
          >
            <Text style={styles.closeModalText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#141426',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestInfo: {
    backgroundColor: '#1E1E38',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  requestDate: {
    fontSize: 14,
    color: '#999',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#2A2A3B',
  },
  activeTab: {
    borderBottomColor: '#A77BFF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
  },
  activeTabText: {
    color: '#A77BFF',
  },
  photosContainer: {
    flex: 1,
    marginBottom: 20,
  },
  photoScroll: {
    flex: 1,
  },
  photoContainer: {
    width: width - 40,
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  photoIndex: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    marginTop: 10,
  },
  closeModalButton: {
    backgroundColor: '#A77BFF',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
  },
  closeModalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
}); 