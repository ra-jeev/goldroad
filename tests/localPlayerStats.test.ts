import { describe, expect, it } from 'vitest';
import { buildStreakSummary } from '../app/composables/useLocalPlayerStats';

describe('buildStreakSummary', () => {
  const today = '2026-07-14';

  it('keeps yesterday\'s streak alive before the player solves today', () => {
    expect(
      buildStreakSummary(['2026-07-11', '2026-07-12', '2026-07-13'], today),
    ).toEqual({ currentStreak: 3, bestStreak: 3 });
  });

  it('includes today after the player solves today', () => {
    expect(
      buildStreakSummary(
        ['2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14'],
        today,
      ),
    ).toEqual({ currentStreak: 4, bestStreak: 4 });
  });

  it('returns zero when neither today nor yesterday was solved', () => {
    expect(
      buildStreakSummary(['2026-07-10', '2026-07-11'], today),
    ).toEqual({ currentStreak: 0, bestStreak: 2 });
  });
});
