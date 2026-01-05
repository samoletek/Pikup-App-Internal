import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import useOrderStatusMonitor from '../hooks/useOrderStatusMonitor';

const { width } = Dimensions.get('window');

export default function PickupConfirmationScreen({ route, navigation }) {
  const { request, driverLocation } = route.params;
  const { confirmPickup, startDelivery } = useAuth();
  
  const [photos, setPhotos] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  
  const scrollViewRef = useRef(null);
  
  // Monitor order status for cancellations
  useOrderStatusMonitor(request?.id, navigation, {
    currentScreen: 'PickupConfirmationScreen',
    enabled: !!request?.id
  });

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission',
        'We need camera permission to take photos of the items.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => ImagePicker.requestCameraPermissionsAsync() }
        ]
      );
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

          const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        const newPhoto = {
          uri: result.assets[0].uri,
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
        };
        
        setPhotos(prev => [...prev, newPhoto]);
        
        // Scroll to the end to show the new photo
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const selectFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant access to your photo library.');
        return;
      }

          const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        const newPhoto = {
          uri: result.assets[0].uri,
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
        };
        
        setPhotos(prev => [...prev, newPhoto]);
        
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  };

  const removePhoto = (photoId) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setPhotos(prev => prev.filter(photo => photo.id !== photoId));
          }
        }
      ]
    );
  };

  const showPhotoOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose how you want to add a photo',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: selectFromGallery }
      ]
    );
  };

  const confirmPickupComplete = async () => {
    if (photos.length === 0) {
      Alert.alert(
        'Photos Required',
        'Please take at least one photo to verify the pickup.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Confirm Pickup',
      'Have you successfully picked up all items?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Start Delivery',
          onPress: handleConfirmPickup
        }
      ]
    );
  };

  const handleConfirmPickup = async () => {
    setIsCompleting(true);
    setIsUploadingPhotos(true);
    
    try {
      console.log(`Confirming pickup with ${photos.length} photos...`);
      
      // Confirm pickup with photos and location (photos will be uploaded to Firebase Storage)
      await confirmPickup(request.id, photos, driverLocation);
      console.log('Pickup confirmed with photos uploaded to Firebase Storage');
      
      setIsUploadingPhotos(false);
      
      // Start delivery phase
      await startDelivery(request.id, driverLocation);
      console.log('Started delivery phase');
      
      // Navigate to delivery screen
      navigation.replace('DeliveryNavigationScreen', {
        request,
        pickupPhotos: photos,
        driverLocation
      });
      
    } catch (error) {
      console.error('Error confirming pickup:', error);
      setIsUploadingPhotos(false);
      Alert.alert(
        'Error',
        'Failed to confirm pickup and upload photos. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCompleting(false);
    }
  };

  const customerName = request?.customerEmail?.split('@')[0] || 'Customer';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pickup Confirmation</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Header */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIndicator}>
              <Ionicons name="checkmark-circle" size={24} color="#00D4AA" />
              <Text style={styles.statusText}>Arrived at Pickup</Text>
            </View>
            <Text style={styles.requestId}>#{request?.id?.slice(-8)}</Text>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.customerCard}>
          <View style={styles.customerHeader}>
            <Image 
              source={{ uri: 'https://via.placeholder.com/50x50/CCCCCC/000000?text=C' }} 
              style={styles.customerPhoto} 
            />
            <View style={styles.customerDetails}>
              <Text style={styles.customerName}>{customerName}</Text>
              <Text style={styles.customerEmail}>{request?.customerEmail}</Text>
            </View>
            <TouchableOpacity style={styles.callButton}>
              <Ionicons name="call" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Pickup Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Pickup Details</Text>
          <View style={styles.detailRow}>
            <Ionicons name="location" size={16} color="#A77BFF" />
            <Text style={styles.detailText}>{request?.pickup?.address || 'Pickup location'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="cube" size={16} color="#A77BFF" />
            <Text style={styles.detailText}>{request?.item?.description || 'Items to pickup'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="car" size={16} color="#A77BFF" />
            <Text style={styles.detailText}>{request?.vehicle?.type || 'Vehicle type'}</Text>
          </View>
          {request?.item?.needsHelp && (
            <View style={styles.detailRow}>
              <Ionicons name="people" size={16} color="#FFA500" />
              <Text style={[styles.detailText, { color: '#FFA500' }]}>Loading assistance required</Text>
            </View>
          )}
        </View>

        {/* Photo Section */}
        <View style={styles.photoCard}>
          <View style={styles.photoHeader}>
            <Text style={styles.cardTitle}>Pickup Verification Photos</Text>
            <Text style={styles.photoCount}>{photos.length}/10</Text>
          </View>
          <Text style={styles.photoSubtitle}>
            Take photos to verify the items you're picking up
          </Text>

          {/* Photo Grid */}
          <ScrollView 
            ref={scrollViewRef}
            horizontal 
            style={styles.photoScrollView}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoContainer}
          >
            {/* Add Photo Button */}
            <TouchableOpacity style={styles.addPhotoButton} onPress={showPhotoOptions}>
              <Ionicons name="camera" size={32} color="#A77BFF" />
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </TouchableOpacity>

            {/* Photo Items */}
            {photos.map((photo, index) => (
              <View key={photo.id} style={styles.photoItem}>
                <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                <TouchableOpacity 
                  style={styles.removePhotoButton}
                  onPress={() => removePhoto(photo.id)}
                >
                  <Ionicons name="close-circle" size={24} color="#FF6B6B" />
                </TouchableOpacity>
                <View style={styles.photoIndex}>
                  <Text style={styles.photoIndexText}>{index + 1}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {photos.length === 0 && (
            <View style={styles.noPhotosContainer}>
              <Ionicons name="camera-outline" size={48} color="#666" />
              <Text style={styles.noPhotosText}>No photos yet</Text>
              <Text style={styles.noPhotosSubtext}>Take at least 1 photo to continue</Text>
            </View>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.cardTitle}>📋 Pickup Instructions</Text>
          <View style={styles.instruction}>
            <Text style={styles.instructionNumber}>1.</Text>
            <Text style={styles.instructionText}>Verify items match the description</Text>
          </View>
          <View style={styles.instruction}>
            <Text style={styles.instructionNumber}>2.</Text>
            <Text style={styles.instructionText}>Take clear photos of all items</Text>
          </View>
          <View style={styles.instruction}>
            <Text style={styles.instructionNumber}>3.</Text>
            <Text style={styles.instructionText}>Load items safely in your vehicle</Text>
          </View>
          <View style={styles.instruction}>
            <Text style={styles.instructionNumber}>4.</Text>
            <Text style={styles.instructionText}>Confirm pickup to start delivery</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity 
          style={[
            styles.confirmButton, 
            { opacity: (photos.length === 0 || isCompleting) ? 0.6 : 1 }
          ]}
          onPress={confirmPickupComplete}
          disabled={photos.length === 0 || isCompleting}
        >
          {isCompleting ? (
            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
          ) : (
            <Ionicons name="checkmark" size={20} color="#fff" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.confirmButtonText}>
            {isUploadingPhotos ? 'Uploading Photos...' : 
             isCompleting ? 'Confirming Pickup...' : 
             'Confirm Pickup & Start Delivery'}
          </Text>
        </TouchableOpacity>
        
        {photos.length === 0 && (
          <Text style={styles.warningText}>⚠️ At least 1 photo required</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3B',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2A3B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusCard: {
    backgroundColor: '#2A2A3B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    color: '#00D4AA',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  requestId: {
    color: '#666',
    fontSize: 12,
  },
  customerCard: {
    backgroundColor: '#2A2A3B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  customerEmail: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 2,
  },
  callButton: {
    width: 44,
    height: 44,
    backgroundColor: '#A77BFF',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsCard: {
    backgroundColor: '#2A2A3B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    color: '#ccc',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  photoCard: {
    backgroundColor: '#2A2A3B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  photoCount: {
    color: '#A77BFF',
    fontSize: 14,
    fontWeight: '600',
  },
  photoSubtitle: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 16,
  },
  photoScrollView: {
    marginHorizontal: -16,
  },
  photoContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  addPhotoButton: {
    width: 120,
    height: 120,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#A77BFF',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    color: '#A77BFF',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  photoItem: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
  photoIndex: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoIndexText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  noPhotosContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noPhotosText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  noPhotosSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  instructionsCard: {
    backgroundColor: '#2A2A3B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  instruction: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  instructionNumber: {
    color: '#A77BFF',
    fontSize: 14,
    fontWeight: '600',
    width: 20,
  },
  instructionText: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
  },
  bottomContainer: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#2A2A3B',
  },
  confirmButton: {
    backgroundColor: '#00D4AA',
    paddingVertical: 16,
    borderRadius: 25,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningText: {
    color: '#FFA500',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});