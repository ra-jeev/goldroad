/**
 * Pure aggregation helpers for the stats overview API.
 *
 * Extracted from server/api/stats/overview.get.ts so the row-shaping and
 * rounding logic can be unit tested without a database. The route handler
 * remains responsible for the SQL aggregation (COUNT/SUM/AVG per gameNo +
 * puzzleType); this module only shapes the already-aggregated rows into the
 * public CommunityRoadStats/StatsRoadDay contract.
 */

import type {
  CommunityRoadStats,
  PuzzleType,
  StatsRoadDay,
} from '../../shared/types/game';

export type SolvedAttemptsRow = {
  gameNo: number;
  puzzleType: PuzzleType;
  attempts: number;
  count: number;
};

/**
 * Bucket solved-attempt rows for one road+mode into a distribution keyed by
 * attempt count, with everything at or beyond `upperBound` pooled into one
 * `${upperBound}+` bucket — v1's histogram contract. Only relative shape is
 * ever shown to players; absolute counts stay server-side data.
 */
export function buildSolvedAttemptsDistribution(
  rows: SolvedAttemptsRow[],
  upperBound = 25,
): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const row of rows) {
    if (row.attempts < 1 || row.count <= 0) continue;
    const key =
      row.attempts >= upperBound ? `${upperBound}+` : String(row.attempts);
    distribution[key] = (distribution[key] ?? 0) + row.count;
  }

  return distribution;
}

/**
 * Same solved-attempt rows as `buildSolvedAttemptsDistribution`, but with no
 * pooled tail bucket — every attempt count is its own exact key. This isn't
 * for histogram display (the pooled version keeps that): it lets the client
 * compute an exact "top N%" for players whose attempt count falls in or past
 * the display bucket's pooled 25+ range (RP0-4).
 */
export function buildExactSolvedAttemptsDistribution(
  rows: SolvedAttemptsRow[],
): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const row of rows) {
    if (row.attempts < 1 || row.count <= 0) continue;
    const key = String(row.attempts);
    distribution[key] = (distribution[key] ?? 0) + row.count;
  }

  return distribution;
}

export type AggregatedRoadStatsRow = {
  gameNo: number;
  puzzleType: PuzzleType;
  plays: number;
  exactSolves: number;
  gold: number;
  silver: number;
  bronze: number;
  hintUsers: number;
  totalHints: number;
  averageAttemptsBeforeFirstHint: number | null;
  averageFirstHintMoveIndex: number | null;
  averageSolveTimeMs: number | null;
  bestSolveTimeMs: number | null;
};

export function createEmptyStatsRoadDay(gameNo: number | null): StatsRoadDay {
  return {
    gameNo,
    classic: null,
    expedition: null,
  };
}

export function roundNullable(value: number | null, digits = 2): number | null {
  if (value === null || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
}

export function buildEmptyCommunityRoadStats(
  gameNo: number,
  puzzleType: PuzzleType,
): CommunityRoadStats {
  return {
    gameNo,
    puzzleType,
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
      averageSolveTimeMs: null,
      bestSolveTimeMs: null,
    },
  };
}

export function toCommunityRoadStats(
  row: AggregatedRoadStatsRow,
  solvedAttempts: Record<string, number> = {},
  solvedAttemptsExact: Record<string, number> = {},
): CommunityRoadStats {
  const solveRate =
    row.plays > 0 ? Math.round((row.exactSolves / row.plays) * 100) : 0;
  const hintUseRate =
    row.plays > 0 ? Math.round((row.hintUsers / row.plays) * 100) : 0;

  return {
    gameNo: row.gameNo,
    puzzleType: row.puzzleType,
    plays: row.plays,
    exactSolves: row.exactSolves,
    solveRate,
    gold: row.gold,
    silver: row.silver,
    bronze: row.bronze,
    solvedAttempts,
    solvedAttemptsExact,
    behavior: {
      hintUsers: row.hintUsers,
      totalHints: row.totalHints,
      hintUseRate,
      averageAttemptsBeforeFirstHint: roundNullable(
        row.averageAttemptsBeforeFirstHint,
      ),
      averageFirstHintMoveIndex: roundNullable(row.averageFirstHintMoveIndex),
      averageSolveTimeMs: roundNullable(row.averageSolveTimeMs, 0),
      bestSolveTimeMs: roundNullable(row.bestSolveTimeMs, 0),
    },
  };
}
