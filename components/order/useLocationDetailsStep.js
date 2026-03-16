import { useCallback, useMemo } from 'react';
import { normalizeLocationType } from './locationDetails.constants';

const MIN_STAIRS = 1;
const MAX_STAIRS = 50;

export default function useLocationDetailsStep({ details, onUpdate, type }) {
  const isPickup = type === 'pickup';
  const helpKey = isPickup ? 'driverHelpsLoading' : 'driverHelpsUnloading';
  const locationType = normalizeLocationType(details.locationType);
  const isStore = locationType === 'store';
  const isApartment = locationType === 'apartment';
  const hasResidentialFields = isApartment;
  const unitNumberValue = details.unitNumber ?? '';
  const helpRequested = details[helpKey] === true;
  const selfHandled = details[helpKey] === false;

  const stairsValue = useMemo(() => {
    if (details.numberOfStairs === '') {
      return '';
    }
    return details.numberOfStairs || MIN_STAIRS;
  }, [details.numberOfStairs]);

  const updateDetails = useCallback((patch) => {
    onUpdate({ ...details, ...patch });
  }, [details, onUpdate]);

  const setLocationType = useCallback((nextType) => {
    updateDetails({
      locationType: nextType,
      buildingName: nextType === 'apartment' ? (details.buildingName || '') : '',
      hasElevator: nextType === 'apartment' ? (details.hasElevator ?? null) : null,
      unitNumber: nextType === 'apartment' ? unitNumberValue : '',
      floor: nextType === 'apartment' ? (details.floor ?? '') : '',
      numberOfStairs: nextType === 'apartment' ? (details.numberOfStairs || MIN_STAIRS) : MIN_STAIRS,
    });
  }, [details.buildingName, details.floor, details.hasElevator, details.numberOfStairs, unitNumberValue, updateDetails]);

  const handleUnitFloorChange = useCallback((text) => {
    const patch = { unitNumber: text };
    const floorMatch = text.match(/(?:floor|fl\.?|flr\.?)\s*(\d{1,3})/i);
    if (floorMatch) {
      patch.floor = floorMatch[1];
    }
    updateDetails(patch);
  }, [updateDetails]);

  const handleDecreaseStairs = useCallback(() => {
    const current = details.numberOfStairs || MIN_STAIRS;
    if (current > MIN_STAIRS) {
      updateDetails({ numberOfStairs: current - 1 });
    }
  }, [details.numberOfStairs, updateDetails]);

  const handleIncreaseStairs = useCallback(() => {
    const current = details.numberOfStairs || MIN_STAIRS;
    if (current < MAX_STAIRS) {
      updateDetails({ numberOfStairs: current + 1 });
    }
  }, [details.numberOfStairs, updateDetails]);

  const handleStairsTextChange = useCallback((text) => {
    const clean = text.replace(/[^0-9]/g, '');
    if (clean === '') {
      updateDetails({ numberOfStairs: '' });
      return;
    }

    const parsedValue = parseInt(clean, 10);
    if (parsedValue <= MAX_STAIRS) {
      updateDetails({ numberOfStairs: parsedValue });
    }
  }, [updateDetails]);

  const handleStairsBlur = useCallback(() => {
    const numericValue = parseInt(details.numberOfStairs, 10);
    if (!numericValue || numericValue < MIN_STAIRS) {
      updateDetails({ numberOfStairs: MIN_STAIRS });
    }
  }, [details.numberOfStairs, updateDetails]);

  return {
    isPickup,
    helpKey,
    locationType,
    isStore,
    isApartment,
    hasResidentialFields,
    unitNumberValue,
    helpRequested,
    selfHandled,
    stairsValue,
    canDecreaseStairs: (details.numberOfStairs || MIN_STAIRS) > MIN_STAIRS,
    canIncreaseStairs: (details.numberOfStairs || MIN_STAIRS) < MAX_STAIRS,
    updateDetails,
    setLocationType,
    handleUnitFloorChange,
    handleDecreaseStairs,
    handleIncreaseStairs,
    handleStairsTextChange,
    handleStairsBlur,
  };
}
