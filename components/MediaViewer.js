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
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../styles/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const DISMISS_THRESHOLD = 100;

/**
 * Full-screen media viewer with swipe-to-dismiss
 * @param {boolean} visible - Whether the modal is visible
 * @param {string} imageUri - URI of the image to display
 * @param {function} onClose - Callback when viewer is closed
 */
export default function MediaViewer({ visible, imageUri, onClose }) {
    const insets = useSafeAreaInsets();
    const translateY = React.useRef(new Animated.Value(0)).current;
    const opacity = React.useRef(new Animated.Value(1)).current;

    const panResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dy) > 10;
            },
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
                        translateY.setValue(0);
                        opacity.setValue(1);
                        onClose();
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
        })
    ).current;

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            opacity.setValue(1);
            onClose();
        });
    };

    if (!imageUri) return null;

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

                {/* Image with pan gesture */}
                <Animated.View
                    style={[
                        styles.imageContainer,
                        { transform: [{ translateY }] },
                    ]}
                    {...panResponder.panHandlers}
                >
                    <Image
                        source={{ uri: imageUri }}
                        style={styles.image}
                        resizeMode="contain"
                    />
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
    imageContainer: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
    image: {
        width: "100%",
        height: "100%",
    },
});
