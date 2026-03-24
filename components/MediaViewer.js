// Media Viewer component: renders its UI and handles related interactions.
import React from "react";
import {
    Animated,
    Dimensions,
    FlatList,
    Image,
    Modal,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { ResizeMode, Video } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../styles/theme";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const DISMISS_THRESHOLD = 100;
const PAN_ACTIVATION_THRESHOLD = 8;
const DEFAULT_MEDIA_TYPE = "image";
const clampIndex = (index, maxLength) => {
    if (maxLength <= 0) return 0;
    const parsed = Number(index);
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(Math.max(Math.round(parsed), 0), maxLength - 1);
};

/**
 * Full-screen media viewer with swipe-to-dismiss
 * @param {boolean} visible - Whether the modal is visible
 * @param {string} mediaUri - URI of the media to display
 * @param {string[]} mediaItems - Gallery list for horizontal swipe navigation
 * @param {number} initialIndex - Initial index when gallery list is provided
 * @param {"image"|"video"} mediaType - Media type
 * @param {string} imageUri - Legacy image URI fallback
 * @param {function} onClose - Callback when viewer is closed
 */
export default function MediaViewer({
    visible,
    mediaUri,
    mediaItems = [],
    initialIndex = 0,
    mediaType = DEFAULT_MEDIA_TYPE,
    imageUri,
    onClose,
}) {
    const insets = useSafeAreaInsets();
    const translateY = React.useRef(new Animated.Value(0)).current;
    const opacity = React.useRef(new Animated.Value(1)).current;
    const isClosingRef = React.useRef(false);
    const resolvedMediaUri = mediaUri || imageUri || null;
    const resolvedMediaType = mediaType === "video" ? "video" : DEFAULT_MEDIA_TYPE;
    const resolvedMediaItems = Array.isArray(mediaItems)
        ? mediaItems.filter((item) => Boolean(item))
        : [];
    const fallbackItems = resolvedMediaUri ? [resolvedMediaUri] : [];
    const galleryItems = resolvedMediaItems.length > 0 ? resolvedMediaItems : fallbackItems;
    const hasGallery = galleryItems.length > 1;
    const listRef = React.useRef(null);
    const [currentIndex, setCurrentIndex] = React.useState(() =>
        clampIndex(initialIndex, galleryItems.length)
    );
    const [isVerticalPanActive, setIsVerticalPanActive] = React.useState(false);

    const shouldActivateVerticalPan = React.useCallback((gestureState) => {
        const verticalDistance = Math.abs(gestureState.dy);
        const horizontalDistance = Math.abs(gestureState.dx);

        // In gallery mode FlatList can accumulate horizontal delta early, so keep
        // a relaxed dominance threshold to preserve swipe-to-dismiss reliability.
        const horizontalDominanceLimit = hasGallery ? 0.6 : 1;

        return (
            verticalDistance > PAN_ACTIVATION_THRESHOLD &&
            verticalDistance >= horizontalDistance * horizontalDominanceLimit
        );
    }, [hasGallery]);

    React.useEffect(() => {
        if (!visible) {
            translateY.setValue(0);
            opacity.setValue(1);
            isClosingRef.current = false;
            setIsVerticalPanActive(false);
        }
    }, [opacity, translateY, visible]);

    React.useEffect(() => {
        const nextIndex = clampIndex(initialIndex, galleryItems.length);
        setCurrentIndex(nextIndex);
    }, [galleryItems.length, initialIndex, visible]);

    React.useEffect(() => {
        if (!visible || galleryItems.length === 0 || !listRef.current) {
            return;
        }

        const nextIndex = clampIndex(initialIndex, galleryItems.length);
        requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({
                index: nextIndex,
                animated: false,
            });
        });
    }, [galleryItems.length, initialIndex, visible]);

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

    const panResponder = React.useMemo(() =>
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gestureState) =>
                shouldActivateVerticalPan(gestureState),
            onMoveShouldSetPanResponderCapture: (_, gestureState) =>
                shouldActivateVerticalPan(gestureState),
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: () => {
                setIsVerticalPanActive(true);
            },
            onPanResponderMove: (_, gestureState) => {
                translateY.setValue(gestureState.dy);
                const newOpacity = Math.max(0, 1 - Math.abs(gestureState.dy) / SCREEN_HEIGHT);
                opacity.setValue(newOpacity);
            },
            onPanResponderRelease: (_, gestureState) => {
                setIsVerticalPanActive(false);
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
                setIsVerticalPanActive(false);
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
    , [opacity, shouldActivateVerticalPan, translateY]);

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

    const handleGalleryMomentumEnd = (event) => {
        const offsetX = event?.nativeEvent?.contentOffset?.x || 0;
        const index = Math.round(offsetX / SCREEN_WIDTH);
        setCurrentIndex(clampIndex(index, galleryItems.length));
    };

    const renderGalleryItem = React.useCallback(
        ({ item }) => {
            if (resolvedMediaType === "video") {
                return (
                    <View style={styles.gallerySlide}>
                        <Video
                            source={{ uri: item }}
                            style={styles.media}
                            pointerEvents="none"
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay
                            useNativeControls={false}
                            isLooping={false}
                        />
                    </View>
                );
            }

            return (
                <View style={styles.gallerySlide}>
                    <Image source={{ uri: item }} style={styles.media} resizeMode="contain" />
                </View>
            );
        },
        [resolvedMediaType]
    );

    if (galleryItems.length === 0) return null;

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
                    {hasGallery ? (
                        <FlatList
                            ref={listRef}
                            data={galleryItems}
                            keyExtractor={(item, index) => `${item}-${index}`}
                            renderItem={renderGalleryItem}
                            horizontal
                            pagingEnabled
                            bounces={false}
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={handleGalleryMomentumEnd}
                            scrollEnabled={!isVerticalPanActive}
                            initialScrollIndex={clampIndex(initialIndex, galleryItems.length)}
                            getItemLayout={(_, index) => ({
                                length: SCREEN_WIDTH,
                                offset: SCREEN_WIDTH * index,
                                index,
                            })}
                            onScrollToIndexFailed={(info) => {
                                const fallbackIndex = clampIndex(info?.index || 0, galleryItems.length);
                                requestAnimationFrame(() => {
                                    listRef.current?.scrollToIndex({
                                        index: fallbackIndex,
                                        animated: false,
                                    });
                                });
                            }}
                        />
                    ) : renderGalleryItem({ item: galleryItems[0] })}
                </Animated.View>

                {hasGallery ? (
                    <View style={styles.counterContainer}>
                        <Text style={styles.counterText}>
                            {currentIndex + 1} / {galleryItems.length}
                        </Text>
                    </View>
                ) : null}
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
    gallerySlide: {
        width: SCREEN_WIDTH,
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
    media: {
        width: "100%",
        height: "100%",
    },
    counterContainer: {
        position: "absolute",
        bottom: spacing.lg * 1.6,
        alignSelf: "center",
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        borderRadius: 12,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
    },
    counterText: {
        color: colors.white,
        fontSize: 12,
        fontWeight: "600",
    },
});
