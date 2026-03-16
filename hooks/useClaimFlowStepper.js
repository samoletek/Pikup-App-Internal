import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function useClaimFlowStepper({
  claimDescription,
  onClose,
  onSubmit,
  selectedTrip,
  submitting,
  visible,
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setCurrentStep(1);
      setIsTransitioning(false);
      slideAnim.setValue(0);
      wasVisibleRef.current = false;
      return;
    }

    if (!wasVisibleRef.current) {
      setCurrentStep(selectedTrip ? 2 : 1);
      wasVisibleRef.current = true;
    }
  }, [selectedTrip, slideAnim, visible]);

  const continueDisabled = useMemo(() => {
    if (currentStep === 1) {
      return !selectedTrip || isTransitioning;
    }
    return !claimDescription?.trim() || submitting || isTransitioning;
  }, [claimDescription, currentStep, isTransitioning, selectedTrip, submitting]);

  const handleClose = useCallback(() => {
    setCurrentStep(1);
    setIsTransitioning(false);
    slideAnim.setValue(0);
    onClose?.();
  }, [onClose, slideAnim]);

  const transitionToStep = useCallback((nextStep, direction = 'forward') => {
    if (nextStep === currentStep || isTransitioning) return;

    const toValue = direction === 'forward' ? -SCREEN_WIDTH : SCREEN_WIDTH;

    setIsTransitioning(true);

    Animated.timing(slideAnim, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep(nextStep);
      slideAnim.setValue(-toValue);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIsTransitioning(false);
      });
    });
  }, [currentStep, isTransitioning, slideAnim]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      transitionToStep(currentStep - 1, 'backward');
      return;
    }
    handleClose();
  }, [currentStep, handleClose, transitionToStep]);

  const handleContinue = useCallback(() => {
    if (currentStep === 1) {
      if (!selectedTrip) return;
      transitionToStep(2, 'forward');
      return;
    }

    onSubmit?.();
  }, [currentStep, onSubmit, selectedTrip, transitionToStep]);

  return {
    continueDisabled,
    currentStep,
    handleBack,
    handleClose,
    handleContinue,
    isTransitioning,
    slideAnim,
    transitionToStep,
  };
}
