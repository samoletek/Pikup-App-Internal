import { useCallback, useMemo, useRef, useState } from 'react';
import {
  getDistanceFromLatLonInKm,
  getManeuverIcon,
  normalizeManeuverType,
} from '../screens/driver/navigationMath.utils';

const PRIMARY_MANEUVER_TYPES = new Set([
  'turn',
  'fork',
  'merge',
  'on-ramp',
  'off-ramp',
  'roundabout',
  'rotary',
  'roundabout-turn',
  'arrive',
  'uturn',
]);

const MANEUVER_ARRIVAL_THRESHOLD_METERS = 12;
const MANEUVER_PASS_CONFIRMATION_METERS = 24;
const MANEUVER_DISTANCE_INCREASE_THRESHOLD_METERS = 6;

const normalizeText = (value) => {
  const normalizedValue = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return normalizedValue || null;
};

const getInstructionCollection = (step, camelCaseKey, snakeCaseKey) => {
  if (Array.isArray(step?.[camelCaseKey])) {
    return step[camelCaseKey];
  }

  if (Array.isArray(step?.[snakeCaseKey])) {
    return step[snakeCaseKey];
  }

  return [];
};

const getBannerInstructions = (step) => {
  return getInstructionCollection(step, 'bannerInstructions', 'banner_instructions');
};

const getBannerPrimaryInstruction = (step, remainingDistanceMeters = Number.POSITIVE_INFINITY) => {
  const banners = getBannerInstructions(step)
    .filter((banner) => banner?.primary)
    .map((banner) => ({
      ...banner,
      distanceAlongGeometry: Number(banner?.distanceAlongGeometry),
    }))
    .filter((banner) => Number.isFinite(banner.distanceAlongGeometry))
    .sort((left, right) => left.distanceAlongGeometry - right.distanceAlongGeometry);

  if (!banners.length) {
    return null;
  }

  const matchedBanner = banners.find(
    (banner) => remainingDistanceMeters <= banner.distanceAlongGeometry
  );

  return (matchedBanner || banners[banners.length - 1])?.primary || null;
};

const getInstructionCarrierStep = (steps = [], instructionStepIndex = 0) => {
  if (!Array.isArray(steps) || steps.length === 0) {
    return null;
  }

  if (instructionStepIndex <= 0) {
    return steps[0] || null;
  }

  return steps[instructionStepIndex - 1] || steps[instructionStepIndex] || null;
};

const getInstructionDescriptor = ({
  steps = [],
  instructionStepIndex = 0,
  remainingDistanceMeters = Number.POSITIVE_INFINITY,
}) => {
  const instructionStep = steps[instructionStepIndex] || null;
  const carrierStep = getInstructionCarrierStep(steps, instructionStepIndex);
  const bannerPrimary = getBannerPrimaryInstruction(carrierStep, remainingDistanceMeters);

  const instructionText =
    normalizeText(bannerPrimary?.text) ||
    normalizeText(instructionStep?.maneuver?.instruction) ||
    'Continue';
  const maneuverType =
    normalizeManeuverType(bannerPrimary?.type) ||
    normalizeManeuverType(instructionStep?.maneuver?.type) ||
    'continue';
  const maneuverModifier =
    normalizeText(bannerPrimary?.modifier) ||
    normalizeText(instructionStep?.maneuver?.modifier) ||
    '';
  const streetName =
    normalizeText(instructionStep?.name) ||
    normalizeText(instructionStep?.destinations) ||
    null;

  return {
    instructionText,
    maneuverType,
    maneuverModifier,
    streetName,
  };
};

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

const isPrimaryManeuverStep = (step) => {
  const maneuverType = normalizeManeuverType(step?.maneuver?.type);
  const maneuverModifier = String(step?.maneuver?.modifier || '').trim().toLowerCase();

  if (PRIMARY_MANEUVER_TYPES.has(maneuverType)) {
    return true;
  }

  return (
    maneuverModifier.includes('left') ||
    maneuverModifier.includes('right') ||
    maneuverModifier.includes('uturn') ||
    maneuverModifier.includes('u-turn')
  );
};

const findUpcomingInstructionStepIndex = (steps = [], startIndex = 0) => {
  if (!Array.isArray(steps) || steps.length === 0) {
    return 0;
  }

  const normalizedStartIndex = Math.max(0, Math.min(startIndex, steps.length - 1));
  for (let index = normalizedStartIndex; index < steps.length; index += 1) {
    if (isPrimaryManeuverStep(steps[index])) {
      return index;
    }
  }

  return normalizedStartIndex;
};

const getStepDistanceFallbackMeters = (step) => {
  const rawDistance = Number(step?.distance);
  return Number.isFinite(rawDistance) ? rawDistance : null;
};

