import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
    View,
    TouchableWithoutFeedback,
    StyleSheet,
    Animated,
    PanResponder,
    Dimensions,
    Modal,
    Platform,
    Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * BaseModal - Adapted from Linkble for Pikup
 * Handles animations, gestures, and safe area.
 */
const BaseModal = forwardRef(({
    visible,
    onClose,
    children,
    height = SCREEN_HEIGHT * 0.85,
    showHandle = true,
    handleStyle,
    containerStyle,
    renderHeader,
    backgroundColor = '#FFFFFF', // Default to white, can be overridden
    avoidKeyboard = false,
}, ref) => {
    const insets = useSafeAreaInsets();

    // Single animation value - backdrop interpolates from this
    const translateY = useRef(new Animated.Value(height)).current;

    // Keyboard handling
    const keyboardOffset = useRef(new Animated.Value(0)).current;

    // Animate close: slide down, then call onClose
    const animateClose = useCallback(() => {
        // Use timing for close - spring waits for oscillation to settle
        Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true, // Native driver is smoother for transform
        }).start(() => {
            onClose();
        });
    }, [translateY, onClose]);

    useImperativeHandle(ref, () => ({
        close: animateClose
    }));

    // Pan responder
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only respond to vertical gestures
                return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
            },
            onPanResponderGrant: () => {
                // Store current position as offset, reset value to 0
                translateY.setOffset(translateY._value);
                translateY.setValue(0);
            },
            onPanResponderMove: (_, gestureState) => {
                // Only allow dragging down (positive dy)
                if (gestureState.dy >= 0) {
                    translateY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                // Flatten offset back into value
                translateY.flattenOffset();

                const currentY = translateY._value;
                const velocity = gestureState.vy;

                // Determine if should close based on position and velocity
                const shouldClose = velocity > 1.5 || currentY > height * 0.4;

                if (shouldClose) {
                    animateClose();
                } else {
                    // Snap back to open position
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 100,
                        friction: 12,
                    }).start();
                }
            },
        })
    ).current;

    // Handle visibility changes
    useEffect(() => {
        if (visible) {
            // Animate in
            // Reset value first
            translateY.setValue(height);
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 100,
                friction: 12,
            }).start();
        } else {
            // If not visible, we generally want it off screen, but Modal handles unmounting.
            // We set it to height just to be safe for next mounting.
            translateY.setValue(height);
        }
    }, [visible, height]);

    // Keyboard listeners
    useEffect(() => {
        if (!avoidKeyboard) return;

        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onKeyboardShow = (e) => {
            Animated.timing(keyboardOffset, {
                toValue: -e.endCoordinates.height,
                duration: 250,
                useNativeDriver: true,
            }).start();
        };

        const onKeyboardHide = () => {
            Animated.timing(keyboardOffset, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }).start();
        };

        const showListener = Keyboard.addListener(showEvent, onKeyboardShow);
        const hideListener = Keyboard.addListener(hideEvent, onKeyboardHide);

        return () => {
            showListener.remove();
            hideListener.remove();
        };
    }, [avoidKeyboard]);

    // Backdrop opacity interpolated from translateY
    const backdropOpacity = translateY.interpolate({
        inputRange: [0, height],
        outputRange: [0.5, 0],
        extrapolate: 'clamp',
    });

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={animateClose}
        >
            {/* Backdrop - opacity derived from translateY via interpolate */}
            <TouchableWithoutFeedback onPress={animateClose}>
                <Animated.View
                    style={[
                        styles.backdrop,
                        {
                            opacity: backdropOpacity,
                        },
                    ]}
                />
            </TouchableWithoutFeedback>

            {/* Modal Content */}
            <Animated.View
                style={[
                    styles.container,
                    {
                        backgroundColor: backgroundColor,
                        height: height,
                        // Combine animations
                        transform: [{ translateY }, { translateY: keyboardOffset }],
                    },
                    containerStyle,
                ]}
            >
                {/* Drag Handle */}
                {showHandle && (
                    <View
                        {...panResponder.panHandlers}
                        style={[styles.handleContainer, handleStyle]}
                    >
                        <View style={styles.handle} />
                    </View>
                )}

                {renderHeader && renderHeader(animateClose)}

                <View style={{ flex: 1 }}>
                    {typeof children === 'function' ? children(animateClose) : children}
                </View>

                {/* Safe area spacer for bottom devices */}
                <View style={{ height: insets.bottom }} />
            </Animated.View>
        </Modal>
    );
});

export default BaseModal;

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        zIndex: 998,
    },
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 20,
        zIndex: 999,
        overflow: 'hidden',
        // Shadow for elevation look
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    handleContainer: {
        paddingTop: 12,
        paddingBottom: 8,
        alignItems: 'center',
        width: '100%',
        backgroundColor: 'transparent',
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E0E0E0',
    },
});
