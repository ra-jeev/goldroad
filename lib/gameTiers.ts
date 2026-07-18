/**
 * Solve outcome helpers — the target-score solve contract for milestone 1.
 */

import type { Medal } from '../shared/types/game'
import { MEDAL_ATTEMPTS } from './gameConstants'

/** Whether a run reaches the target score required for a solve. */
export function isExactSolve(score: number, maxScore: number): boolean {
  return score === maxScore
}

/**
 * Tries-based medal assignment for the first solve of a puzzle.
 * Returns null for unsolved runs or solves on attempt 4+.
 */
export function calcMedalForAttempt(attemptNumber: number, solved: boolean): Medal | null {
  if (!solved) return null
  if (attemptNumber === MEDAL_ATTEMPTS.GOLD) return 'gold'
  if (attemptNumber === MEDAL_ATTEMPTS.SILVER) return 'silver'
  if (attemptNumber === MEDAL_ATTEMPTS.BRONZE) return 'bronze'
  return null
}
