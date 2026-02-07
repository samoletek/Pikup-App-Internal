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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import useOrderStatusMonitor from '../../hooks/useOrderStatusMonitor';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from '../../styles/theme';

export default function PickupConfirmationScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { request, driverLocation } = route.params;
  const { confirmPickup, startDelivery } = useAuth();
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);
  
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
      <ScreenHeader
        title="Pickup Confirmation"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 124 }}
      >
        <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
          {/* Status Header */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.statusIndicator}>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
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
                <Ionicons name="call" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Pickup Details */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Pickup Details</Text>
            <View style={styles.detailRow}>
              <Ionicons name="location" size={16} color={colors.primary} />
              <Text style={styles.detailText}>{request?.pickup?.address || 'Pickup location'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="cube" size={16} color={colors.primary} />
              <Text style={styles.detailText}>{request?.item?.description || 'Items to pickup'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="car" size={16} color={colors.primary} />
              <Text style={styles.detailText}>{request?.vehicle?.type || 'Vehicle type'}</Text>
            </View>
            {request?.item?.needsHelp && (
              <View style={styles.detailRow}>
                <Ionicons name="people" size={16} color={colors.warning} />
                <Text style={[styles.detailText, { color: colors.warning }]}>Loading assistance required</Text>
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
                <Ionicons name="camera" size={32} color={colors.primary} />
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
                    <Ionicons name="close-circle" size={24} color={colors.error} />
                  </TouchableOpacity>
                  <View style={styles.photoIndex}>
                    <Text style={styles.photoIndexText}>{index + 1}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {photos.length === 0 && (
              <View style={styles.noPhotosContainer}>
                <Ionicons name="camera-outline" size={48} color={colors.text.muted} />
                <Text style={styles.noPhotosText}>No photos yet</Text>
                <Text style={styles.noPhotosSubtext}>Take at least 1 photo to continue</Text>
              </View>
            )}
          </View>

          {/* Instructions */}
          <View style={styles.instructionsCard}>
            <Text style={styles.cardTitle}>Pickup Instructions</Text>
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
        </View>
      </ScrollView>

      {/* Bottom Action Button */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity 
          style={[
            styles.confirmButton, 
            { opacity: (photos.length === 0 || isCompleting) ? 0.6 : 1 }
          ]}
          onPress={confirmPickupComplete}
          disabled={photos.length === 0 || isCompleting}
        >
          {isCompleting ? (
            <ActivityIndicator size="small" color={colors.white} style={{ marginRight: spacing.sm }} />
          ) : (
            <Ionicons name="checkmark" size={20} color={colors.white} style={{ marginRight: spacing.sm }} />
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
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  contentColumn: {
    width: '100%',
    alignSelf: 'center',
  },
  statusCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.base,
    marginBottom: spacing.base,
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
    color: colors.success,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  requestId: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
  },
  customerCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerPhoto: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.circle,
    marginRight: spacing.md,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  customerEmail: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    marginTop: 2,
  },
  callButton: {
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.circle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    marginLeft: spacing.sm,
    flex: 1,
  },
  photoCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  photoCount: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  photoSubtitle: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.base,
  },
  photoScrollView: {
    marginHorizontal: -spacing.base,
  },
  photoContainer: {
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  addPhotoButton: {
    width: 120,
    height: 120,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    color: colors.primary,
    fontSize: typography.fontSize.xs + 1,
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  photoItem: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
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
    color: colors.white,
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
  },
  noPhotosContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noPhotosText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.sm,
  },
  noPhotosSubtext: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs + 1,
    marginTop: spacing.xs,
  },
  instructionsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  instruction: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  instructionNumber: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    width: 20,
  },
  instructionText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  bottomContainer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.base,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
  },
  confirmButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  warningText: {
    color: colors.warning,
    fontSize: typography.fontSize.xs + 1,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
