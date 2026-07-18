import { describe, expect, it } from 'vitest';
import {
  buildEmptyCommunityRoadStats,
  buildExactSolvedAttemptsDistribution,
  buildSolvedAttemptsDistribution,
  createEmptyStatsRoadDay,
  roundNullable,
  toCommunityRoadStats,
  type AggregatedRoadStatsRow,
} from '../server/utils/statsAggregation';

function makeRow(overrides: Partial<AggregatedRoadStatsRow> = {}): AggregatedRoadStatsRow {
  return {
    gameNo: 1,
    puzzleType: 'classic',
    plays: 0,
    exactSolves: 0,
    gold: 0,
    silver: 0,
    bronze: 0,
    hintUsers: 0,
    totalHints: 0,
    averageAttemptsBeforeFirstHint: null,
    averageFirstHintMoveIndex: null,
    averageDeadEndCount: null,
    averageWrongExitCount: null,
    averageSolveTimeMs: null,
    ...overrides,
  };
}

describe('createEmptyStatsRoadDay', () => {
  it('returns a road day with both modes null', () => {
    expect(createEmptyStatsRoadDay(42)).toEqual({
      gameNo: 42,
      classic: null,
      expedition: null,
    });
    expect(createEmptyStatsRoadDay(null).gameNo).toBeNull();
  });
});

describe('roundNullable', () => {
  it('passes through null unchanged', () => {
    expect(roundNullable(null)).toBeNull();
  });

  it('rounds to the requested number of digits', () => {
    expect(roundNullable(1.23456, 2)).toBe(1.23);
    expect(roundNullable(1.005, 0)).toBe(1);
  });

  it('treats NaN as null', () => {
    expect(roundNullable(Number.NaN)).toBeNull();
  });
});

describe('buildSolvedAttemptsDistribution', () => {
  it('keys buckets by attempt count and pools the tail into upperBound+', () => {
    const distribution = buildSolvedAttemptsDistribution([
      { gameNo: 1, puzzleType: 'classic', attempts: 1, count: 4 },
      { gameNo: 1, puzzleType: 'classic', attempts: 2, count: 2 },
      { gameNo: 1, puzzleType: 'classic', attempts: 24, count: 1 },
      { gameNo: 1, puzzleType: 'classic', attempts: 25, count: 1 },
      { gameNo: 1, puzzleType: 'classic', attempts: 40, count: 2 },
    ]);

    expect(distribution).toEqual({
      '1': 4,
      '2': 2,
      '24': 1,
      '25+': 3,
    });
  });

  it('ignores zero counts and nonsense attempt values', () => {
    const distribution = buildSolvedAttemptsDistribution([
      { gameNo: 1, puzzleType: 'classic', attempts: 0, count: 3 },
      { gameNo: 1, puzzleType: 'classic', attempts: 2, count: 0 },
      { gameNo: 1, puzzleType: 'classic', attempts: 3, count: 5 },
    ]);

    expect(distribution).toEqual({ '3': 5 });
  });
});

describe('buildExactSolvedAttemptsDistribution', () => {
  it('keeps every attempt count as its own exact key, with no pooled tail bucket', () => {
    const distribution = buildExactSolvedAttemptsDistribution([
      { gameNo: 1, puzzleType: 'classic', attempts: 1, count: 4 },
      { gameNo: 1, puzzleType: 'classic', attempts: 24, count: 1 },
      { gameNo: 1, puzzleType: 'classic', attempts: 25, count: 1 },
      { gameNo: 1, puzzleType: 'classic', attempts: 40, count: 2 },
    ]);

    expect(distribution).toEqual({
      '1': 4,
      '24': 1,
      '25': 1,
      '40': 2,
    });
  });

  it('ignores zero counts and nonsense attempt values, same as the pooled variant', () => {
    const distribution = buildExactSolvedAttemptsDistribution([
      { gameNo: 1, puzzleType: 'classic', attempts: 0, count: 3 },
      { gameNo: 1, puzzleType: 'classic', attempts: 2, count: 0 },
      { gameNo: 1, puzzleType: 'classic', attempts: 3, count: 5 },
    ]);

    expect(distribution).toEqual({ '3': 5 });
  });

  it('lets a percentile computed from it stay exact past the pooled histogram bucket', () => {
    // 30 solvers at attempts=30, 1 solver at attempts=50. The pooled
    // histogram collapses both into "25+", which can't tell them apart;
    // the exact distribution can.
    const rows = [
      { gameNo: 1, puzzleType: 'classic' as const, attempts: 30, count: 30 },
      { gameNo: 1, puzzleType: 'classic' as const, attempts: 50, count: 1 },
    ];
    const pooled = buildSolvedAttemptsDistribution(rows);
    const exact = buildExactSolvedAttemptsDistribution(rows);

    expect(pooled).toEqual({ '25+': 31 });
    expect(exact).toEqual({ '30': 30, '50': 1 });

    // A player who solved in 50 attempts is dead last against the exact
    // distribution (31/31 = 100th percentile), not indistinguishable from
    // the 30-attempt solvers as the pooled bucket would suggest.
    const atOrBetterForFifty = Object.entries(exact)
      .filter(([key]) => Number(key) <= 50)
      .reduce((sum, [, count]) => sum + count, 0);
    expect(atOrBetterForFifty).toBe(31);
  });
});

