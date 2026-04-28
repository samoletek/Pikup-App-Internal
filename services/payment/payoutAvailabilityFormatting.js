import { ATLANTA_TIME_ZONE } from '../timezone';

const createFormatter = (options) => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: ATLANTA_TIME_ZONE,
      ...options,
    });
  } catch (_error) {
    return null;
  }
};

const PAYOUT_DATE_FORMATTER = createFormatter({
  month: 'short',
  day: 'numeric',
});

const PAYOUT_DATE_TIME_FORMATTER = createFormatter({
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

const toValidDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatPayoutDate = (value) => {
  const date = toValidDate(value);
  if (!date) {
    return null;
  }

  return (
    PAYOUT_DATE_FORMATTER?.format(date) ||
    date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  );
};

export const formatPayoutDateTime = (value) => {
  const date = toValidDate(value);
  if (!date) {
    return null;
  }

  return (
    PAYOUT_DATE_TIME_FORMATTER?.format(date) ||
    date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  );
};
