import { describe, expect, it } from 'vitest';
import type { Board } from '../shared/types/game';
import {
  applyUndoLastStep,
  canUndoLastStep,
  isUndoTapTarget,
  nextUndoAvailable,
  shouldHandleUndoKey,
  shouldRestoreSolvedRest,
} from '../app/utils/undoLastStep';

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    rows: 2,
    cols: 3,
    tiles: [1, 2, 3, 4, 5, 6],
    missingEdges: [],
    tollEdges: [],
    bonusEdges: [],
    tollValue: 2,
    bonusValue: 4,
    start: 0,
    end: 5,
    ...overrides,
  };
}

describe('canUndoLastStep', () => {
  it('allows undo only while the run is live and one take-back is available', () => {
    expect(canUndoLastStep({ ended: false, undoAvailable: true })).toBe(true);
  });

  it('blocks undo after the take-back is spent', () => {
    expect(canUndoLastStep({ ended: false, undoAvailable: false })).toBe(false);
  });

  it('blocks undo after the run has ended, even if a take-back is still flagged', () => {
    expect(canUndoLastStep({ ended: true, undoAvailable: true })).toBe(false);
  });
});

describe('nextUndoAvailable', () => {
  it('earns a take-back after a move that did not end the run', () => {
    expect(nextUndoAvailable('move', false)).toBe(true);
  });

  it('does not earn a take-back after a move that ended the run', () => {
    expect(nextUndoAvailable('move', true)).toBe(false);
  });

  it('spends the take-back on undo, reset, and end', () => {
    expect(nextUndoAvailable('undo', false)).toBe(false);
    expect(nextUndoAvailable('reset', false)).toBe(false);
    expect(nextUndoAvailable('end', true)).toBe(false);
  });
});

describe('applyUndoLastStep', () => {
  it('returns null when there is no step to take back', () => {
    const board = makeBoard();
    expect(
      applyUndoLastStep(board, {
        pathHistory: [0],
        score: 1,
        moves: 1,
      }),
    ).toBeNull();
  });

  it('rewinds the last open-lane step and restores score, path, and neighbors', () => {
    const board = makeBoard();
    const result = applyUndoLastStep(board, {
      pathHistory: [0, 1, 2],
      score: 6,
      moves: 3,
    });

    expect(result).not.toBeNull();
    expect(result?.pathHistory).toEqual([0, 1]);
    expect(result?.currentTileIndex).toBe(1);
    expect(result?.score).toBe(3);
    expect(result?.moves).toBe(2);
    expect([...result!.visited].sort((a, b) => a - b)).toEqual([0, 1]);
    expect(result?.activeNeighbors.sort((a, b) => a - b)).toEqual([2, 4]);
  });

  it('adds the undone tile back as a legal neighbor so it can be stepped on again', () => {
    const board = makeBoard();
    const result = applyUndoLastStep(board, {
      pathHistory: [0, 1],
      score: 3,
      moves: 2,
    });

    expect(result?.pathHistory).toEqual([0]);
    expect(result?.currentTileIndex).toBe(0);
    expect(result?.score).toBe(1);
    expect(result?.moves).toBe(1);
    expect(result?.activeNeighbors.sort((a, b) => a - b)).toEqual([1, 3]);
  });

  it('reverses a toll paid on the last step', () => {
    const board = makeBoard({
      tollEdges: [{ from: 0, to: 1 }],
    });
    const result = applyUndoLastStep(board, {
      pathHistory: [0, 1],
      score: 1,
      moves: 2,
    });

    expect(result?.score).toBe(1);
  });

  it('reverses a bonus collected on the last step', () => {
    const board = makeBoard({
      bonusEdges: [{ from: 0, to: 1 }],
    });
    const result = applyUndoLastStep(board, {
      pathHistory: [0, 1],
      score: 7,
      moves: 2,
    });

    expect(result?.score).toBe(1);
  });
});

describe('isUndoTapTarget', () => {
  it('accepts a tap on the tile immediately behind the player', () => {
    expect(isUndoTapTarget([0, 1, 2], 1)).toBe(true);
  });

  it('rejects a tap two tiles back, which would be a rewind', () => {
    expect(isUndoTapTarget([0, 1, 2], 0)).toBe(false);
  });

  it('rejects the tile the player is standing on', () => {
    expect(isUndoTapTarget([0, 1, 2], 2)).toBe(false);
  });

  it('rejects a tile that is not on the walked path at all', () => {
    expect(isUndoTapTarget([0, 1, 2], 5)).toBe(false);
  });

  it('has nothing to take back from the start tile', () => {
    expect(isUndoTapTarget([0], 0)).toBe(false);
    expect(isUndoTapTarget([], 0)).toBe(false);
  });
});

describe('shouldHandleUndoKey', () => {
  const allowed = {
    key: 'Backspace',
    canUndo: true,
    hasModifier: false,
    isTextEntry: false,
  };

  it('captures Backspace only when a take-back is available', () => {
    expect(shouldHandleUndoKey(allowed)).toBe(true);
  });

  it('does not capture Backspace when undo is not allowed', () => {
    expect(shouldHandleUndoKey({ ...allowed, canUndo: false })).toBe(false);
  });

  it('does not capture Backspace with a modifier key', () => {
    expect(shouldHandleUndoKey({ ...allowed, hasModifier: true })).toBe(false);
  });

  it('does not capture Backspace while focus is in a text field', () => {
    expect(shouldHandleUndoKey({ ...allowed, isTextEntry: true })).toBe(false);
  });

  it('ignores keys other than Backspace', () => {
    expect(shouldHandleUndoKey({ ...allowed, key: 'z' })).toBe(false);
  });
});

describe('shouldRestoreSolvedRest', () => {
  it('restores solved rest when an already-solved replay undoes back to the start', () => {
    expect(
      shouldRestoreSolvedRest({
        trackingDisabled: true,
        pathLengthAfterUndo: 1,
      }),
    ).toBe(true);
  });

  it('does not restore solved rest mid-path or on an unsolved road', () => {
    expect(
      shouldRestoreSolvedRest({
        trackingDisabled: true,
        pathLengthAfterUndo: 2,
      }),
    ).toBe(false);
    expect(
      shouldRestoreSolvedRest({
        trackingDisabled: false,
        pathLengthAfterUndo: 1,
      }),
    ).toBe(false);
  });
});
