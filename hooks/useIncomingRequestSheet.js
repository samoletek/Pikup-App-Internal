import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder } from 'react-native';
import {
  SNAP_HALF,
  SNAP_HIDDEN,
  SNAP_POINTS,
  SNAP_FULL,
} from '../components/incomingRequestModal/incomingRequestModal.utils';

export default function useIncomingRequestSheet({
  visible,
  request,
  onDecline,
  onMinimize,
  onSnapChange,
}) {
  const [currentSnap, setCurrentSnap] = useState(1);
  const translateY = useRef(new Animated.Value(SNAP_HIDDEN)).current;
  const snapIndexRef = useRef(1);
  const onMinimizeRef = useRef(onMinimize);
  const onDeclineRef = useRef(onDecline);

  useEffect(() => {
    onMinimizeRef.current = onMinimize;
  }, [onMinimize]);

  useEffect(() => {
    onDeclineRef.current = onDecline;
  }, [onDecline]);

  useEffect(() => {
    if (!visible || !request) {
      return;
    }

    snapIndexRef.current = 1;
    setCurrentSnap(1);
    translateY.setValue(SNAP_HIDDEN);
    Animated.spring(translateY, {
      toValue: SNAP_HALF,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
    onSnapChange?.(1);
  }, [onSnapChange, request, translateY, visible]);

  const dismiss = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SNAP_HIDDEN,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onDeclineRef.current?.());
  }, [translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderGrant: () => {
        translateY.setOffset(translateY._value);
        translateY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        translateY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();
        const currentY = translateY._value;
        const velocity = gestureState.vy;
        const currentSnapIndex = snapIndexRef.current;

        if (velocity > 1.5 && currentSnapIndex >= 1) {
          Animated.timing(translateY, {
            toValue: SNAP_HIDDEN,
            duration: 250,
            useNativeDriver: true,
          }).start(() => onMinimizeRef.current?.());
          return;
        }

        if (currentY > SNAP_HALF + (SNAP_HIDDEN - SNAP_HALF) * 0.3) {
          Animated.timing(translateY, {
            toValue: SNAP_HIDDEN,
            duration: 250,
            useNativeDriver: true,
          }).start(() => onMinimizeRef.current?.());
          return;
        }

        let targetSnapIndex = 1;
        if (velocity > 1.5) {
          targetSnapIndex = Math.min(currentSnapIndex + 1, SNAP_POINTS.length - 1);
        } else if (velocity < -1.5) {
          targetSnapIndex = Math.max(currentSnapIndex - 1, 0);
        } else {
          let minDistance = Infinity;
          SNAP_POINTS.forEach((snapPoint, index) => {
            const distance = Math.abs(currentY - snapPoint);
            if (distance < minDistance) {
              minDistance = distance;
              targetSnapIndex = index;
            }
          });
        }

        snapIndexRef.current = targetSnapIndex;
        setCurrentSnap(targetSnapIndex);
        Animated.spring(translateY, {
          toValue: SNAP_POINTS[targetSnapIndex],
          useNativeDriver: true,
          tension: 100,
          friction: 14,
        }).start();
        onSnapChange?.(targetSnapIndex);
      },
    })
  ).current;

  const backdropOpacity = translateY.interpolate({
    inputRange: [SNAP_FULL, SNAP_HALF, SNAP_HIDDEN],
    outputRange: [0.6, 0.4, 0],
    extrapolate: 'clamp',
  });

  return {
    currentSnap,
    translateY,
    backdropOpacity,
    dismiss,
    panHandlers: panResponder.panHandlers,
  };
}
