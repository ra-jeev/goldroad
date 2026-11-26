/**
 * Pure stats-page presentation helpers, extracted from `app/pages/stats.vue`
 * so the percentile math and empty-data states are unit-testable without
 * mounting the page (RP1-9).
 */
import type { CommunityRoadStats } from '#shared/types/game';

export function toPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

/**
 * Where the player stands against the rest of the field. It says only what is
 * true: ties are never counted as beaten, so the number never overstates.
 * Built from the unpooled `solvedAttemptsExact` distribution, so players past
 * the histogram's 25+ bucket stay exact. Players who never finished count as
 * players the solver beat.
 *
 * `alreadyCounted` is true when the field already includes this player's
 * solve, as it does on the web. Then the player is taken out of the field
 * before the comparison. On iPhone, a player who does not share stats is not
 * in the field, so nothing is taken out.
 * Returns null when no one else walked the road.
 */
export type FieldStanding =
  | { kind: 'led' }
  | { kind: 'matchedBest' }
  | { kind: 'beat'; percent: number }
  | { kind: 'noneWorse'; tied: boolean };

export function fieldStanding(
  stat: Pick<CommunityRoadStats, 'plays' | 'solvedAttemptsExact'>,
  playerAttempts: number,
  alreadyCounted: boolean,
): FieldStanding | null {
  if (playerAttempts < 1) return null;
  const self = alreadyCounted ? 1 : 0;
  const others = stat.plays - self;
  if (others <= 0) return null;

  let better = 0;
  let tied = 0;
  for (const [key, count] of Object.entries(stat.solvedAttemptsExact)) {
    const attempts = Number.parseInt(key, 10);
    if (attempts < playerAttempts) better += count;
    else if (attempts === playerAttempts) tied += count;
  }
  tied = Math.max(0, tied - self);
  better = Math.min(better, others);
  tied = Math.min(tied, others - better);
  const worse = others - better - tied;

  if (better === 0) return tied === 0 ? { kind: 'led' } : { kind: 'matchedBest' };
  if (worse === 0) return { kind: 'noneWorse', tied: tied > 0 };
  const percent = Math.min(99, Math.max(1, Math.round((worse / others) * 100)));
  return { kind: 'beat', percent };
}

export function fieldStandingSentence(standing: FieldStanding): string {
  switch (standing.kind) {
    case 'led':
      return 'You led the field.';
    case 'matchedBest':
      return 'You matched the best in the field.';
    case 'beat':
      return `You beat ${standing.percent}% of the field.`;
    case 'noneWorse':
      return standing.tied
        ? 'Nobody in the field needed more.'
        : 'The field needed fewer.';
  }
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
      : `Solvers used ${stat.behavior.totalHints} ${stat.behavior.totalHints === 1 ? 'hint' : 'hints'} in total.`,
  ];

  if (stat.behavior.averageSolveTimeMs !== null) {
    const fieldTime = formatDuration(stat.behavior.averageSolveTimeMs);
    rows.push(
      playerSolveTimeMs === null
        ? `Field solve time averaged ${fieldTime}.`
        : `Field solve time averaged ${fieldTime}. You solved it in ${formatDuration(playerSolveTimeMs)}.`,
    );
  }

  if (stat.behavior.bestSolveTimeMs !== null) {
    rows.push(
      `Fastest field solve was ${formatDuration(stat.behavior.bestSolveTimeMs)}.`,
    );
  }

  return rows;
}
