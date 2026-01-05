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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

export default function DeliveryConfirmationScreen({ route, navigation }) {
  const { request, pickupPhotos, driverLocation } = route.params;
  const { finishDelivery } = useAuth();
  
  const [deliveryPhotos, setDeliveryPhotos] = useState([]);
  const [customerRating, setCustomerRating] = useState(5);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  
  const scrollViewRef = useRef(null);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission',
        'We need camera permission to take delivery verification photos.',
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
        
        setDeliveryPhotos(prev => [...prev, newPhoto]);
        
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
        
        setDeliveryPhotos(prev => [...prev, newPhoto]);
        
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
            setDeliveryPhotos(prev => prev.filter(photo => photo.id !== photoId));
          }
        }
      ]
    );
  };

  const showPhotoOptions = () => {
    Alert.alert(
      'Add Delivery Photo',
      'Take a photo to verify successful delivery',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: selectFromGallery }
      ]
    );
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setCustomerRating(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= customerRating ? 'star' : 'star-outline'}
              size={32}
              color={star <= customerRating ? '#FFD700' : '#666'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const completeDelivery = async () => {
    if (deliveryPhotos.length === 0) {
      Alert.alert(
        'Photos Required',
        'Please take at least one photo to verify the delivery.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Complete Delivery',
      'Confirm that all items have been successfully delivered?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete Delivery',
          onPress: handleCompleteDelivery
        }
      ]
    );
  };

  const handleCompleteDelivery = async () => {
    setIsCompleting(true);
    setIsUploadingPhotos(true);
    
    try {
      console.log(`Completing delivery with ${deliveryPhotos.length} photos...`);
      
      // Complete delivery with photos, location, and rating (photos will be uploaded to Firebase Storage)
      await finishDelivery(
        request.id, 
        deliveryPhotos, 
        driverLocation, 
        customerRating
      );
      
      console.log('Delivery completed with photos uploaded to Firebase Storage');
      setIsUploadingPhotos(false);
      
      console.log('Delivery completed successfully');
      
      // Show success message
      Alert.alert(
        'Delivery Complete! 🎉',
        `Thank you for completing this delivery. Customer rating: ${customerRating} stars.`,
        [
          {
            text: 'Continue',
            onPress: () => {
              // Navigate back to driver tabs (which contains the home screen)
              navigation.reset({
                index: 0,
                routes: [{ name: 'DriverTabs' }],
              });
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error completing delivery:', error);
      setIsUploadingPhotos(false);
      Alert.alert(
        'Error',
        'Failed to complete delivery and upload photos. Please try again.',
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
        <Text style={styles.headerTitle}>Complete Delivery</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Header */}
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color="#00D4AA" />
          </View>
          <Text style={styles.successTitle}>Arrived at Dropoff!</Text>
          <Text style={styles.successSubtitle}>Complete the delivery process</Text>
        </View>

        {/* Delivery Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Delivery Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Request ID:</Text>
            <Text style={styles.summaryValue}>#{request?.id?.slice(-8)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Customer:</Text>
            <Text style={styles.summaryValue}>{customerName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items:</Text>
            <Text style={styles.summaryValue}>{request?.item?.description || 'Delivery items'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Pickup Photos:</Text>
            <Text style={styles.summaryValue}>{pickupPhotos?.length || 0} photos</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Amount:</Text>
            <Text style={[styles.summaryValue, styles.priceValue]}>${request?.pricing?.total || '0.00'}</Text>
          </View>
        </View>

        {/* Customer Rating */}
        <View style={styles.ratingCard}>
          <Text style={styles.cardTitle}>Rate Your Experience</Text>
          <Text style={styles.ratingSubtitle}>How was your interaction with {customerName}?</Text>
          {renderStars()}
          <Text style={styles.ratingText}>
            {customerRating === 5 && '⭐ Excellent!'}
            {customerRating === 4 && '😊 Very Good'}
            {customerRating === 3 && '😐 Good'}
            {customerRating === 2 && '😕 Fair'}
            {customerRating === 1 && '😞 Poor'}
          </Text>
        </View>

        {/* Delivery Notes */}
        <View style={styles.notesCard}>
          <Text style={styles.cardTitle}>Delivery Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add any notes about the delivery..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={3}
            value={deliveryNotes}
            onChangeText={setDeliveryNotes}
            maxLength={200}
          />
          <Text style={styles.charCount}>{deliveryNotes.length}/200</Text>
        </View>

        {/* Photo Section */}
        <View style={styles.photoCard}>
          <View style={styles.photoHeader}>
            <Text style={styles.cardTitle}>Delivery Verification Photos</Text>
            <Text style={styles.photoCount}>{deliveryPhotos.length}/10</Text>
          </View>
          <Text style={styles.photoSubtitle}>
            Take photos to confirm successful delivery
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
              <Ionicons name="camera" size={32} color="#00D4AA" />
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </TouchableOpacity>

            {/* Photo Items */}
            {deliveryPhotos.map((photo, index) => (
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

          {deliveryPhotos.length === 0 && (
            <View style={styles.noPhotosContainer}>
              <Ionicons name="camera-outline" size={48} color="#666" />
              <Text style={styles.noPhotosText}>No delivery photos yet</Text>
              <Text style={styles.noPhotosSubtext}>Take at least 1 photo to complete delivery</Text>
            </View>
          )}
        </View>

        {/* Final Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.cardTitle}>🎯 Final Steps</Text>
          <View style={styles.instruction}>
            <Text style={styles.instructionNumber}>1.</Text>
            <Text style={styles.instructionText}>Ensure all items are delivered safely</Text>
          </View>
          <View style={styles.instruction}>
            <Text style={styles.instructionNumber}>2.</Text>
            <Text style={styles.instructionText}>Take photos showing successful delivery</Text>
          </View>
          <View style={styles.instruction}>
            <Text style={styles.instructionNumber}>3.</Text>
            <Text style={styles.instructionText}>Rate your customer experience</Text>
          </View>
          <View style={styles.instruction}>
            <Text style={styles.instructionNumber}>4.</Text>
            <Text style={styles.instructionText}>Complete delivery to finish the request</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity 
          style={[
            styles.completeButton, 
            { opacity: (deliveryPhotos.length === 0 || isCompleting) ? 0.6 : 1 }
          ]}
          onPress={completeDelivery}
          disabled={deliveryPhotos.length === 0 || isCompleting}
        >
          {isCompleting ? (
            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
          ) : (
            <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.completeButtonText}>
            {isUploadingPhotos ? 'Uploading Photos...' : 
             isCompleting ? 'Completing Delivery...' : 
             'Complete Delivery'}
          </Text>
        </TouchableOpacity>
        
        {deliveryPhotos.length === 0 && (
          <Text style={styles.warningText}>⚠️ At least 1 delivery photo required</Text>
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
  successCard: {
    backgroundColor: '#2A2A3B',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  successIcon: {
    marginBottom: 12,
  },
  successTitle: {
    color: '#00D4AA',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  successSubtitle: {
    color: '#aaa',
    fontSize: 14,
  },
  summaryCard: {
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#aaa',
    fontSize: 14,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  priceValue: {
    color: '#00D4AA',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ratingCard: {
    backgroundColor: '#2A2A3B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingSubtitle: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    color: '#A77BFF',
    fontSize: 16,
    fontWeight: '600',
  },
  notesCard: {
    backgroundColor: '#2A2A3B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  notesInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#3A3A4B',
  },
  charCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
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
    color: '#00D4AA',
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
    borderColor: '#00D4AA',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    color: '#00D4AA',
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
    color: '#00D4AA',
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
  completeButton: {
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
  completeButtonText: {
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