/**
 * One-shot last-step undo. A mis-tap shield, not a rewind: after taking the
 * step back, the player must move again before undo is available.
 */

import type { Board } from '#shared/types/game';
import {
  buildEdgeMap,
  getActiveNeighbors,
  getEdgeType,
} from '#shared/utils/puzzleEngine';

export type UndoEvent = 'move' | 'undo' | 'reset' | 'end';

export function canUndoLastStep(input: {
  ended: boolean;
  undoAvailable: boolean;
}): boolean {
  return !input.ended && input.undoAvailable;
}

/** True when Backspace should become undo, not a browser or text-field action. */
export function shouldHandleUndoKey(input: {
  key: string;
  canUndo: boolean;
  hasModifier: boolean;
  isTextEntry: boolean;
}): boolean {
  return (
    input.key === 'Backspace' &&
    input.canUndo &&
    !input.hasModifier &&
    !input.isTextEntry
  );
}

export function isTextEntryEventTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined') return false;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return (
    target.isContentEditable ||
    target.closest('[contenteditable="true"]') !== null
  );
}

/**
 * Tapping the tile you just came from is the same take-back as the button.
 * Only the tile immediately behind you counts: two tiles back would be a
 * rewind, which the one-step rule does not allow.
 */
export function isUndoTapTarget(
  pathHistory: readonly number[],
  tileIndex: number,
): boolean {
  return (
    pathHistory.length >= 2 && pathHistory[pathHistory.length - 2] === tileIndex
  );
}

/** Whether the next run state should offer a take-back. */
export function nextUndoAvailable(event: UndoEvent, ended: boolean): boolean {
  return event === 'move' && !ended;
}

/**
 * An already-solved replay clears its solved rest on the first step off the
 * start tile. Undoing that step should put the board back at solved rest.
 */
export function shouldRestoreSolvedRest(input: {
  trackingDisabled: boolean;
  pathLengthAfterUndo: number;
}): boolean {
  return input.trackingDisabled && input.pathLengthAfterUndo === 1;
}

export function applyUndoLastStep(
  board: Board,
  state: {
    pathHistory: readonly number[];
    score: number;
    moves: number;
  },
): {
  pathHistory: number[];
  visited: Set<number>;
  currentTileIndex: number;
  score: number;
  moves: number;
  activeNeighbors: number[];
} | null {
  if (state.pathHistory.length <= 1) return null;

  const last = state.pathHistory[state.pathHistory.length - 1]!;
  const previous = state.pathHistory[state.pathHistory.length - 2]!;
  const pathHistory = state.pathHistory.slice(0, -1);
  const edgeMap = buildEdgeMap(board);
  const edgeType = getEdgeType(previous, last, edgeMap);
  let modifier = 0;
  if (edgeType === 'toll') modifier = -board.tollValue;
  if (edgeType === 'bonus') modifier = board.bonusValue;

  const visited = new Set(pathHistory);
  return {
    pathHistory,
    visited,
    currentTileIndex: previous,
    score: state.score - (board.tiles[last] ?? 0) - modifier,
    moves: state.moves - 1,
    activeNeighbors: getActiveNeighbors(
      previous,
      board.rows,
      board.cols,
      edgeMap,
      visited,
    ),
  };
}
