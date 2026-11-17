/** The road day is the UTC calendar date, the same rollover as the website. */
export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** "Tue 24 Nov" for a "2026-11-24" day key. */
export function shortDayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The day before a "YYYY-MM-DD" day key. */
export function previousDay(day: string): string {
  return utcDay(new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS));
}

/** End of a road's own day (the next 00:00 UTC), in ms. */
export function dayEndMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) + DAY_MS;
}
