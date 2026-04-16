/**
 * Exact-solve and legacy outcome helpers.
 *
 * The exact-solve helpers are the new contract for milestone 1.
 * The ratio-tier helpers remain temporarily so the existing UI can be
 * migrated incrementally without a breaking all-at-once change.
 */

import type { Medal, OutcomeTier } from '../shared/types/game'
import { MEDAL_ATTEMPTS, TIER_THRESHOLDS, HINT_GOLD_LOCK_LEVEL } from './gameConstants'

/** Whether a run ends on the exact target score required for a solve. */
export function isExactSolve(score: number, maxScore: number): boolean {
  return score === maxScore
}

/**
 * Tries-based medal assignment for the FIRST exact solve of a puzzle.
 * Returns null for unsolved runs or solves on attempt 4+.
 */
export function calcMedalForAttempt(attemptNumber: number, solvedExact: boolean): Medal | null {
  if (!solvedExact) return null
  if (attemptNumber === MEDAL_ATTEMPTS.GOLD) return 'gold'
  if (attemptNumber === MEDAL_ATTEMPTS.SILVER) return 'silver'
  if (attemptNumber === MEDAL_ATTEMPTS.BRONZE) return 'bronze'
  return null
}

/**
 * Classify a completed (or abandoned) run into an OutcomeTier.
 *
 * @param score Coins collected on this run.
 * @param maxScore The puzzle's optimal (gold) score.
 * @param reachedEnd Whether the player reached the goal tile.
 * @param highestHintLevel Highest hint level used this run (0 = none).
 */
export function calcOutcomeTier(
  score: number,
  maxScore: number,
  reachedEnd: boolean,
  highestHintLevel: number,
): OutcomeTier {
  if (!reachedEnd) return 'unfinished'

  const goldLocked = highestHintLevel >= HINT_GOLD_LOCK_LEVEL
  if (!goldLocked && score === maxScore) return 'gold'

  const ratio = score / maxScore
  if (ratio >= TIER_THRESHOLDS.SILVER) return 'silver'
  if (ratio >= TIER_THRESHOLDS.BRONZE) return 'bronze'
  return 'finished'
}

/**
 * Score after applying hint penalties.
 * Penalties are proportional; they stack multiplicatively to avoid
 * impossible results when multiple hints are used.
 */
export function applyHintPenalties(rawScore: number, penalties: number[]): number {
  const multiplier = penalties.reduce((m, p) => m * (1 - p), 1)
  return Math.round(rawScore * multiplier)
}

export const MEDAL_LABEL: Record<Medal, string> = {
  gold: 'Solved on the first try.',
  silver: 'Solved on the second try.',
  bronze: 'Solved on the third try.',
}

export const MEDAL_SHORT: Record<Medal, string> = {
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
}

export const TIER_LABEL: Record<OutcomeTier, string> = {
  gold: 'Perfect route. You found the richest road.',
  silver: 'Excellent run. Just a few coins short of gold.',
  bronze: 'Great pathing. A richer route is out there.',
  finished: 'Destination reached. Try again for a richer route.',
  unfinished: 'Road blocked. Try a different branch.',
}

export const TIER_SHORT: Record<OutcomeTier, string> = {
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
  finished: 'Finished',
  unfinished: 'Unfinished',
}