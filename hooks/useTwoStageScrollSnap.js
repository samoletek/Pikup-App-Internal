import { Animated } from 'react-native';
import { useCallback, useRef } from 'react';

export default function useTwoStageScrollSnap({
  searchCollapseDistance,
  titleCollapseDistance,
}) {
  const totalCollapseDistance = searchCollapseDistance + titleCollapseDistance;
  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const isSnappingRef = useRef(false);

  const getSnapOffset = useCallback((offsetY) => {
    if (offsetY < 0 || offsetY > totalCollapseDistance) {
      return null;
    }

    if (offsetY < searchCollapseDistance) {
      return offsetY < searchCollapseDistance / 2 ? 0 : searchCollapseDistance;
    }

    const titleProgress = offsetY - searchCollapseDistance;
    return titleProgress < titleCollapseDistance / 2
      ? searchCollapseDistance
      : totalCollapseDistance;
  }, [searchCollapseDistance, titleCollapseDistance, totalCollapseDistance]);

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
