import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';

export default function useCollapsibleTitleSnap({ collapseDistance }) {
  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const isSnappingRef = useRef(false);

  const getSnapOffset = useCallback((offsetY) => {
    if (offsetY < 0 || offsetY > collapseDistance) {
      return null;
    }
    return offsetY < collapseDistance / 2 ? 0 : collapseDistance;
  }, [collapseDistance]);

  const snapToNearestOffset = useCallback((offsetY) => {
    const targetOffset = getSnapOffset(offsetY);
    if (targetOffset === null || Math.abs(targetOffset - offsetY) < 1) {
      return;
    }

    if (!scrollRef.current) {
      return;
    }

    isSnappingRef.current = true;
    scrollRef.current.scrollTo({ y: targetOffset, animated: true });
    setTimeout(() => {
      isSnappingRef.current = false;
    }, 220);
  }, [getSnapOffset]);

  const handleScrollEndDrag = useCallback((event) => {
    if (isSnappingRef.current) {
      return;
    }

    const velocityY = event.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(velocityY) < 0.15) {
      snapToNearestOffset(event.nativeEvent.contentOffset.y);
    }
  }, [snapToNearestOffset]);

  const handleMomentumScrollEnd = useCallback((event) => {
    if (isSnappingRef.current) {
      return;
    }
    snapToNearestOffset(event.nativeEvent.contentOffset.y);
  }, [snapToNearestOffset]);

  return {
    scrollRef,
    scrollY,
    handleScrollEndDrag,
    handleMomentumScrollEnd,
  };
}
