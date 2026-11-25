import { redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect, vi } from 'vitest';
import type { PublicRoad } from '../../shared/api';
import { utcDay } from './day';
import { finishTry, getRun, startTry, useHint } from './runs';
import { deleteUserData } from './userIndex';

const test = createDevvitTest();

// Today, so a solve still counts: a solve after its day ends does not.
const DAY = utcDay();
const USER = 't2_walker';
const ME = { id: USER, name: 'walker' };

// 3x3, start 0, flag 8, road 2-5 missing, road 1-2 a toll.
//  1 2 3
//  4 5 6
//  7 8 9
const road: PublicRoad = {
  day: DAY,
  roadNo: 1,
  mode: 'classic',
  target: 29,
  board: {
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
  },
};
const GOLD = [[0, 3, 6, 7, 8]];
const WINNING = [0, 3, 6, 7, 8];
const WRONG_EXIT = [0, 1, 4, 7, 8];

test('a try is counted on its first step and the solve keeps that number', async () => {
  await startTry(USER, DAY, 'classic');
  await finishTry(ME, DAY, 'classic', road, WRONG_EXIT);
  await startTry(USER, DAY, 'classic');
  const result = await finishTry(ME, DAY, 'classic', road, WINNING);

  expect(result.outcome).toBe('solved');
  expect(result.score).toBe(29);
  expect(result.run).toMatchObject({ attempts: 2, solved: true, solvedAttempt: 2, medal: 'silver' });
});

test('two starts that arrive together both count', async () => {
  await Promise.all([startTry(USER, DAY, 'classic'), startTry(USER, DAY, 'classic')]);
  const result = await finishTry(ME, DAY, 'classic', road, WINNING);

  expect(result.run).toMatchObject({ attempts: 2, solvedAttempt: 2, medal: 'silver' });
});

test('the server scores the route itself and rejects illegal ones', async () => {
  await startTry(USER, DAY, 'classic');
  const wrong = await finishTry(ME, DAY, 'classic', road, WRONG_EXIT);
  expect(wrong.outcome).toBe('wrong-exit');
  expect(wrong.run?.solved).toBe(false);

  await expect(finishTry(ME, DAY, 'classic', road, [0, 8])).rejects.toMatchObject({ status: 400 });
  // Not finished: still on the board.
  await expect(finishTry(ME, DAY, 'classic', road, [0, 3])).rejects.toMatchObject({ status: 400 });
});

test('a solve is kept once; later tries change nothing', async () => {
  await startTry(USER, DAY, 'classic');
  await finishTry(ME, DAY, 'classic', road, WINNING);
  const again = await startTry(USER, DAY, 'classic');
  await finishTry(ME, DAY, 'classic', road, WINNING);

  expect(again.attempts).toBe(1);
  expect(await getRun(USER, DAY, 'classic')).toMatchObject({ attempts: 1, solvedAttempt: 1, medal: 'gold' });
});

test('a solve with no recorded start still counts as one try', async () => {
  const result = await finishTry(ME, DAY, 'classic', road, WINNING);
  expect(result.run).toMatchObject({ attempts: 1, solvedAttempt: 1, medal: 'gold' });
});

test('hints are counted on the server, one per new tile shown', async () => {
  const first = await useHint(USER, DAY, 'classic', road, GOLD, [0]);
  expect(first.hint).toMatchObject({ kind: 'next-step', nextTileIndex: 3 });
  expect(first.run).toMatchObject({ hintsUsed: 1, hintsLeft: 4, guidePath: [0, 3] });

  // Asking again from the same place shows the tile after that.
  const second = await useHint(USER, DAY, 'classic', road, GOLD, [0]);
  expect(second.run).toMatchObject({ hintsUsed: 2, guidePath: [0, 3, 6] });

  await expect(useHint(USER, DAY, 'classic', road, GOLD, [0, 8])).rejects.toMatchObject({ status: 400 });
});

test('a hint that shows nothing new is free', async () => {
  await redis.hSet(`run:${USER}:${DAY}:classic`, { hints: '2', guide: JSON.stringify(GOLD[0]) });
  const result = await useHint(USER, DAY, 'classic', road, GOLD, [0]);
  expect(result.run.hintsUsed).toBe(2);
});

test('the sixth hint is refused', async () => {
  await redis.hSet(`run:${USER}:${DAY}:classic`, { hints: '5', guide: '[0,3]' });
  await expect(useHint(USER, DAY, 'classic', road, GOLD, [0, 3])).rejects.toMatchObject({ status: 429 });
});

test('expedition stays locked until classic is solved', async () => {
  const expedition = { ...road, mode: 'expedition' as const };
  await expect(startTry(USER, DAY, 'expedition')).rejects.toMatchObject({ status: 403 });
  await finishTry(ME, DAY, 'classic', road, WINNING);
  await expect(startTry(USER, DAY, 'expedition')).resolves.toMatchObject({ attempts: 1 });
  await expect(finishTry(ME, DAY, 'expedition', expedition, WRONG_EXIT)).resolves.toMatchObject({
    outcome: 'wrong-exit',
  });
});

test('a retry of a solve whose rank write failed restores rank and streak once', async () => {
  await startTry(USER, DAY, 'classic');
  const zAdd = vi.spyOn(redis, 'zAdd').mockRejectedValueOnce(new Error('down'));
  await expect(finishTry(ME, DAY, 'classic', road, WINNING)).rejects.toThrow('down');
  zAdd.mockRestore();
  expect(await redis.zScore(`lb:${DAY}:classic`, USER)).toBeUndefined();

  await finishTry(ME, DAY, 'classic', road, WINNING);
  await finishTry(ME, DAY, 'classic', road, WINNING);

  expect(await redis.zScore(`lb:${DAY}:classic`, USER)).toBeDefined();
  expect(await redis.hGetAll(`stats:${USER}`)).toMatchObject({ lastDay: DAY, streak: '1', best: '1' });
  expect(await getRun(USER, DAY, 'classic')).toMatchObject({ attempts: 1, solvedAttempt: 1 });
});

test('logged-out players get a checked result and nothing is stored', async () => {
  const result = await finishTry(null, DAY, 'classic', road, WINNING);
  expect(result).toEqual({ outcome: 'solved', score: 29, run: null });
});

test('all data of a user can be deleted', async () => {
  await finishTry(ME, DAY, 'classic', road, WINNING);
  await deleteUserData(USER);
  expect(await getRun(USER, DAY, 'classic')).toMatchObject({ attempts: 0, solved: false });
  expect(await redis.hKeys(`user:${USER}`)).toEqual([]);
});