describe('buildEmptyCommunityRoadStats', () => {
  it('produces a fully-zeroed stats block for a road with zero plays', () => {
    const stats = buildEmptyCommunityRoadStats(7, 'expedition');
    expect(stats).toEqual({
      gameNo: 7,
      puzzleType: 'expedition',
      plays: 0,
      exactSolves: 0,
      solveRate: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
      solvedAttempts: {},
      solvedAttemptsExact: {},
      behavior: {
        hintUsers: 0,
        totalHints: 0,
        hintUseRate: 0,
        averageAttemptsBeforeFirstHint: null,
        averageFirstHintMoveIndex: null,
        averageDeadEndCount: null,
        averageWrongExitCount: null,
        averageSolveTimeMs: null,
      },
    });
  });
});

describe('toCommunityRoadStats', () => {
  it('computes solve rate and hint use rate for a single player', () => {
    const row = makeRow({
      plays: 1,
      exactSolves: 1,
      gold: 1,
      hintUsers: 0,
      totalHints: 0,
    });
    const stats = toCommunityRoadStats(row);
    expect(stats.solveRate).toBe(100);
    expect(stats.behavior.hintUseRate).toBe(0);
    expect(stats.gold).toBe(1);
  });

  it('defaults both solved-attempts fields to empty when not provided', () => {
    const stats = toCommunityRoadStats(makeRow());
    expect(stats.solvedAttempts).toEqual({});
    expect(stats.solvedAttemptsExact).toEqual({});
  });

  it('carries the pooled and exact solved-attempts distributions through independently', () => {
    const stats = toCommunityRoadStats(
      makeRow({ plays: 31, exactSolves: 31 }),
      { '25+': 31 },
      { '30': 30, '50': 1 },
    );
    expect(stats.solvedAttempts).toEqual({ '25+': 31 });
    expect(stats.solvedAttemptsExact).toEqual({ '30': 30, '50': 1 });
  });

  it('distinguishes hint users (distinct players) from total hints (sum of hints)', () => {
    // e.g. 4 plays, 1 player used 3 hints -> hintUsers=1, totalHints=3
    const row = makeRow({ plays: 4, hintUsers: 1, totalHints: 3 });
    const stats = toCommunityRoadStats(row);
    expect(stats.behavior.hintUsers).toBe(1);
    expect(stats.behavior.totalHints).toBe(3);
    expect(stats.behavior.hintUseRate).toBe(25); // 1/4 -> 25%
  });

  it('avoids division by zero when plays is 0 but a row is still passed in', () => {
    const row = makeRow({ plays: 0, exactSolves: 0, hintUsers: 0 });
    const stats = toCommunityRoadStats(row);
    expect(stats.solveRate).toBe(0);
    expect(stats.behavior.hintUseRate).toBe(0);
  });

  it('rounds average behavior metrics and keeps solve time unrounded to whole ms', () => {
    const row = makeRow({
      plays: 3,
      averageAttemptsBeforeFirstHint: 1.6666666,
      averageSolveTimeMs: 45123.789,
    });
    const stats = toCommunityRoadStats(row);
    expect(stats.behavior.averageAttemptsBeforeFirstHint).toBe(1.67);
    expect(stats.behavior.averageSolveTimeMs).toBe(45124);
  });

  it('derives medal boundaries consistently with attempts-based gold/silver/bronze counts', () => {
    // gold = attempts===1, silver = attempts===2, bronze = attempts===3,
    // attempts>=4 solved contributes to none of the medal buckets.
    const row = makeRow({
      plays: 4,
      exactSolves: 4,
      gold: 1,
      silver: 1,
      bronze: 1,
      // The 4th solved player (attempts=4) is intentionally not reflected in
      // gold/silver/bronze — medals only exist for attempts 1-3.
    });
    const stats = toCommunityRoadStats(row);
    expect(stats.gold + stats.silver + stats.bronze).toBe(3);
    expect(stats.exactSolves).toBe(4);
  });
});
