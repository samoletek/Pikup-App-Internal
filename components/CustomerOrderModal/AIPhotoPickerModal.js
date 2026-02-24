import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Image,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../styles/theme';
import { aiPhotoStyles as s } from './styles';
import { SCREEN_HEIGHT } from './styles';
import BaseModal from '../BaseModal';

const MAX_PHOTOS = 20;

const AIPhotoPickerModal = ({ visible, onClose, onAnalyze, isAnalyzing }) => {
    const [photos, setPhotos] = useState([]);

    const handleClose = () => {
        setPhotos([]);
        onClose();
    };

    const handleAddPhoto = () => {
        Alert.alert(
            'Add Photos',
            'Choose a source',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Take Photo', onPress: () => pickPhotos('camera') },
                { text: 'Choose from Gallery', onPress: () => pickPhotos('library') },
            ]
        );
    };

    const pickPhotos = async (source) => {
        try {
            const remaining = MAX_PHOTOS - photos.length;
            if (remaining <= 0) {
                Alert.alert('Limit reached', `You can add up to ${MAX_PHOTOS} photos.`);
                return;
            }

            let result;

            if (source === 'camera') {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Please grant camera permissions.');
                    return;
                }
                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: 'images',
                    allowsEditing: false,
                    quality: 0.5,
                    base64: false,
                });
            } else {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Please grant photo library permissions.');
                    return;
                }
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: 'images',
                    allowsMultipleSelection: true,
                    selectionLimit: remaining,
                    allowsEditing: false,
                    quality: 0.5,
                    base64: false,
                });
            }

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setPhotos(prev => {
                    const combined = [...prev, ...result.assets];
                    return combined.slice(0, MAX_PHOTOS);
                });
            }
        } catch (error) {
            console.error('Image picker error:', error);
            Alert.alert('Error', 'Failed to pick photos.');
        }
    };

    const handleRemovePhoto = (index) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleIdentify = () => {
        if (photos.length === 0) return;
        onAnalyze(photos);
        setPhotos([]);
    };

    const canIdentify = photos.length > 0 && !isAnalyzing;

    return (
        <BaseModal
            visible={visible}
            onClose={handleClose}
            onBackdropPress={handleClose}
            height={SCREEN_HEIGHT * 0.9}
            backgroundColor={colors.background.secondary}
            avoidKeyboard={false}
            renderHeader={() => (
                <View style={s.header}>
                    <View style={s.headerBtn} />
                    <Text style={s.headerTitle}>AI Item Detection</Text>
                    <TouchableOpacity style={s.headerBtn} onPress={handleClose}>
                        <Ionicons name="close" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                </View>
            )}
        >
            {/* Photo Grid Area */}
            <ScrollView
                style={s.photoArea}
                contentContainerStyle={[
                    s.photoAreaContent,
                    photos.length === 0 && s.photoAreaEmpty,
                ]}
                showsVerticalScrollIndicator={false}
            >
                {photos.length === 0 ? (
                    <View style={s.placeholder}>
                        <Ionicons name="images-outline" size={56} color={colors.border.light} />
                        <Text style={s.placeholderTitle}>No photos yet</Text>
                        <Text style={s.placeholderSubtitle}>
                            Add up to {MAX_PHOTOS} photos and AI will identify all items
                        </Text>
                    </View>
                ) : (
                    <View style={s.grid}>
                        {photos.map((photo, index) => (
                            <View key={`${photo.uri}-${index}`} style={s.thumbWrapper}>
                                <Image source={{ uri: photo.uri }} style={s.thumb} />
                                <TouchableOpacity
                                    style={s.thumbDelete}
                                    onPress={() => handleRemovePhoto(index)}
                                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                                >
                                    <Ionicons name="close-circle" size={20} color={colors.error} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Footer */}
            <View style={s.footer}>
                {photos.length > 0 && (
                    <Text style={s.photoCount}>
                        {photos.length} / {MAX_PHOTOS} photos
                    </Text>
                )}

                <View style={s.footerButtons}>
                    <TouchableOpacity
                        style={s.addPhotoBtn}
                        onPress={handleAddPhoto}
                        disabled={isAnalyzing || photos.length >= MAX_PHOTOS}
                    >
                        <Ionicons name="camera-outline" size={20} color={colors.primary} />
                        <Text style={s.addPhotoBtnText}>Add Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[s.identifyBtn, !canIdentify && s.identifyBtnDisabled]}
                        onPress={handleIdentify}
                        disabled={!canIdentify}
                    >
                        {isAnalyzing ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <Ionicons name="sparkles" size={20} color={colors.white} />
                        )}
                        <Text style={s.identifyBtnText}>
                            {isAnalyzing ? 'Analyzing...' : 'Identify with AI'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </BaseModal>
    );
};

export default AIPhotoPickerModal;
