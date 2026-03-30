import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
    View,
    TouchableWithoutFeedback,
    StyleSheet,
    Animated,
    PanResponder,
    Dimensions,
    Modal,
    Keyboard,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../styles/theme';

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
    backgroundColor = colors.background.surface,
    onBackdropPress,
    avoidKeyboard = false,
    disableDrag = false,
    bottomInsetEnabled = true,
}, ref) => {
    const insets = useSafeAreaInsets();

    // Single animation value - backdrop interpolates from this
    const translateY = useRef(new Animated.Value(height)).current;
    const keyboardTranslateY = useRef(new Animated.Value(0)).current;

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

    // Track if currently closing to prevent backdrop press during close
    const isClosingRef = useRef(false);

    // Store latest animateClose in ref to avoid stale closure in panResponder
    const animateCloseRef = useRef(animateClose);
    useEffect(() => {
        animateCloseRef.current = animateClose;
    }, [animateClose]);

    // Track disableDrag via ref so panResponder (created once) can read latest value
    const disableDragRef = useRef(disableDrag);
    useEffect(() => {
        disableDragRef.current = disableDrag;
    }, [disableDrag]);

    // Pan responder
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !disableDragRef.current,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                if (disableDragRef.current) return false;
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
                    // Mark as closing to prevent backdrop press from triggering
                    isClosingRef.current = true;
                    animateCloseRef.current();
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

    // Handle backdrop press - check if not already closing
    const handleBackdropPress = useCallback(() => {
        if (isClosingRef.current) return;
        if (onBackdropPress) {
            onBackdropPress();
        } else {
            animateClose();
        }
    }, [onBackdropPress, animateClose]);

    // Handle visibility changes only; height changes while visible should not retrigger open animation.
    useEffect(() => {
        if (visible) {
            // Reset closing state when modal opens
            isClosingRef.current = false;
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
            keyboardTranslateY.setValue(0);
        }
    }, [keyboardTranslateY, translateY, visible]);

    useEffect(() => {
        if (!visible || !avoidKeyboard) {
            Animated.timing(keyboardTranslateY, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }).start();
            return;
        }

        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const handleKeyboardShow = (event) => {
            const keyboardHeight = event?.endCoordinates?.height || 0;
            const shiftY = Math.max(0, keyboardHeight - insets.bottom);

            Animated.timing(keyboardTranslateY, {
                toValue: -shiftY,
                duration: event?.duration || 220,
                useNativeDriver: true,
            }).start();
        };

        const handleKeyboardHide = (event) => {
            Animated.timing(keyboardTranslateY, {
                toValue: 0,
                duration: event?.duration || 180,
                useNativeDriver: true,
            }).start();
        };

        const showSub = Keyboard.addListener(showEvent, handleKeyboardShow);
        const hideSub = Keyboard.addListener(hideEvent, handleKeyboardHide);

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [avoidKeyboard, insets.bottom, keyboardTranslateY, visible]);

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
            statusBarTranslucent={true}
            onRequestClose={animateClose}
        >
            {/* Backdrop - opacity derived from translateY via interpolate */}
            <TouchableWithoutFeedback onPress={handleBackdropPress}>
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
                        transform: [{ translateY: Animated.add(translateY, keyboardTranslateY) }],
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
                <View style={{ height: bottomInsetEnabled ? insets.bottom : 0 }} />
            </Animated.View>
        </Modal>
    );
});

export default BaseModal;

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.black,
        zIndex: 998,
    },
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        // Anchor to bottom to avoid window/screen height mismatch gaps on some Android devices.
        bottom: 0,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        zIndex: 999,
        overflow: 'hidden',
        // Shadow for elevation look
        shadowColor: colors.black,
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
        backgroundColor: colors.border.inverse,
    },
});
