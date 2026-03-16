export const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  return fallback;
};

export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return {};
};

export const toArray = (value) => {
  return Array.isArray(value) ? value : [];
};
