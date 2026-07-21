/**
 * Pure stats-page presentation helpers, extracted from `app/pages/stats.vue`
 * so the percentile math and empty-data states are unit-testable without
 * mounting the page (RP1-9).
 */
import type { CommunityRoadStats } from '../../shared/types/game';

export function toPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

/**
 * v1's "top X%": the share of the whole field that did as well as or better
 * than the player, the player included. Smaller is better. Computed from the
 * *unpooled* solved-attempts distribution (`solvedAttemptsExact`) against
 * everyone who played, independent of the display histogram's pooled 25+
 * bucket, so it stays exact for players above that bucket too (RP0-4).
 */
export function topPercent(
  stat: CommunityRoadStats,
  playerAttempts: number,
): number {
  if (playerAttempts < 1 || stat.plays <= 0) return 0;

  let atOrBetter = 0;
  for (const [key, count] of Object.entries(stat.solvedAttemptsExact)) {
    const attempts = Number.parseInt(key, 10);
    if (attempts <= playerAttempts) {
      atOrBetter += count;
    }
  }

  return Math.max(1, toPercent(atOrBetter, stat.plays));
}

/**
 * A percentile can be shown as soon as the field contains one recorded
 * solve. With no recorded solves there is no comparison to calculate.
 */
export function hasPercentileSample(stat: CommunityRoadStats): boolean {
  return stat.exactSolves > 0;
}

/** A single completed field entry is enough to show the histogram. */
export function hasCommunitySample(stat: CommunityRoadStats): boolean {
  return stat.plays > 0;
}

export function formatFieldBehaviorRows(
  stat: CommunityRoadStats,
  playerSolveTimeMs: number | null,
  formatDuration: (value: number) => string,
): string[] {
  const rows = [
    stat.behavior.totalHints === 0
      ? 'No hints were used on this road.'
      : `Solvers used ${stat.behavior.totalHints} hints in total.`,
  ];

  if (stat.behavior.averageSolveTimeMs !== null) {
    const fieldTime = formatDuration(stat.behavior.averageSolveTimeMs);
    rows.push(
      playerSolveTimeMs === null
        ? `Field solve time averaged ${fieldTime}.`
        : `Field solve time averaged ${fieldTime}. You solved it in ${formatDuration(playerSolveTimeMs)}.`,
    );
  }

  return rows;
}
