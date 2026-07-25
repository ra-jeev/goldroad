import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SQLiteDialect } from 'drizzle-orm/sqlite-core';
import type { SQL } from 'drizzle-orm';

const queryState = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  selection: null as Record<string, unknown> | null,
  where: null as SQL | null,
}));

vi.mock('../server/db/client', () => ({
  useDb: () => ({
    select: (selection: Record<string, unknown>) => {
      queryState.selection = selection;
      return {
        from: () => ({
          where: (where: SQL) => {
            queryState.where = where;
            return { limit: async () => queryState.rows };
          },
        }),
      };
    },
  }),
}));

let boardHandler: (event: { gameNo: string }) => Promise<unknown>;

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (handler: typeof boardHandler) => handler);
  vi.stubGlobal(
    'getRouterParam',
    (event: { gameNo: string }, name: string) => (name === 'gameNo' ? event.gameNo : undefined),
  );
  vi.stubGlobal(
    'createError',
    (details: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(details.statusMessage), details),
  );
  ({ default: boardHandler } = await import(
    '../server/api/games/[gameNo]/board.get'
  ));
});

function archivedClassicRow(gameNo: number) {
  return {
    gameNo,
    puzzleType: 'classic',
    boardJson: JSON.stringify({
      rows: 3,
      cols: 3,
      tiles: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      missingEdges: [],
      tollEdges: [],
      bonusEdges: [],
      tollValue: 1,
      bonusValue: 1,
      start: 0,
      end: 8,
    }),
    maxScore: 9,
    totalCoins: 9,
    playableAt: '2026-07-01T00:00:00.000Z',
    nextGameAt: null,
    optimalPathsJson: JSON.stringify([[0, 1, 2, 5, 8]]),
  };
}

describe('GET /api/games/:gameNo/board archive boundary', () => {
  it('404s current and future road numbers', async () => {
    queryState.rows = [];
    await expect(boardHandler({ gameNo: '20' })).rejects.toMatchObject({
      statusCode: 404,
    });

    await expect(boardHandler({ gameNo: '21' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('queries only active, non-current roads playable at request time', async () => {
    queryState.rows = [];
    await expect(boardHandler({ gameNo: '20' })).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(queryState.selection).not.toHaveProperty('current');
    const query = new SQLiteDialect().sqlToQuery(queryState.where!);
    expect(query.params).toEqual(
      expect.arrayContaining([20, 1, 0, expect.any(String)]),
    );
  });

  it('returns a past road with its optimal paths', async () => {
    queryState.rows = [archivedClassicRow(19)];

    await expect(boardHandler({ gameNo: '19' })).resolves.toMatchObject({
      classic: {
        gameNo: 19,
        optimalPaths: [[0, 1, 2, 5, 8]],
      },
      expedition: null,
    });
  });
});
