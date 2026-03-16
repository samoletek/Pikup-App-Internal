import { useCallback, useMemo, useState } from 'react';
import { formatDistance, getDistanceFromLatLonInKm, getManeuverIcon } from '../screens/driver/navigationMath.utils';

export default function useGpsRouteProgress() {
  const [routeSteps, setRouteSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [nextInstruction, setNextInstruction] = useState(null);
  const [distanceToTurn, setDistanceToTurn] = useState(null);

  const applyRouteSteps = useCallback((steps = []) => {
    if (!Array.isArray(steps) || steps.length === 0) {
      setRouteSteps([]);
      setCurrentStepIndex(0);
      setNextInstruction(null);
      setDistanceToTurn(null);
      return;
    }

    setRouteSteps(steps);
    setCurrentStepIndex(0);

    const firstStep = steps[0];
    setNextInstruction(firstStep?.maneuver?.instruction || 'Continue straight');
    setDistanceToTurn(firstStep?.distance ? formatDistance(firstStep.distance) : null);
  }, []);

  const updateNavigationProgress = useCallback((currentLocation) => {
    if (!routeSteps.length || currentStepIndex >= routeSteps.length) {
      return;
    }

    const currentStep = routeSteps[currentStepIndex];
    if (!currentStep?.maneuver?.location) {
      return;
    }

    const maneuverLocation = {
      latitude: currentStep.maneuver.location[1],
      longitude: currentStep.maneuver.location[0],
    };

    const distanceToManeuver = getDistanceFromLatLonInKm(
      currentLocation.latitude,
      currentLocation.longitude,
      maneuverLocation.latitude,
      maneuverLocation.longitude
    ) * 1000;

    setDistanceToTurn(formatDistance(distanceToManeuver));

    if (distanceToManeuver < 50 && currentStepIndex < routeSteps.length - 1) {
      const nextStep = routeSteps[currentStepIndex + 1];
      setCurrentStepIndex(currentStepIndex + 1);
      setNextInstruction(nextStep?.maneuver?.instruction || 'Continue');
      if (nextStep?.distance) {
        setDistanceToTurn(formatDistance(nextStep.distance));
      }
    }
  }, [currentStepIndex, routeSteps]);

  const currentManeuverIcon = useMemo(() => {
    const maneuverType = routeSteps[currentStepIndex]?.maneuver?.type || 'continue';
    return getManeuverIcon(maneuverType);
  }, [currentStepIndex, routeSteps]);

  return {
    routeSteps,
    currentStepIndex,
    nextInstruction,
    distanceToTurn,
    currentManeuverIcon,
    applyRouteSteps,
    updateNavigationProgress,
  };
}
