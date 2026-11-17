// One walk on one road: route, score, legal next tiles and the outcome.
// Plain functions over plain data, so the rules are testable without Vue.
// The scoring and undo rules are the website's own (shared/ and app/utils/).
import type { Board } from '#game/shared/types/game';
import { buildEdgeMap, getActiveNeighbors, getEdgeType } from '#game/shared/utils/puzzleEngine';
import { applyUndoLastStep, isUndoTapTarget } from '#game/app/utils/undoLastStep';

export type RunOutcome = 'solved' | 'wrong-exit' | 'dead-end';

export type RunState = {
  path: number[];
  score: number;
  active: number[];
  outcome: RunOutcome | null;
  /** One take-back after each move, as on the website. */
  undoAvailable: boolean;
};

export type MoveResult =
  | { kind: 'moved'; state: RunState; edge: 'open' | 'toll' | 'bonus' }
  | { kind: 'undo'; state: RunState }
  | { kind: 'denied' };

export function startRun(board: Board): RunState {
  return {
    path: [board.start],
    score: board.tiles[board.start] ?? 0,
    active: getActiveNeighbors(board.start, board.rows, board.cols, buildEdgeMap(board), new Set([board.start])),
    outcome: null,
    undoAvailable: false,
  };
}

export function current(state: RunState): number {
  return state.path[state.path.length - 1]!;
}

export function moveTo(board: Board, target: number, state: RunState, tile: number): MoveResult {
  if (state.outcome) return { kind: 'denied' };
  if (!state.active.includes(tile)) {
    // Tapping the tile you came from is the same take-back as the button.
    if (state.undoAvailable && isUndoTapTarget(state.path, tile)) {
      const undone = undo(board, state);
      return undone ? { kind: 'undo', state: undone } : { kind: 'denied' };
    }
    return { kind: 'denied' };
  }

  const edgeMap = buildEdgeMap(board);
  const edge = getEdgeType(current(state), tile, edgeMap);
  const edgeValue = edge === 'toll' ? -board.tollValue : edge === 'bonus' ? board.bonusValue : 0;
  const path = [...state.path, tile];
  const score = state.score + (board.tiles[tile] ?? 0) + edgeValue;

  let outcome: RunOutcome | null = null;
  let active: number[] = [];
  if (tile === board.end) {
    outcome = score === target ? 'solved' : 'wrong-exit';
  } else {
    active = getActiveNeighbors(tile, board.rows, board.cols, edgeMap, new Set(path));
    if (active.length === 0) outcome = 'dead-end';
  }

  return {
    kind: 'moved',
    edge: edge === 'toll' || edge === 'bonus' ? edge : 'open',
    state: { path, score, active, outcome, undoAvailable: outcome === null },
  };
}

export function undo(board: Board, state: RunState): RunState | null {
  if (state.outcome || !state.undoAvailable) return null;
  const result = applyUndoLastStep(board, { pathHistory: state.path, score: state.score, moves: 0 });
  if (!result) return null;
  return {
    path: result.pathHistory,
    score: result.score,
    active: result.activeNeighbors,
    outcome: null,
    undoAvailable: false,
  };
}

/**
 * Classic tiles only add. Once the score reaches the target away from the
 * flag, no route can land on it. Expedition tolls subtract, so it can recover.
 */
export function isOverTarget(mode: 'classic' | 'expedition', target: number, state: RunState): boolean {
  return mode === 'classic' && state.outcome === null && state.score >= target;
}
