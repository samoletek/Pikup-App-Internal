import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { logger } from '../../services/logger';

export default function useClaimDocuments() {
  const [selectedDocuments, setSelectedDocuments] = useState([]);

  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const document = {
          id: Date.now().toString(),
          uri: result.assets[0].uri,
          name: `photo_${Date.now()}.jpg`,
          type: 'image/jpeg',
          size: result.assets[0].fileSize || 0,
          documentType: 'PHOTOS_DAMAGE',
        };
        setSelectedDocuments((prev) => [...prev, document]);
      }
    } catch (error) {
      logger.error('ClaimDocuments', 'Error taking photo', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  }, []);

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const document = {
          id: Date.now().toString(),
          uri: result.assets[0].uri,
          name: result.assets[0].name,
          type: result.assets[0].mimeType,
          size: result.assets[0].size,
          documentType: 'OTHER',
        };
        setSelectedDocuments((prev) => [...prev, document]);
      }
    } catch (error) {
      logger.error('ClaimDocuments', 'Error picking document', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  }, []);

  const handleAddDocument = useCallback(async () => {
    Alert.alert('Add Document', 'Choose document type', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose File', onPress: pickDocument },
    ]);
  }, [pickDocument, takePhoto]);

  const removeDocument = useCallback((documentId) => {
    setSelectedDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
  }, []);

  const clearDocuments = useCallback(() => {
    setSelectedDocuments([]);
  }, []);

  return {
    selectedDocuments,
    setSelectedDocuments,
    clearDocuments,
    handleAddDocument,
    removeDocument,
  };
}