export default function useGpsRouteProgress() {
  const routeStepsRef = useRef([]);
  const currentStepIndexRef = useRef(0);
  const trackedTraversalStepIndexRef = useRef(0);
  const lastDistanceToManeuverRef = useRef(null);
  const closestDistanceToManeuverRef = useRef(Number.POSITIVE_INFINITY);
  const [routeSteps, setRouteSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [nextInstruction, setNextInstruction] = useState(null);
  const [distanceToTurn, setDistanceToTurn] = useState(null);

  const applyRouteSteps = useCallback((steps = []) => {
    if (!Array.isArray(steps) || steps.length === 0) {
      routeStepsRef.current = [];
      currentStepIndexRef.current = 0;
      trackedTraversalStepIndexRef.current = 0;
      lastDistanceToManeuverRef.current = null;
      closestDistanceToManeuverRef.current = Number.POSITIVE_INFINITY;
      setRouteSteps([]);
      setCurrentStepIndex(0);
      setNextInstruction(null);
      setDistanceToTurn(null);
      return;
    }

    routeStepsRef.current = steps;
    currentStepIndexRef.current = 0;
    trackedTraversalStepIndexRef.current = 0;
    lastDistanceToManeuverRef.current = null;
    closestDistanceToManeuverRef.current = Number.POSITIVE_INFINITY;
    setRouteSteps(steps);
    setCurrentStepIndex(0);

    const displayStepIndex = findUpcomingInstructionStepIndex(steps, 0);
    const firstStep = steps[displayStepIndex] || steps[0];
    const firstDistanceMeters = getStepDistanceFallbackMeters(firstStep);
    const firstInstruction = getInstructionDescriptor({
      steps,
      instructionStepIndex: displayStepIndex,
      remainingDistanceMeters: firstDistanceMeters ?? Number.POSITIVE_INFINITY,
    });
    setNextInstruction(firstInstruction.instructionText);
    setDistanceToTurn(
      firstDistanceMeters
    );
  }, []);

  const updateNavigationProgress = useCallback((currentLocation) => {
    const currentRouteSteps = routeStepsRef.current;
    const activeStepIndex = currentStepIndexRef.current;

    if (!currentRouteSteps.length || activeStepIndex >= currentRouteSteps.length) {
      return;
    }

    const currentStep = currentRouteSteps[activeStepIndex];
    const distanceToManeuver = calculateDistanceToStepManeuverMeters(currentLocation, currentStep);
    if (!Number.isFinite(distanceToManeuver)) {
      return;
    }

    if (trackedTraversalStepIndexRef.current !== activeStepIndex) {
      trackedTraversalStepIndexRef.current = activeStepIndex;
      lastDistanceToManeuverRef.current = null;
      closestDistanceToManeuverRef.current = Number.POSITIVE_INFINITY;
    }

    const lastDistanceToManeuver = Number(lastDistanceToManeuverRef.current);
    const closestDistanceToManeuver = Math.min(
      Number.isFinite(Number(closestDistanceToManeuverRef.current))
        ? Number(closestDistanceToManeuverRef.current)
        : Number.POSITIVE_INFINITY,
      distanceToManeuver
    );
    const hasNextStep = activeStepIndex < currentRouteSteps.length - 1;
    const shouldAdvanceToNextStep =
      hasNextStep && (
        distanceToManeuver <= MANEUVER_ARRIVAL_THRESHOLD_METERS ||
        (
          Number.isFinite(lastDistanceToManeuver) &&
          closestDistanceToManeuver <= MANEUVER_PASS_CONFIRMATION_METERS &&
          distanceToManeuver >= (
            lastDistanceToManeuver + MANEUVER_DISTANCE_INCREASE_THRESHOLD_METERS
          )
        )
      );

    const traversalStepIndex = shouldAdvanceToNextStep
      ? activeStepIndex + 1
      : activeStepIndex;

    if (shouldAdvanceToNextStep) {
      currentStepIndexRef.current = traversalStepIndex;
      trackedTraversalStepIndexRef.current = traversalStepIndex;
      lastDistanceToManeuverRef.current = null;
      closestDistanceToManeuverRef.current = Number.POSITIVE_INFINITY;
      setCurrentStepIndex(traversalStepIndex);
    } else {
      trackedTraversalStepIndexRef.current = activeStepIndex;
      lastDistanceToManeuverRef.current = distanceToManeuver;
      closestDistanceToManeuverRef.current = closestDistanceToManeuver;
    }

    const instructionStepIndex = findUpcomingInstructionStepIndex(
      currentRouteSteps,
      traversalStepIndex
    );
    const instructionStep = currentRouteSteps[instructionStepIndex];
    const distanceToInstruction = calculateDistanceToStepManeuverMeters(
      currentLocation,
      instructionStep
    );
    const instructionDescriptor = getInstructionDescriptor({
      steps: currentRouteSteps,
      instructionStepIndex,
      remainingDistanceMeters: distanceToInstruction,
    });

    setNextInstruction(instructionDescriptor.instructionText);
    setDistanceToTurn(
      Number.isFinite(distanceToInstruction)
        ? distanceToInstruction
        : getStepDistanceFallbackMeters(instructionStep)
    );
  }, []);

  const displayStepIndex = useMemo(
    () => findUpcomingInstructionStepIndex(routeSteps, currentStepIndex),
    [currentStepIndex, routeSteps]
  );

  const currentStreetName = useMemo(() => {
    return getInstructionDescriptor({
      steps: routeSteps,
      instructionStepIndex: displayStepIndex,
      remainingDistanceMeters: distanceToTurn,
    }).streetName;
  }, [displayStepIndex, distanceToTurn, routeSteps]);

  const currentManeuverIcon = useMemo(() => {
    const descriptor = getInstructionDescriptor({
      steps: routeSteps,
      instructionStepIndex: displayStepIndex,
      remainingDistanceMeters: distanceToTurn,
    });
    return getManeuverIcon(descriptor.maneuverType, descriptor.maneuverModifier);
  }, [displayStepIndex, distanceToTurn, routeSteps]);

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
