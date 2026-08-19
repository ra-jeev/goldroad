import { describe, expect, it } from 'vitest';
import {
  computeFooterState,
  shouldShowUndoAction,
  type FooterStateInput,
} from '../app/utils/footerState';

function baseInput(overrides: Partial<FooterStateInput> = {}): FooterStateInput {
  return {
    solved: false,
    ended: false,
    hasMoved: false,
    attemptNumber: 1,
    trackingDisabled: false,
    canSwitchToExpedition: false,
    ...overrides,
  };
}

describe('computeFooterState (RP1-10 six-state contract)', () => {
  it('fresh: at rest, first attempt, no moves', () => {
    expect(computeFooterState(baseInput())).toBe('resting-first');
  });

  it('dirty (mid-run): any move made takes priority over rest/attempt state', () => {
    expect(
      computeFooterState(baseInput({ hasMoved: true, attemptNumber: 3 })),
    ).toBe('mid-run');
  });

  it('failed: run ended without solving, regardless of moves', () => {
    expect(
      computeFooterState(baseInput({ ended: true, hasMoved: true })),
    ).toBe('failed');
  });

  it('newly solved with Expedition waiting: solved-next', () => {
    expect(
      computeFooterState(
        baseInput({ solved: true, canSwitchToExpedition: true }),
      ),
    ).toBe('solved-next');
  });

  it('solved-reset: solved with nothing left to switch to is solved-final even before a replay move', () => {
    expect(
      computeFooterState(
        baseInput({ solved: true, canSwitchToExpedition: false, hasMoved: false }),
      ),
    ).toBe('solved-final');
  });

  it('resting after a failed attempt (retry available): resting-retry when tracked', () => {
    expect(
      computeFooterState(baseInput({ attemptNumber: 2, trackingDisabled: false })),
    ).toBe('resting-retry');
  });

  it('dirty untracked-replay retry: an untracked (already-solved) replay at rest never shows the attempt-resting state', () => {
    expect(
      computeFooterState(
        baseInput({ attemptNumber: 2, trackingDisabled: true }),
      ),
    ).toBe('resting-first');
  });

  it('shows undo only once the player has moved and the run is still live', () => {
    expect(shouldShowUndoAction('mid-run')).toBe(true);
    // Nothing to take back before the first step, or after the run ends.
    expect(shouldShowUndoAction('resting-first')).toBe(false);
    expect(shouldShowUndoAction('resting-retry')).toBe(false);
    expect(shouldShowUndoAction('failed')).toBe(false);
    expect(shouldShowUndoAction('solved-next')).toBe(false);
    expect(shouldShowUndoAction('solved-final')).toBe(false);
  });

  it('solved always wins over ended/hasMoved/attemptNumber', () => {
    expect(
      computeFooterState(
        baseInput({
          solved: true,
          ended: true,
          hasMoved: true,
          attemptNumber: 5,
          canSwitchToExpedition: true,
        }),
      ),
    ).toBe('solved-next');
  });
});
