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
    date: '19 Aug 2026',
    title: 'Take back a wrong step',
    body: [
      'One mis-tap used to cost you the whole road. Undo now takes back your last step.',
      'Use the Undo button, tap the tile you came from, or press Backspace.',
      'It is a shield against a wrong tap, not a rewind. You get one take-back, and earn another with every step forward.',
      'A run that has ended stays ended. Undo cannot reopen a dead end or a finished road.',
      'Also: arrow keys and W, A, S, D have always moved you a tile. How to Play now says so.',
    ],
  },
  {
    date: '12 Aug 2026',
    title: 'GoldRoad v2: a fresh start',
    body: [
      'GoldRoad is starting over. Road numbering restarts, so today’s road is a new #1.',
      'There are no more accounts, sign-in, or notifications. Your history and streaks now live only in this browser, on this device.',
      'Old streaks and saved progress could not be carried across from the old server-side history, so they are gone.',
      'Added GoldRoad to your Home Screen before this? Remove it and add it again to refresh the icon. The app works either way.',
      "If you played the original GoldRoad, thank you for walking the old roads with me.",
    ],
  },
];
