import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Modal,
    Platform,
    FlatList,
    Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Boundary box dimensions
const BOX_WIDTH = SCREEN_WIDTH * 0.82;
const BOX_HEIGHT = BOX_WIDTH * 0.78;
const BOX_TOP = (SCREEN_HEIGHT - BOX_HEIGHT) / 2 - 60;
const CORNER_SIZE = 28;
const CORNER_THICKNESS = 3;

const THUMB_SIZE = 56;
const MAX_CAMERA_PHOTOS = 10;

const CameraScreen = ({ visible, onCapture, onClose, alreadyCount = 0 }) => {
    const [facing, setFacing] = useState('back');
    const [permission, requestPermission] = useCameraPermissions();
    const [capturedPhotos, setCapturedPhotos] = useState([]);
    const cameraRef = useRef(null);

    const totalLimit = MAX_CAMERA_PHOTOS;
    const canCapture = capturedPhotos.length + alreadyCount < totalLimit;
    const remaining = totalLimit - alreadyCount - capturedPhotos.length;

    const handleCapture = async () => {
        if (!cameraRef.current || !canCapture) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.5,
                base64: false,
            });
            if (photo?.uri) {
                setCapturedPhotos(prev => [...prev, photo]);
            }
        } catch (error) {
            console.error('Camera capture error:', error);
        }
    };

    const handleRemove = (index) => {
        setCapturedPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleDone = () => {
        onCapture(capturedPhotos);
        setCapturedPhotos([]);
    };

    const handleClose = () => {
        setCapturedPhotos([]);
        onClose();
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            statusBarTranslucent
            onRequestClose={handleClose}
        >
            {!permission?.granted ? (
                <View style={styles.permissionContainer}>
                    <Ionicons name="camera-outline" size={64} color={colors.text.muted} />
                    <Text style={styles.permissionTitle}>Camera Access Needed</Text>
                    <Text style={styles.permissionSubtitle}>
                        Allow camera access to take photos of your items
                    </Text>
                    <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                        <Text style={styles.permissionBtnText}>Allow Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.permissionCancel} onPress={handleClose}>
                        <Text style={styles.permissionCancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.container}>
                    <CameraView
                        ref={cameraRef}
                        style={StyleSheet.absoluteFill}
                        facing={facing}
                    />

                    {/* Dark overlay panels around the box */}
                    <View style={[styles.overlay, { top: 0, height: BOX_TOP, width: '100%' }]} />
                    <View style={[styles.overlay, {
                        top: BOX_TOP,
                        height: BOX_HEIGHT,
                        width: (SCREEN_WIDTH - BOX_WIDTH) / 2,
                        left: 0,
                    }]} />
                    <View style={[styles.overlay, {
                        top: BOX_TOP,
                        height: BOX_HEIGHT,
                        width: (SCREEN_WIDTH - BOX_WIDTH) / 2,
                        right: 0,
                    }]} />
                    <View style={[styles.overlay, {
                        top: BOX_TOP + BOX_HEIGHT,
                        bottom: 0,
                        width: '100%',
                    }]} />

                    {/* Boundary box corners */}
                    <View style={[styles.boxContainer, {
                        top: BOX_TOP,
                        left: (SCREEN_WIDTH - BOX_WIDTH) / 2,
                        width: BOX_WIDTH,
                        height: BOX_HEIGHT,
                    }]}>
                        <View style={[styles.corner, styles.cornerTL]} />
                        <View style={[styles.corner, styles.cornerTR]} />
                        <View style={[styles.corner, styles.cornerBL]} />
                        <View style={[styles.corner, styles.cornerBR]} />
                    </View>

                    {/* Hint label */}
                    <View style={[styles.hintContainer, { top: BOX_TOP + BOX_HEIGHT + spacing.base }]}>
                        <Ionicons name="scan-outline" size={14} color={colors.primary} />
                        <Text style={styles.hintText}>Center the item in the frame</Text>
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.headerBtn} onPress={handleClose}>
                            <Ionicons name="close" size={28} color={colors.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>
                            {capturedPhotos.length > 0
                                ? `${capturedPhotos.length} photo${capturedPhotos.length > 1 ? 's' : ''} taken`
                                : 'Take Photo'}
                        </Text>
                        <TouchableOpacity
                            style={styles.headerBtn}
                            onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
                        >
                            <Ionicons name="camera-reverse-outline" size={28} color={colors.white} />
                        </TouchableOpacity>
                    </View>

                    {/* Captured thumbnails strip */}
                    {capturedPhotos.length > 0 && (
                        <View style={styles.thumbStrip}>
                            <FlatList
                                data={capturedPhotos}
                                keyExtractor={(_, i) => i.toString()}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.base }}
                                renderItem={({ item, index }) => (
                                    <View style={styles.thumbWrapper}>
                                        <Image source={{ uri: item.uri }} style={styles.thumb} />
                                        <TouchableOpacity
                                            style={styles.thumbRemove}
                                            onPress={() => handleRemove(index)}
                                        >
                                            <Ionicons name="close-circle" size={18} color={colors.error} />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            />
                        </View>
                    )}

                    {/* Bottom controls */}
                    <View style={styles.bottomRow}>
                        {/* Remaining counter (left) */}
                        <View style={styles.counterBox}>
                            {remaining > 0 ? (
                                <Text style={styles.counterText}>{remaining} left</Text>
                            ) : (
                                <Text style={[styles.counterText, { color: colors.warning }]}>Max reached</Text>
                            )}
                        </View>

                        {/* Capture button (center) */}
                        <TouchableOpacity
                            style={[styles.captureBtn, !canCapture && styles.captureBtnDisabled]}
                            onPress={handleCapture}
                            disabled={!canCapture}
                        >
                            <View style={[styles.captureBtnInner, !canCapture && { backgroundColor: colors.border.light }]} />
                        </TouchableOpacity>

                        {/* Done button (right) */}
                        <TouchableOpacity
                            style={[styles.doneBtn, capturedPhotos.length === 0 && styles.doneBtnDisabled]}
                            onPress={handleDone}
                            disabled={capturedPhotos.length === 0}
                        >
                            <Text style={styles.doneBtnText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.black,
    },
    overlay: {
        position: 'absolute',
        backgroundColor: 'rgba(0,0,0,0.60)',
    },
    boxContainer: {
        position: 'absolute',
    },
    corner: {
        position: 'absolute',
        width: CORNER_SIZE,
        height: CORNER_SIZE,
        borderColor: colors.primary,
    },
    cornerTL: {
        top: 0, left: 0,
        borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS,
        borderTopLeftRadius: borderRadius.sm,
    },
    cornerTR: {
        top: 0, right: 0,
        borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS,
        borderTopRightRadius: borderRadius.sm,
    },
    cornerBL: {
        bottom: 0, left: 0,
        borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS,
        borderBottomLeftRadius: borderRadius.sm,
    },
    cornerBR: {
        bottom: 0, right: 0,
        borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS,
        borderBottomRightRadius: borderRadius.sm,
    },
    hintContainer: {
        position: 'absolute',
        left: 0, right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
    },
    hintText: {
        color: colors.primary,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        letterSpacing: 0.3,
    },
    header: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 56 : spacing.xl,
        left: 0, right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
    },
    headerBtn: {
        width: 44, height: 44,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: borderRadius.circle,
    },
    headerTitle: {
        color: colors.white,
        fontSize: typography.fontSize.md,
        fontWeight: typography.fontWeight.bold,
    },

    // Thumbnail strip
    thumbStrip: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 150 : 130,
        left: 0, right: 0,
        height: THUMB_SIZE + spacing.sm * 2,
        paddingVertical: spacing.sm,
    },
    thumbWrapper: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: borderRadius.sm,
        overflow: 'visible',
    },
    thumb: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: borderRadius.sm,
        borderWidth: 2,
        borderColor: colors.white,
    },
    thumbRemove: {
        position: 'absolute',
        top: -6, right: -6,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.circle,
    },

    // Bottom controls row
    bottomRow: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 56 : spacing.xxxl,
        left: 0, right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
    },
    counterBox: {
        width: 72,
        alignItems: 'flex-start',
    },
    counterText: {
        color: colors.white,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        overflow: 'hidden',
    },
    captureBtn: {
        width: 76, height: 76,
        borderRadius: 38,
        borderWidth: 4,
        borderColor: colors.white,
        alignItems: 'center', justifyContent: 'center',
    },
    captureBtnDisabled: {
        borderColor: colors.border.light,
    },
    captureBtnInner: {
        width: 58, height: 58,
        borderRadius: 29,
        backgroundColor: colors.white,
    },
    doneBtn: {
        width: 72,
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
    },
    doneBtnDisabled: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    doneBtnText: {
        color: colors.white,
        fontSize: typography.fontSize.md,
        fontWeight: typography.fontWeight.bold,
    },

    // Permission screen
    permissionContainer: {
        flex: 1,
        backgroundColor: colors.background.primary,
        alignItems: 'center', justifyContent: 'center',
        padding: spacing.xl,
    },
    permissionTitle: {
        color: colors.text.primary,
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
    },
    permissionSubtitle: {
        color: colors.text.muted,
        fontSize: typography.fontSize.base,
        textAlign: 'center',
        lineHeight: typography.fontSize.base * 1.5,
        marginBottom: spacing.xxl,
    },
    permissionBtn: {
        backgroundColor: colors.primary,
        height: 52,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.xxl,
        alignItems: 'center', justifyContent: 'center',
        width: '100%',
    },
    permissionBtnText: {
        color: colors.white,
        fontSize: typography.fontSize.md,
        fontWeight: typography.fontWeight.bold,
    },
    permissionCancel: {
        marginTop: spacing.base,
        padding: spacing.base,
    },
    permissionCancelText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.md,
    },
});

export default CameraScreen;
