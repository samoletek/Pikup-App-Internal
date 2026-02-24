import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Image,
    Alert,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../styles/theme';
import { aiPhotoStyles as s } from './styles';
import { SCREEN_HEIGHT } from './styles';
import BaseModal from '../BaseModal';
import CameraScreen from './CameraScreen';

const MAX_PHOTOS = 20;

const AIPhotoPickerModal = ({ visible, onClose, onAnalyze, isAnalyzing }) => {
    const [photos, setPhotos] = useState([]);
    const [showCamera, setShowCamera] = useState(false);

    // Clear photos when modal is closed
    React.useEffect(() => {
        if (!visible) {
            setPhotos([]);
        }
    }, [visible]);

    const handleClose = () => {
        if (isAnalyzing) return;
        setPhotos([]);
        onClose();
    };

    const handleAddPhoto = () => {
        Alert.alert(
            'Add Photos',
            'Choose a source',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Take Photo', onPress: () => setShowCamera(true) },
                { text: 'Choose from Gallery', onPress: () => pickFromLibrary() },
            ]
        );
    };

    const handleCameraCapture = (newPhotos) => {
        setShowCamera(false);
        if (newPhotos && newPhotos.length > 0) {
            setPhotos(prev => [...prev, ...newPhotos].slice(0, MAX_PHOTOS));
        }
    };

    const pickFromLibrary = async () => {
        try {
            const remaining = MAX_PHOTOS - photos.length;
            if (remaining <= 0) {
                Alert.alert('Limit reached', `You can add up to ${MAX_PHOTOS} photos.`);
                return;
            }
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant photo library permissions.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                allowsMultipleSelection: true,
                selectionLimit: remaining,
                allowsEditing: false,
                quality: 0.5,
                base64: false,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setPhotos(prev => [...prev, ...result.assets].slice(0, MAX_PHOTOS));
            }
        } catch (error) {
            console.error('Library picker error:', error);
            Alert.alert('Error', 'Failed to pick photos.');
        }
    };

    const handleRemovePhoto = (index) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleIdentify = () => {
        if (photos.length === 0 || isAnalyzing) return;
        onAnalyze(photos);
        // Modal stays open — closes from ItemsStep after analysis completes
    };

    const canIdentify = photos.length > 0 && !isAnalyzing;

    return (
        <BaseModal
            visible={visible}
            onClose={handleClose}
            onBackdropPress={isAnalyzing ? () => { } : handleClose}
            height={SCREEN_HEIGHT * 0.9}
            backgroundColor={colors.background.secondary}
            avoidKeyboard={false}
            disableDrag={isAnalyzing}
            renderHeader={() => (
                <View style={s.header}>
                    <View style={s.headerBtn} />
                    <Text style={s.headerTitle}>AI Item Detection</Text>
                    <TouchableOpacity
                        style={s.headerBtn}
                        onPress={handleClose}
                        disabled={isAnalyzing}
                    >
                        <Ionicons
                            name="close"
                            size={24}
                            color={isAnalyzing ? colors.text.muted : colors.text.primary}
                        />
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

            {/* Blocking overlay during analysis */}
            {isAnalyzing && (
                <View style={overlayStyle.overlay} pointerEvents="box-only">
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={overlayStyle.overlayText}>Analyzing photos...</Text>
                </View>
            )}

            {/* Custom Camera with boundary box */}
            <CameraScreen
                visible={showCamera}
                onCapture={handleCameraCapture}
                onClose={() => setShowCamera(false)}
                alreadyCount={photos.length}
            />

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

const overlayStyle = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10, 10, 31, 0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    overlayText: {
        color: colors.text.primary,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default AIPhotoPickerModal;
