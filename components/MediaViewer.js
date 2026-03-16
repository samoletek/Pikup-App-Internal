// Media Viewer component: renders its UI and handles related interactions.
import React from "react";
import {
    Animated,
    Dimensions,
    Image,
    Modal,
    PanResponder,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { ResizeMode, Video } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../styles/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const DISMISS_THRESHOLD = 100;

/**
 * Full-screen media viewer with swipe-to-dismiss
 * @param {boolean} visible - Whether the modal is visible
 * @param {string} mediaUri - URI of the media to display
 * @param {"image"|"video"} mediaType - Media type
 * @param {string} imageUri - Legacy image URI fallback
 * @param {function} onClose - Callback when viewer is closed
 */
export default function MediaViewer({ visible, mediaUri, mediaType = "image", imageUri, onClose }) {
    const insets = useSafeAreaInsets();
    const translateY = React.useRef(new Animated.Value(0)).current;
    const opacity = React.useRef(new Animated.Value(1)).current;
    const isClosingRef = React.useRef(false);
    const resolvedMediaUri = mediaUri || imageUri || null;
    const resolvedMediaType = mediaType === "video" ? "video" : "image";

    React.useEffect(() => {
        if (!visible) {
            translateY.setValue(0);
            opacity.setValue(1);
            isClosingRef.current = false;
        }
    }, [opacity, translateY, visible]);

    const closeViewer = React.useCallback(() => {
        if (isClosingRef.current) {
            return;
        }

        isClosingRef.current = true;
        onClose?.();
    }, [onClose]);

    // Keep a ref to closeViewer so panResponder (created once) always calls the latest version
    const closeViewerRef = React.useRef(closeViewer);
    React.useEffect(() => {
        closeViewerRef.current = closeViewer;
    }, [closeViewer]);

    const panResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dy) > 10;
            },
            onPanResponderTerminationRequest: () => false,
            onPanResponderMove: (_, gestureState) => {
                translateY.setValue(gestureState.dy);
                const newOpacity = Math.max(0, 1 - Math.abs(gestureState.dy) / SCREEN_HEIGHT);
                opacity.setValue(newOpacity);
            },
            onPanResponderRelease: (_, gestureState) => {
                if (Math.abs(gestureState.dy) > DISMISS_THRESHOLD) {
                    // Dismiss
                    Animated.parallel([
                        Animated.timing(translateY, {
                            toValue: gestureState.dy > 0 ? SCREEN_HEIGHT : -SCREEN_HEIGHT,
                            duration: 200,
                            useNativeDriver: true,
                        }),
                        Animated.timing(opacity, {
                            toValue: 0,
                            duration: 200,
                            useNativeDriver: true,
                        }),
                    ]).start(() => {
                        closeViewerRef.current();
                    });
                } else {
                    // Snap back
                    Animated.parallel([
                        Animated.spring(translateY, {
                            toValue: 0,
                            useNativeDriver: true,
                            tension: 100,
                            friction: 10,
                        }),
                        Animated.timing(opacity, {
                            toValue: 1,
                            duration: 150,
                            useNativeDriver: true,
                        }),
                    ]).start();
                }
            },
            onPanResponderTerminate: () => {
                Animated.parallel([
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 100,
                        friction: 10,
                    }),
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: 150,
                        useNativeDriver: true,
                    }),
                ]).start();
            },
        })
    ).current;

    const handleClose = () => {
        if (isClosingRef.current) {
            return;
        }

        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            closeViewer();
        });
    };

    if (!resolvedMediaUri) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <Animated.View style={[styles.container, { opacity }]}>
                {/* Close button */}
                <TouchableOpacity
                    style={[styles.closeButton, { top: insets.top + spacing.base }]}
                    onPress={handleClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <View style={styles.closeButtonBg}>
                        <Ionicons name="close" size={24} color={colors.white} />
                    </View>
                </TouchableOpacity>

                {/* Media with pan gesture */}
                <Animated.View
                    style={[
                        styles.mediaContainer,
                        { transform: [{ translateY }] },
                    ]}
                    {...panResponder.panHandlers}
                >
                    {resolvedMediaType === "video" ? (
                        <Video
                            source={{ uri: resolvedMediaUri }}
                            style={styles.media}
                            pointerEvents="none"
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay
                            useNativeControls={false}
                            isLooping={false}
                        />
                    ) : (
                        <Image
                            source={{ uri: resolvedMediaUri }}
                            style={styles.media}
                            resizeMode="contain"
                        />
                    )}
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.95)",
        justifyContent: "center",
        alignItems: "center",
    },
    closeButton: {
        position: "absolute",
        right: spacing.base,
        zIndex: 10,
    },
    closeButtonBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    mediaContainer: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
    media: {
        width: "100%",
        height: "100%",
    },
});
