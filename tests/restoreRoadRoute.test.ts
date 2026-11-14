import { describe, expect, it } from 'vitest';
import type { Board } from '../shared/types/game';
import { restoreRoadRoute } from '../app/utils/restoreRoadRoute';

const board: Board = {
  rows: 2,
  cols: 3,
  tiles: [2, 3, 4, 5, 6, 7],
  start: 0,
  end: 5,
  missingEdges: [{ from: 1, to: 4 }, { from: 3, to: 4 }],
  tollEdges: [{ from: 0, to: 1 }],
  bonusEdges: [{ from: 1, to: 2 }],
  tollValue: 2,
  bonusValue: 3,
};

describe('restoreRoadRoute', () => {
  it('replays the saved tiles and edge costs to restore the board state', () => {
    expect(restoreRoadRoute(board, [0, 1, 2])).toEqual({
      current: 2,
      score: 10,
      visited: new Set([0, 1, 2]),
      neighbors: [5],
    });
  });

  it.each([
    [1, 2],
    [0, 4],
    [0, 1, 4],
    [0, 1, 0],
    [0, 3],
    [0, 1, 2, 5],
  ])('rejects an invalid or finished route (%s)', (...path) => {
    expect(restoreRoadRoute(board, path)).toBeNull();
  });
});
