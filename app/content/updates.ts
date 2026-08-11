export type UpdateEntry = {
  date: string;
  title: string;
  body: string[];
};

/**
 * Newest first. Append future entries to the top of this list.
 *
 * The nav's quiet notification dot compares its own persisted
 * "last acknowledged" id against `UPDATES[0].date`, so a new entry here
 * automatically surfaces the dot for every player until they visit /about.
 */
export const UPDATES: UpdateEntry[] = [
  {
    date: 'Jul 2026',
    title: 'GoldRoad v2: a fresh start',
    body: [
      'GoldRoad is starting over. Road numbering has restarted from the beginning, so today’s road is a new #1, not a continuation of the old count.',
      'There are no more accounts, sign-in, or notifications. Your personal history and streaks now live only in your browser, on this device.',
      'This is a clean break from the old server-side history. Old streaks and saved progress could not be carried over into the new model, so they could not be preserved.',
      "If you played the original GoldRoad, thank you for walking the old roads with me. I hope you enjoy starting fresh on this one just as much.",
    ],
  },
];
