import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder } from 'react-native';

const DRAG_THRESHOLD = 28;
const DEFAULT_COLLAPSED_HEIGHT = 76;

export default function useDeliveryTrackerSheet({
  variant,
  expanded,
  maxExpandedHeight,
  onExpandedChange,
  onViewFullTracker,
  requestId,
}) {
  const isSheetVariant = variant === 'sheet';
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [collapsedSheetHeight, setCollapsedSheetHeight] = useState(DEFAULT_COLLAPSED_HEIGHT);
  const [isSheetClosing, setIsSheetClosing] = useState(false);
  const isExpandedRef = useRef(Boolean(expanded));
  const sheetAnimationRef = useRef(null);
  const sheetHeightAnim = useRef(
    new Animated.Value(Boolean(expanded) ? maxExpandedHeight : DEFAULT_COLLAPSED_HEIGHT)
  ).current;

  const animateSheetHeight = useCallback((toValue, options = {}) => {
    const { type = 'expand', onComplete } = options;

    if (!isSheetVariant) {
      onComplete?.(true);
      return;
    }

    if (sheetAnimationRef.current) {
      sheetAnimationRef.current.stop();
    }

    const animation =
      type === 'collapse'
        ? Animated.timing(sheetHeightAnim, {
          toValue,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        })
        : Animated.spring(sheetHeightAnim, {
          toValue,
          useNativeDriver: false,
          tension: 100,
          friction: 12,
        });

    sheetAnimationRef.current = animation;
    animation.start(({ finished }) => {
      if (sheetAnimationRef.current === animation) {
        sheetAnimationRef.current = null;
      }
      onComplete?.(finished);
    });
  }, [isSheetVariant, sheetHeightAnim]);

  useEffect(() => {
    const normalizedExpanded = Boolean(expanded);
    if (normalizedExpanded === isExpanded) {
      return;
    }

    if (normalizedExpanded) {
      setIsSheetClosing(false);
    } else if (isSheetVariant) {
      setIsSheetClosing(true);
    }
    setIsExpanded(normalizedExpanded);
  }, [expanded, isExpanded, isSheetVariant, requestId]);

  useEffect(() => {
    isExpandedRef.current = Boolean(isExpanded);
  }, [isExpanded]);

  useEffect(() => {
    if (!isSheetVariant) {
      return undefined;
    }

    const expandedHeight = Math.max(maxExpandedHeight, collapsedSheetHeight);

    if (isExpanded) {
      setIsSheetClosing(false);
      animateSheetHeight(expandedHeight, { type: 'expand' });
      return undefined;
    }

    setIsSheetClosing(true);
    animateSheetHeight(collapsedSheetHeight, {
      type: 'collapse',
      onComplete: (finished) => {
        if (!finished) return;
        if (!isExpandedRef.current) {
          setIsSheetClosing(false);
        }
      },
    });

    return undefined;
  }, [
    animateSheetHeight,
    collapsedSheetHeight,
    isExpanded,
    isSheetVariant,
    maxExpandedHeight,
  ]);

  useEffect(() => {
    if (!isSheetVariant) {
      return undefined;
    }

    return () => {
      if (sheetAnimationRef.current) {
        sheetAnimationRef.current.stop();
        sheetAnimationRef.current = null;
      }
    };
  }, [isSheetVariant]);

  const setExpandedState = useCallback((nextExpanded) => {
    const normalizedValue = Boolean(nextExpanded);
    if (normalizedValue === isExpanded) {
      return;
    }

    if (normalizedValue) {
      setIsSheetClosing(false);
    } else if (isSheetVariant) {
      setIsSheetClosing(true);
    }
    setIsExpanded(normalizedValue);
    if (typeof onExpandedChange === 'function') {
      onExpandedChange(normalizedValue);
    }
  }, [isExpanded, isSheetVariant, onExpandedChange]);

  const toggleExpanded = useCallback(() => {
    if (onViewFullTracker) {
      onViewFullTracker();
      return;
    }
    setExpandedState(!isExpanded);
  }, [isExpanded, onViewFullTracker, setExpandedState]);

  const handleCollapse = useCallback(() => {
    setExpandedState(false);
  }, [setExpandedState]);

  const sheetPanHandlers = useMemo(() => {
    if (!isSheetVariant) {
      return {};
    }

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy <= -DRAG_THRESHOLD) {
          setExpandedState(true);
          return;
        }

        if (gestureState.dy >= DRAG_THRESHOLD) {
          setExpandedState(false);
        }
      },
    }).panHandlers;
  }, [isSheetVariant, setExpandedState]);

  const handleCompactLayout = useCallback((event) => {
    const measuredHeight = Math.ceil(event?.nativeEvent?.layout?.height || 0);
    if (!measuredHeight || measuredHeight === collapsedSheetHeight) {
      return;
    }

    setCollapsedSheetHeight(measuredHeight);
    if (!isExpanded && !isSheetClosing) {
      sheetHeightAnim.setValue(measuredHeight);
    }
  }, [collapsedSheetHeight, isExpanded, isSheetClosing, sheetHeightAnim]);

  return {
    isExpanded,
    isSheetVariant,
    isSheetClosing,
    sheetHeightAnim,
    sheetPanHandlers,
    toggleExpanded,
    handleCollapse,
    handleCompactLayout,
  };
}
