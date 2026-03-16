import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export default function useNavigationCardAnimation({ isLoading }) {
  const cardAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoading) {
      return;
    }

    Animated.parallel([
      Animated.timing(cardAnimation, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardAnimation, fadeAnimation, isLoading]);

  return {
    cardAnimation,
    fadeAnimation,
  };
}
