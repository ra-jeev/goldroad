import { describe, expect, it } from 'vitest';
import type { Board } from '../shared/types/game';
import { findAllRoutes } from '../server/utils/pathfinder';

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    rows: 2,
    cols: 2,
    tiles: [1, 1, 1, 1],
    missingEdges: [],
    tollEdges: [],
    bonusEdges: [],
    tollValue: 1,
    bonusValue: 1,
    start: 0,
    end: 3,
    ...overrides,
  };
}

describe('findAllRoutes', () => {
  it('finds the highest-value route on a fully open board and sorts by descending total', () => {
    // 2x2 grid, all tile values 1: 0(TL) 1(TR) / 2(BL) 3(BR)
    const board = makeBoard();
    const routes = findAllRoutes(board);

    // Two equally-scored 3-tile routes exist: 0-1-3 and 0-2-3.
    expect(routes).toHaveLength(2);
    expect(routes[0]!.total).toBe(3);
    expect(routes[1]!.total).toBe(3);
    const paths = routes.map((r) => r.path).sort();
    expect(paths).toEqual([
      [0, 1, 3],
      [0, 2, 3],
    ]);
  });

  it('applies toll and bonus modifiers when scoring routes, changing which route is best', () => {
    const board = makeBoard({
      tollEdges: [{ from: 0, to: 1 }],
      bonusEdges: [{ from: 0, to: 2 }],
      tollValue: 1,
      bonusValue: 2,
    });
    const routes = findAllRoutes(board);

    expect(routes).toHaveLength(2);
    // 0 -(bonus +2)-> 2 -> 3 : 1 + 2 + 1 + 1 = 5
    expect(routes[0]).toMatchObject({ total: 5, path: [0, 2, 3] });
    // 0 -(toll -1)-> 1 -> 3 : 1 - 1 + 1 + 1 = 2
    expect(routes[1]).toMatchObject({ total: 2, path: [0, 1, 3] });
  });

  it('excludes routes blocked by missing edges', () => {
    const board = makeBoard({ missingEdges: [{ from: 1, to: 3 }] });
    const routes = findAllRoutes(board);

    // Only 0-2-3 remains; 0-1-3 is blocked because 1 can no longer reach 3.
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ total: 3, path: [0, 2, 3] });
  });

  it('returns an empty array when the end tile is unreachable', () => {
    const board = makeBoard({
      missingEdges: [
        { from: 1, to: 3 },
        { from: 2, to: 3 },
      ],
    });
    const routes = findAllRoutes(board);
    expect(routes).toEqual([]);
  });

  it('reports moves as the number of tiles visited, including start and end', () => {
    const board = makeBoard();
    const routes = findAllRoutes(board);
    for (const route of routes) {
      expect(route.moves).toBe(route.path.length);
    }
  });
});
