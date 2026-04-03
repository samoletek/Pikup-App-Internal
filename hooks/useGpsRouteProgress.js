import { useCallback, useMemo, useState } from 'react';
import { getDistanceFromLatLonInKm, getManeuverIcon } from '../screens/driver/navigationMath.utils';

const calculateDistanceToStepManeuverMeters = (currentLocation, step) => {
  const maneuverLocation = step?.maneuver?.location;
  if (!currentLocation || !Array.isArray(maneuverLocation) || maneuverLocation.length < 2) {
    return null;
  }

  return getDistanceFromLatLonInKm(
    currentLocation.latitude,
    currentLocation.longitude,
    maneuverLocation[1],
    maneuverLocation[0]
  ) * 1000;
};

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
    setDistanceToTurn(
      Number.isFinite(Number(firstStep?.distance)) ? Number(firstStep.distance) : null
    );
  }, []);

  const updateNavigationProgress = useCallback((currentLocation) => {
    if (!routeSteps.length || currentStepIndex >= routeSteps.length) {
      return;
    }

    const currentStep = routeSteps[currentStepIndex];
    const distanceToManeuver = calculateDistanceToStepManeuverMeters(currentLocation, currentStep);
    if (!Number.isFinite(distanceToManeuver)) {
      return;
    }

    setDistanceToTurn(Number.isFinite(distanceToManeuver) ? distanceToManeuver : null);

    const hasNextStep = currentStepIndex < routeSteps.length - 1;
    const nextStep = hasNextStep ? routeSteps[currentStepIndex + 1] : null;
    const distanceToNextManeuver = hasNextStep
      ? calculateDistanceToStepManeuverMeters(currentLocation, nextStep)
      : null;
    const shouldAdvanceToNextStep =
      hasNextStep && (
        distanceToManeuver < 40 ||
        (
          Number.isFinite(distanceToNextManeuver) &&
          distanceToNextManeuver + 10 < distanceToManeuver
        )
      );

    if (shouldAdvanceToNextStep) {
      const nextStep = routeSteps[currentStepIndex + 1];
      setCurrentStepIndex(currentStepIndex + 1);
      setNextInstruction(nextStep?.maneuver?.instruction || 'Continue');
      setDistanceToTurn(
        Number.isFinite(Number(nextStep?.distance)) ? Number(nextStep.distance) : null
      );
    }
  }, [currentStepIndex, routeSteps]);

  const currentStreetName = useMemo(() => {
    const step = routeSteps[currentStepIndex];
    if (!step) {
      return null;
    }

    const directName = typeof step.name === 'string' ? step.name.trim() : '';
    if (directName) {
      return directName;
    }

    const destinationName = typeof step.destinations === 'string' ? step.destinations.trim() : '';
    if (destinationName) {
      return destinationName;
    }

    return null;
  }, [currentStepIndex, routeSteps]);

  const currentManeuverIcon = useMemo(() => {
    const maneuver = routeSteps[currentStepIndex]?.maneuver || {};
    return getManeuverIcon(maneuver.type || 'continue', maneuver.modifier || '');
  }, [currentStepIndex, routeSteps]);

  return {
    routeSteps,
    currentStepIndex,
    nextInstruction,
    distanceToTurn,
    currentStreetName,
    currentManeuverIcon,
    applyRouteSteps,
    updateNavigationProgress,
  };
}
