import { describe, expect, it } from 'vitest';
import type { Board } from '#game/shared/types/game';
import { isOverTarget, moveTo, startRun, undo } from './run';

// 3x3, start top-left (0), flag bottom-right (8).
//  1 2 3
//  4 5 6
//  7 8 9
// Edge 1-2 is a toll (-1). Edge 3-6 is missing.
const board: Board = {
  rows: 3,
  cols: 3,
  tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  missingEdges: [{ from: 2, to: 5 }],
  tollEdges: [{ from: 1, to: 2 }],
  bonusEdges: [],
  tollValue: 1,
  bonusValue: 1,
  start: 0,
  end: 8,
};

function walk(target: number, tiles: number[]) {
  let state = startRun(board);
  for (const tile of tiles) {
    const result = moveTo(board, target, state, tile);
    if (result.kind === 'denied') throw new Error(`denied ${tile}`);
    state = result.state;
  }
  return state;
}

describe('run', () => {
  it('starts on the footprints with the start tile counted', () => {
    const state = startRun(board);
    expect(state.path).toEqual([0]);
    expect(state.score).toBe(1);
    expect(state.active.sort()).toEqual([1, 3]);
  });

  it('adds tiles and applies tolls', () => {
    const state = walk(99, [1, 2]);
    expect(state.score).toBe(1 + 2 + 3 - 1);
  });

  it('solves only on the exact target at the flag', () => {
    expect(walk(1 + 4 + 7 + 8 + 9, [3, 6, 7, 8]).outcome).toBe('solved');
    expect(walk(30, [3, 6, 7, 8]).outcome).toBe('wrong-exit');
  });

  it('ends on a dead end', () => {
    // 0 → 1 → 2: tile 2 has no open way down (2-5 missing).
    expect(walk(99, [1, 2]).outcome).toBe('dead-end');
  });

  it('denies tiles that are not next to you', () => {
    expect(moveTo(board, 99, startRun(board), 8).kind).toBe('denied');
  });

  it('takes back one step only, by button or by tapping the tile behind', () => {
    const state = walk(99, [1, 4]);
    const back = undo(board, state)!;
    expect(back.path).toEqual([0, 1]);
    expect(back.score).toBe(3);
    expect(undo(board, back)).toBeNull();

    const tapBack = moveTo(board, 99, state, 1);
    expect(tapBack.kind).toBe('undo');
  });

  it('marks a classic run lost once the score reaches the target off the flag', () => {
    const state = walk(8, [3, 4]);
    expect(isOverTarget('classic', 8, state)).toBe(true);
    expect(isOverTarget('expedition', 8, state)).toBe(false);
  });
});
