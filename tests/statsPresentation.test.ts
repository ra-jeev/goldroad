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
  fieldStanding,
  fieldStandingSentence,
  formatFieldBehaviorRows,
  toPercent,
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

  it('ranks a player inside the pooled bucket (attempts 25) from the exact map', () => {
    const stat = communityStatsFor(totalSolvers);
    // The player is in the field: 24 others did better, 5 did worse, of 29 others.
    expect(fieldStanding(stat, 25, true)).toEqual({ kind: 'beat', percent: 17 });
  });

  it('ranks a player past the pooled bucket (attempts 40) exactly', () => {
    const stat = communityStatsFor(totalSolvers);
    expect(fieldStanding(stat, 40, true)).toEqual({ kind: 'noneWorse', tied: false });
  });

  it('ranks a player between 29 and 40 attempts exactly, without joining the 40 bucket', () => {
    const stat = communityStatsFor(totalSolvers);
    // Not in the field: 29 did better, the 40-try solver did worse, of 30 others.
    expect(fieldStanding(stat, 30, false)).toEqual({ kind: 'beat', percent: 3 });
  });
});

describe('field standing rule', () => {
  const field = (plays: number, solvedAttemptsExact: Record<string, number>) => ({
    plays,
    solvedAttemptsExact,
  });

  it('says the player matched the best when everyone tied at the top', () => {
    expect(fieldStanding(field(10, { '1': 10 }), 1, false)).toEqual({ kind: 'matchedBest' });
    expect(fieldStanding(field(11, { '1': 11 }), 1, true)).toEqual({ kind: 'matchedBest' });
  });

  it('says the field needed fewer when everyone else did better', () => {
    expect(fieldStanding(field(10, { '1': 10 }), 2, false)).toEqual({ kind: 'noneWorse', tied: false });
    expect(fieldStandingSentence({ kind: 'noneWorse', tied: false })).toBe('The field needed fewer.');
  });

  it('never counts ties as beaten', () => {
    // 2 better, 5 tied, 3 worse (1 slower, 2 never finished) of 10 others.
    const stat = field(11, { '1': 2, '3': 6, '5': 1 });
    expect(fieldStanding(stat, 3, true)).toEqual({ kind: 'beat', percent: 30 });
    expect(fieldStandingSentence({ kind: 'beat', percent: 30 })).toBe('You beat 30% of the field.');
  });

  it('says the player led when no one else did as well', () => {
    expect(fieldStanding(field(4, { '1': 1, '4': 1 }), 1, true)).toEqual({ kind: 'led' });
  });

  it('has nothing to compare when no one else walked the road', () => {
    expect(fieldStanding(field(1, { '2': 1 }), 2, true)).toBeNull();
    expect(fieldStanding(field(0, {}), 2, false)).toBeNull();
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

  it('shows the standing line from the first other player', () => {
    const onlyYou = buildEmptyCommunityRoadStats(1, 'classic');
    onlyYou.plays = 1;
    onlyYou.solvedAttemptsExact = { '1': 1 };
    expect(fieldStanding(onlyYou, 1, true)).toBeNull();

    const oneOther = buildEmptyCommunityRoadStats(1, 'classic');
    oneOther.plays = 1;
    expect(fieldStanding(oneOther, 1, false)).toEqual({ kind: 'led' });
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
