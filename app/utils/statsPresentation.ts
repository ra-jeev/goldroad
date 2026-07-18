/**
 * Pure stats-page presentation helpers, extracted from `app/pages/stats.vue`
 * so the percentile math and sparse-sample gates are unit-testable without
 * mounting the page (RP1-9). Behavior is unchanged from the inline
 * implementation this replaces.
 */
import type { CommunityRoadStats } from '../../shared/types/game';

/**
 * Below this many plays, community numbers (histogram, headline solve rate)
 * are too small a sample to show as authoritative (RP0-4).
 */
export const COMMUNITY_SAMPLE_MIN = 5;

/**
 * Percentile claims need their own, higher bar: "top N%" is a specific,
 * authoritative-sounding number, and a tiny solved count can make ties or
 * single solvers look like a meaningful ranking. Below this many solvers,
 * the top-N% line is omitted even though the histogram and headline may
 * still show (RP0-4).
 */
export const PERCENTILE_SAMPLE_MIN = 10;

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
 * Tiny or suspicious solver samples shouldn't produce an authoritative
 * "top N%" claim (RP0-4). Gated on solved count, not raw plays, since the
 * percentile is a statement about the solved field.
 */
export function hasPercentileSample(stat: CommunityRoadStats): boolean {
  return stat.exactSolves >= PERCENTILE_SAMPLE_MIN;
}

/** Below this many plays, community histogram/headline numbers are hidden. */
export function hasCommunitySample(stat: CommunityRoadStats): boolean {
  return stat.plays >= COMMUNITY_SAMPLE_MIN;
}
