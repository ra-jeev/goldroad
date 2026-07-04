import { describe, expect, it } from 'vitest';
import type { Board } from '../shared/types/game';
import {
  allBoardEdgePairs,
  buildEdgeMap,
  canMove,
  getActiveNeighbors,
  getDirection,
  getEdgeType,
  getNeighborId,
  parseTileIndex,
  tileIndex,
} from '../shared/utils/puzzleEngine';

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    rows: 2,
    cols: 3,
    tiles: [1, 2, 3, 4, 5, 6],
    missingEdges: [],
    tollEdges: [],
    bonusEdges: [],
    tollValue: 1,
    bonusValue: 1,
    start: 0,
    end: 5,
    ...overrides,
  };
}

describe('tileIndex / parseTileIndex', () => {
  it('round-trips row/col <-> index', () => {
    const cols = 3;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = tileIndex(row, col, cols);
        expect(parseTileIndex(idx, cols)).toEqual([row, col]);
      }
    }
  });
});

describe('buildEdgeMap / getEdgeType / canMove', () => {
  it('defaults to open when no edge entry exists', () => {
    const board = makeBoard();
    const map = buildEdgeMap(board);
    expect(getEdgeType(0, 1, map)).toBe('open');
    expect(canMove(0, 1, map)).toBe(true);
  });

  it('registers missing edges in both directions and blocks movement', () => {
    const board = makeBoard({ missingEdges: [{ from: 0, to: 1 }] });
    const map = buildEdgeMap(board);
    expect(getEdgeType(0, 1, map)).toBe('missing');
    expect(getEdgeType(1, 0, map)).toBe('missing');
    expect(canMove(0, 1, map)).toBe(false);
    expect(canMove(1, 0, map)).toBe(false);
  });

  it('keeps toll and bonus edges traversable', () => {
    const board = makeBoard({
      tollEdges: [{ from: 0, to: 1 }],
      bonusEdges: [{ from: 1, to: 2 }],
    });
    const map = buildEdgeMap(board);
    expect(getEdgeType(0, 1, map)).toBe('toll');
    expect(canMove(0, 1, map)).toBe(true);
    expect(getEdgeType(1, 2, map)).toBe('bonus');
    expect(canMove(1, 2, map)).toBe(true);
  });
});

describe('getNeighborId', () => {
  it('returns null out of bounds and the correct index otherwise', () => {
    const rows = 2;
    const cols = 3;
    expect(getNeighborId(0, 0, 'top', rows, cols)).toBeNull();
    expect(getNeighborId(0, 0, 'left', rows, cols)).toBeNull();
    expect(getNeighborId(0, 0, 'right', rows, cols)).toBe(1);
    expect(getNeighborId(0, 0, 'bottom', rows, cols)).toBe(3);
    expect(getNeighborId(1, 2, 'bottom', rows, cols)).toBeNull();
    expect(getNeighborId(1, 2, 'right', rows, cols)).toBeNull();
  });
});

describe('getActiveNeighbors', () => {
  it('excludes visited tiles and blocked edges, includes toll/bonus edges', () => {
    const board = makeBoard({
      missingEdges: [{ from: 0, to: 3 }],
      tollEdges: [{ from: 0, to: 1 }],
    });
    const map = buildEdgeMap(board);
    const neighbors = getActiveNeighbors(0, board.rows, board.cols, map, new Set([0]));
    // 0's neighbors are 1 (right, toll but open) and 3 (bottom, missing -> blocked)
    expect(neighbors.sort()).toEqual([1]);
  });

  it('returns no neighbors when all are already visited', () => {
    const board = makeBoard();
    const map = buildEdgeMap(board);
    const neighbors = getActiveNeighbors(
      0,
      board.rows,
      board.cols,
      map,
      new Set([0, 1, 3]),
    );
    expect(neighbors).toEqual([]);
  });
});

describe('getDirection', () => {
  it('infers the cardinal direction between adjacent tiles', () => {
    const cols = 3;
    expect(getDirection(4, 1, cols)).toBe('top');
    expect(getDirection(1, 4, cols)).toBe('bottom');
    expect(getDirection(1, 0, cols)).toBe('left');
    expect(getDirection(0, 1, cols)).toBe('right');
  });
});

describe('allBoardEdgePairs', () => {
  it('produces exactly the expected number of adjacent pairs for a grid', () => {
    const rows = 3;
    const cols = 3;
    const pairs = allBoardEdgePairs(rows, cols);
    // horizontal: rows * (cols - 1); vertical: (rows - 1) * cols
    const expectedCount = rows * (cols - 1) + (rows - 1) * cols;
    expect(pairs.length).toBe(expectedCount);
    // every pair should be orthogonally adjacent
    for (const [from, to] of pairs) {
      const [fr, fc] = parseTileIndex(from, cols);
      const [tr, tc] = parseTileIndex(to, cols);
      expect(Math.abs(fr - tr) + Math.abs(fc - tc)).toBe(1);
    }
  });
});
