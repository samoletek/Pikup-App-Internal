export const ATLANTA_TIME_ZONE = 'America/New_York';

const ATLANTA_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: ATLANTA_TIME_ZONE,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const ATLANTA_OFFSET_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: ATLANTA_TIME_ZONE,
  timeZoneName: 'longOffset',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const WEEKDAY_SUN_INDEX = Object.freeze({
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
});

const parseInteger = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDateKey = (year, month, day) => [
  String(year).padStart(4, '0'),
  String(month).padStart(2, '0'),
  String(day).padStart(2, '0'),
].join('-');

const parseDateKey = (dateKey) => {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  return {
    year: parseInteger(match[1]),
    month: parseInteger(match[2]),
    day: parseInteger(match[3]),
  };
};

const parseOffsetMinutes = (timeZoneName) => {
  const value = String(timeZoneName || '').trim();
  const match = value.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) {
    return 0;
  }

  const sign = match[1] === '-' ? -1 : 1;
  const hours = parseInteger(match[2]);
  const minutes = parseInteger(match[3], 0);
  return sign * ((hours * 60) + minutes);
};

const shiftUtcDatePartsByDays = ({ year, month, day }, deltaDays) => {
  const shiftedDate = new Date(Date.UTC(year, month - 1, day + deltaDays, 0, 0, 0, 0));
  return {
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth() + 1,
    day: shiftedDate.getUTCDate(),
  };
};

const resolveAtlantaOffsetMinutes = (dateValue) => {
  const formattedParts = ATLANTA_OFFSET_FORMATTER.formatToParts(dateValue);
  const timeZoneName = formattedParts.find((part) => part.type === 'timeZoneName')?.value;
  return parseOffsetMinutes(timeZoneName);
};

const resolveAtlantaLocalMidnightIso = ({ year, month, day }) => {
  const localMidnightUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  let resolvedUtcMs = localMidnightUtcMs;

  // Iterate to account for DST offset changes around midnight boundaries.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offsetMinutes = resolveAtlantaOffsetMinutes(new Date(resolvedUtcMs));
    const nextUtcMs = localMidnightUtcMs - (offsetMinutes * 60 * 1000);
    if (nextUtcMs === resolvedUtcMs) {
      break;
    }
    resolvedUtcMs = nextUtcMs;
  }

  return new Date(resolvedUtcMs).toISOString();
};

export const getAtlantaDateParts = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const formattedParts = ATLANTA_DATE_PARTS_FORMATTER.formatToParts(date);
  return {
    weekday: formattedParts.find((part) => part.type === 'weekday')?.value || '',
    year: parseInteger(formattedParts.find((part) => part.type === 'year')?.value),
    month: parseInteger(formattedParts.find((part) => part.type === 'month')?.value),
    day: parseInteger(formattedParts.find((part) => part.type === 'day')?.value),
  };
};

export const resolveAtlantaWeekdayIndex = (value = new Date()) => {
  const parts = getAtlantaDateParts(value);
  if (!parts) {
    return null;
  }

  const sunBasedIndex = WEEKDAY_SUN_INDEX[parts.weekday];
  if (!Number.isInteger(sunBasedIndex)) {
    return null;
  }

  return sunBasedIndex === 0 ? 6 : sunBasedIndex - 1;
};

export const resolveAtlantaWeekStartKey = (value = new Date()) => {
  const parts = getAtlantaDateParts(value);
  if (!parts) {
    return null;
  }

  const sunBasedIndex = WEEKDAY_SUN_INDEX[parts.weekday];
  if (!Number.isInteger(sunBasedIndex)) {
    return null;
  }

  const mondayOffsetDays = sunBasedIndex === 0 ? -6 : 1 - sunBasedIndex;
  const mondayDateParts = shiftUtcDatePartsByDays(parts, mondayOffsetDays);
  return toDateKey(mondayDateParts.year, mondayDateParts.month, mondayDateParts.day);
};

export const resolveAtlantaMonthStartKey = (value = new Date()) => {
  const parts = getAtlantaDateParts(value);
  if (!parts) {
    return null;
  }

  return toDateKey(parts.year, parts.month, 1);
};

export const resolveAtlantaWeekStartIso = (value = new Date()) => {
  const weekStartKey = resolveAtlantaWeekStartKey(value);
  const parsed = parseDateKey(weekStartKey);
  if (!parsed) {
    return new Date(value).toISOString();
  }

  return resolveAtlantaLocalMidnightIso(parsed);
};

export const resolveAtlantaMonthStartIso = (value = new Date()) => {
  const monthStartKey = resolveAtlantaMonthStartKey(value);
  const parsed = parseDateKey(monthStartKey);
  if (!parsed) {
    return new Date(value).toISOString();
  }

  return resolveAtlantaLocalMidnightIso(parsed);
};

export const isSameAtlantaWeek = (leftValue, rightValue) => {
  const leftWeekKey = resolveAtlantaWeekStartKey(leftValue);
  const rightWeekKey = resolveAtlantaWeekStartKey(rightValue);

  if (!leftWeekKey || !rightWeekKey) {
    return false;
  }

  return leftWeekKey === rightWeekKey;
};
