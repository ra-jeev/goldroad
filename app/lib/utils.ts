export const areDatesEqual = (
  date1: Date | string | number,
  date2: Date | string | number,
  checkUTC = false
): boolean => {
  const d1 = date1 instanceof Date ? date1 : new Date(date1);
  const d2 = date2 instanceof Date ? date2 : new Date(date2);

  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
    throw new Error('Invalid date provided');
  }

  return checkUTC
    ? d1.getUTCFullYear() === d2.getUTCFullYear() &&
        d1.getUTCMonth() === d2.getUTCMonth() &&
        d1.getUTCDate() === d2.getUTCDate()
    : d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
};

export const getOrdinalSuffix = (n: number): string => {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return suffix[(v - 20) % 10] || suffix[v] || suffix[0];
};

export const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const knownPlurals = {
  try: 'tries',
  road: 'roads',
  day: 'days',
} as const;

type KnownWord = keyof typeof knownPlurals;

export function formatQuantity(
  count: number,
  singular: string,
  fractionalDigits?: number,
  customPlural?: string
): string {
  if (count === 1) {
    return `${count} ${singular}`;
  }

  const value = fractionalDigits ? count.toFixed(fractionalDigits) : count;
  if (singular in knownPlurals) {
    return `${value} ${knownPlurals[singular as KnownWord]}`;
  }

  if (customPlural) {
    return `${value} ${customPlural}`;
  }

  return `${value} ${singular}s`;
}

const triesEmojis = {
  '1': '🥇',
  '2': '🥈',
  '3': '🥉',
  '4+': '😅',
  '10+': '😥',
  '20+': '😓',
} as const;

type KnownTriesCount = keyof typeof triesEmojis;

export const getEmojiForTries = (tries: number) => {
  const triesStr = String(tries);

  if (triesStr in triesEmojis) {
    return triesEmojis[triesStr as KnownTriesCount];
  } else if (tries < 10) {
    return triesEmojis['4+'];
  } else if (tries < 20) {
    return triesEmojis['10+'];
  }

  return triesEmojis['20+'];
};
