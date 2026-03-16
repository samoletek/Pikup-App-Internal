const trimValue = (value) => (typeof value === 'string' ? value.trim() : '');

export const parseFloorNumber = (value) => {
    const normalized = String(value ?? '').replace(/[^0-9]/g, '');
    if (!normalized) return null;

    const parsed = parseInt(normalized, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export const extractApartmentFloor = (locationDetails) => {
    const explicitFloor = parseFloorNumber(locationDetails?.floor);
    if (explicitFloor !== null) return explicitFloor;

    const unitText = trimValue(locationDetails?.unitNumber);
    const floorMatch = unitText.match(/(?:floor|fl\.?|flr\.?|lvl|level)\s*#?\s*(\d{1,3})/i);
    if (!floorMatch?.[1]) return null;

    return parseInt(floorMatch[1], 10);
};

export const getItemValidationErrors = (item) => {
    const itemErr = {};
    const normalizedCondition = String(item.condition || '').trim().toLowerCase();
    const hasValidCondition = normalizedCondition === 'new' || normalizedCondition === 'used';
    const insuranceEnabledForNew = normalizedCondition === 'new' && item.hasInsurance === true;

    if (!item.name?.trim()) itemErr.name = true;
    if (!Array.isArray(item.photos) || item.photos.length === 0) itemErr.photos = true;
    if (!hasValidCondition) itemErr.condition = true;
    if (normalizedCondition === 'new' && !String(item.value || '').trim()) itemErr.value = true;
    if (insuranceEnabledForNew && !item.invoicePhoto) itemErr.invoice = true;

    return itemErr;
};

export const validateLocationDetails = (locationDetails, label) => {
    const rawLocationType = locationDetails.locationType || 'store';
    const locationType = rawLocationType === 'house_other' ? 'residential_other' : rawLocationType;

    if (locationType === 'store') {
        if (!trimValue(locationDetails.storeName)) {
            return `Please enter the store or business name for ${label}.`;
        }
        return null;
    }

    if (locationType === 'apartment') {
        if (!trimValue(locationDetails.buildingName)) {
            return `Please enter the building name/number for ${label}.`;
        }

        if (!trimValue(locationDetails.unitNumber)) {
            return `Please enter the unit/apartment number for ${label}.`;
        }

        if (trimValue(locationDetails.floor) && parseFloorNumber(locationDetails.floor) === null) {
            return `Please enter a valid floor number for ${label}.`;
        }

        const detectedFloor = extractApartmentFloor(locationDetails);
        if (
            detectedFloor &&
            detectedFloor > 1 &&
            locationDetails.hasElevator !== true &&
            locationDetails.hasElevator !== false
        ) {
            return `Please specify if there is a working elevator for ${label}.`;
        }

        return null;
    }

    if (locationType === 'residential_other') {
        return null;
    }

    return null;
};
