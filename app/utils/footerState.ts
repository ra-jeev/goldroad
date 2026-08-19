/**
 * Pure board-footer state machine, extracted from `GameBoardFooter.vue` so
 * the six-state contract (RP1-10) is unit-testable without mounting the
 * component (RP1-9).
 *
 * The footer shows exactly one contextual message (or none) plus the
 * state-relevant actions — v1's GameFooter contract, with Hint as the one
 * deliberate addition since v1 had no hint feature.
 */
export type FooterState =
  | 'resting-first' // board at rest, first attempt: one instruction
  | 'resting-retry' // board at rest after a retry: attempt count only
  | 'mid-run' // moves made: no text, quiet retry + hint icons only
  | 'failed' // run ended unsolved: what happened + promoted Try again
  | 'solved-next' // solved, Expedition waiting: actions only
  | 'solved-final'; // solved, day done here: ticker + quiet actions

export type FooterStateInput = {
  solved: boolean;
  ended: boolean;
  hasMoved: boolean;
  attemptNumber: number;
  trackingDisabled: boolean;
  canSwitchToExpedition: boolean;
};

/**
 * Undo appears once the player has moved, the same rule Try again follows.
 * At rest there is nothing to take back and never will be from that state, so
 * a greyed button there is furniture. Undoing all the way to the start drops
 * both controls together, which reads as one change rather than a flicker.
 */
export function shouldShowUndoAction(state: FooterState): boolean {
  return state === 'mid-run';
}

export function computeFooterState(input: FooterStateInput): FooterState {
  if (input.solved) {
    return input.canSwitchToExpedition ? 'solved-next' : 'solved-final';
  }
  if (input.ended) return 'failed';
  if (input.hasMoved) return 'mid-run';
  return input.attemptNumber > 1 && !input.trackingDisabled
    ? 'resting-retry'
    : 'resting-first';
}
