import { describe, expect, it } from 'vitest';
import { buildStreakSummary } from '../app/composables/useLocalPlayerStats';

describe('buildStreakSummary', () => {
  const today = '2026-07-14';
  const entry = (gameNo: number, day: string) => ({ gameNo, day });

  it('keeps yesterday\'s streak alive before the player solves today', () => {
    expect(
      buildStreakSummary(
        [entry(11, '2026-07-11'), entry(12, '2026-07-12'), entry(13, '2026-07-13')],
        today,
        14,
      ),
    ).toEqual({ currentStreak: 3, bestStreak: 3 });
  });

  it('includes today after the player solves today', () => {
    expect(
      buildStreakSummary(
        [
          entry(11, '2026-07-11'),
          entry(12, '2026-07-12'),
          entry(13, '2026-07-13'),
          entry(14, '2026-07-14'),
        ],
        today,
        14,
      ),
    ).toEqual({ currentStreak: 4, bestStreak: 4 });
  });

  it('returns zero when neither today nor yesterday was solved', () => {
    expect(
      buildStreakSummary(
        [entry(10, '2026-07-10'), entry(11, '2026-07-11')],
        today,
        14,
      ),
    ).toEqual({ currentStreak: 0, bestStreak: 2 });
  });

  it('counts consecutive roads across an extended launch road', () => {
    expect(
      buildStreakSummary(
        [
          entry(1, '2026-08-12'),
          entry(2, '2026-08-14'),
          entry(3, '2026-08-15'),
        ],
        '2026-08-15',
        3,
      ),
    ).toEqual({ currentStreak: 3, bestStreak: 3 });
  });

  it('breaks a streak when a road number is skipped', () => {
    expect(
      buildStreakSummary(
        [entry(1, '2026-08-12'), entry(3, '2026-08-15')],
        '2026-08-15',
        3,
      ),
    ).toEqual({ currentStreak: 1, bestStreak: 1 });
  });

  it('expires a streak against the authoritative current road number', () => {
    expect(
      buildStreakSummary(
        [entry(4, '2026-08-12'), entry(5, '2026-08-13')],
        '2026-08-16',
        8,
      ),
    ).toEqual({ currentStreak: 0, bestStreak: 2 });
  });
});
