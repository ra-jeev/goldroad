import { describe, expect, it } from 'vitest';
import {
  buildEmptyCommunityRoadStats,
  buildExactSolvedAttemptsDistribution,
  buildSolvedAttemptsDistribution,
  toCommunityRoadStats,
  type AggregatedRoadStatsRow,
  type SolvedAttemptsRow,
} from '../server/utils/statsAggregation';
import {
  hasCommunitySample,
  hasPercentileSample,
  formatFieldBehaviorRows,
  toPercent,
  topPercent,
} from '../app/utils/statsPresentation';

function makeAggregatedRow(
  overrides: Partial<AggregatedRoadStatsRow> = {},
): AggregatedRoadStatsRow {
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
    averageSolveTimeMs: null,
    bestSolveTimeMs: null,
    ...overrides,
  };
}

describe('toPercent', () => {
  it('clamps and rounds', () => {
    expect(toPercent(0, 0)).toBe(0);
    expect(toPercent(1, 3)).toBe(33);
    expect(toPercent(3, 3)).toBe(100);
  });
});

describe('pooled 25+ bucket vs exact percentile (RP0-4 / RP1-9)', () => {
  // 30 solvers total: attempts 1..29 solved once each, plus one solver at 40.
  const rows: SolvedAttemptsRow[] = [
    ...Array.from({ length: 29 }, (_, i) => ({
      gameNo: 1,
      puzzleType: 'classic' as const,
      attempts: i + 1,
      count: 1,
    })),
    { gameNo: 1, puzzleType: 'classic', attempts: 40, count: 1 },
  ];
  const totalSolvers = rows.reduce((sum, r) => sum + r.count, 0);

  const pooled = buildSolvedAttemptsDistribution(rows, 25);
  const exact = buildExactSolvedAttemptsDistribution(rows);

  it('the pooled histogram collapses everyone at/after 25 into one 25+ bucket', () => {
    // attempts 25..29 (5 solvers) + the 40-attempt solver = 6 in "25+"
    expect(pooled['25+']).toBe(6);
    expect(pooled['24']).toBe(1);
    expect(pooled['40']).toBeUndefined();
  });

  it('the exact distribution keeps every attempt count distinct, including past the pooled bucket', () => {
    expect(exact['25']).toBe(1);
    expect(exact['29']).toBe(1);
    expect(exact['40']).toBe(1);
    expect(exact['25+']).toBeUndefined();
  });

  function communityStatsFor(exactSolves: number) {
    return toCommunityRoadStats(
      makeAggregatedRow({ plays: totalSolvers, exactSolves }),
      pooled,
      exact,
    );
  }

  it('a player inside the pooled bucket (attempts 25) still gets the correct exact percentile', () => {
    const stat = communityStatsFor(totalSolvers);
    // At-or-better than 25 attempts: everyone from 1..25 = 25 solvers of 30.
    expect(topPercent(stat, 25)).toBe(toPercent(25, totalSolvers));
  });

  it('a player past the pooled bucket (attempts 40) gets an exact percentile, not "25+"-pooled 100%', () => {
    const stat = communityStatsFor(totalSolvers);
    // Everyone (all 30) did at least as well as the 40-attempt solver.
    expect(topPercent(stat, 40)).toBe(100);
  });

  it('a player at the very edge of the pooled bucket (attempts 30, between 29 and 40) is still exact', () => {
    const stat = communityStatsFor(totalSolvers);
    // At-or-better than 30 attempts: everyone from 1..29 = 29 of 30.
    expect(topPercent(stat, 30)).toBe(toPercent(29, totalSolvers));
  });

  it('matches a same-shaped manual computation off the exact map directly (proves independence from the pooled map)', () => {
    const stat = communityStatsFor(totalSolvers);
    const manualAtOrBetter = Object.entries(exact).reduce(
      (sum, [key, count]) =>
        Number.parseInt(key, 10) <= 29 ? sum + count : sum,
      0,
    );
    expect(topPercent(stat, 29)).toBe(toPercent(manualAtOrBetter, totalSolvers));
  });
});

describe('sparse-sample gates', () => {
  it('shows the histogram/headline as soon as one play exists', () => {
    const empty = buildEmptyCommunityRoadStats(1, 'classic');
    empty.plays = 0;
    expect(hasCommunitySample(empty)).toBe(false);

    const firstPlay = buildEmptyCommunityRoadStats(1, 'classic');
    firstPlay.plays = 1;
    expect(hasCommunitySample(firstPlay)).toBe(true);
  });

  it('shows the top-N% line from the first recorded solve', () => {
    const noSolves = buildEmptyCommunityRoadStats(1, 'classic');
    noSolves.plays = 1;
    expect(hasPercentileSample(noSolves)).toBe(false);

    const firstSolve = buildEmptyCommunityRoadStats(1, 'classic');
    firstSolve.plays = 1;
    firstSolve.exactSolves = 1;
    expect(hasPercentileSample(firstSolve)).toBe(true);
  });
});

describe('field behavior copy', () => {
  it('uses the exact zero-hint sentence and field-only time without a local time', () => {
    const stats = buildEmptyCommunityRoadStats(1, 'classic');
    stats.behavior.averageSolveTimeMs = 90_000;
    expect(
      formatFieldBehaviorRows(stats, null, (value) =>
        value === 90_000 ? '1m 30s' : 'unexpected',
      ),
    ).toEqual([
      'No hints were used on this road.',
      'Field solve time averaged 1m 30s.',
    ]);
  });

  it('reports total hints and compares field and player solve times directly', () => {
    const stats = buildEmptyCommunityRoadStats(1, 'classic');
    stats.behavior.totalHints = 3;
    stats.behavior.averageSolveTimeMs = 90_000;
    expect(
      formatFieldBehaviorRows(stats, 645_000, (value) =>
        value === 90_000 ? '1m 30s' : '10m 45s',
      ),
    ).toEqual([
      'Solvers used 3 hints in total.',
      'Field solve time averaged 1m 30s. You solved it in 10m 45s.',
    ]);
  });

  it('includes the fastest field solve when the aggregate is available', () => {
    const stats = buildEmptyCommunityRoadStats(1, 'classic');
    stats.behavior.bestSolveTimeMs = 54_000;
    expect(
      formatFieldBehaviorRows(stats, null, (value) =>
        value === 54_000 ? '54s' : 'unexpected',
      ),
    ).toEqual([
      'No hints were used on this road.',
      'Fastest field solve was 54s.',
    ]);
  });
});
