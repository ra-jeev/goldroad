import { redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { afterEach, expect, vi } from 'vitest';
import type { PublicRoad } from '../../shared/api';
import { finishTry, startTry } from './runs';
import { getStanding, leaderScore, recordSolve } from './standing';
import { deleteUserData } from './userIndex';

const test = createDevvitTest();

const DAY = '2026-11-24';
const NOON = Date.parse(`${DAY}T12:00:00Z`);
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
const WINNING = [0, 3, 6, 7, 8];

afterEach(() => vi.restoreAllMocks());
const at = (ms: number) => vi.spyOn(Date, 'now').mockReturnValue(ms);

test('fewer tries win, then fewer hints, then less time', () => {
  expect(leaderScore(1, 5, 900)).toBeLessThan(leaderScore(2, 0, 10));
  expect(leaderScore(1, 0, 900)).toBeLessThan(leaderScore(1, 1, 10));
  expect(leaderScore(1, 0, 10)).toBeLessThan(leaderScore(1, 0, 11));
});

test('a solve on the day goes on the board with a rank', async () => {
  await recordSolve('t2_a', 'ann', DAY, 'classic', { attempts: 1, hints: 0, seconds: 20 });
  await recordSolve('t2_b', 'bob', DAY, 'classic', { attempts: 2, hints: 0, seconds: 20 });
  at(NOON);
  await startTry('t2_me', DAY, 'classic');
  at(NOON + 30_000);
  await finishTry({ id: 't2_me', name: 'me' }, DAY, 'classic', road, WINNING);

  const standing = await getStanding('t2_me', DAY, 'classic', true, DAY);
  expect(standing).toMatchObject({ counted: true, rank: 2, players: 3, streak: 1 });
  expect(standing.rows.map((row) => row.name)).toEqual(['ann', 'me', 'bob']);
  expect(standing.rows[1]).toMatchObject({ attempts: 1, hints: 0, seconds: 30, me: true });
});

test('a solve after the post day is practice: no board, no streak', async () => {
  at(Date.parse('2026-11-25T01:00:00Z'));
  await finishTry({ id: 't2_me', name: 'me' }, DAY, 'classic', road, WINNING);
  const standing = await getStanding('t2_me', DAY, 'classic', false, '2026-11-25');
  expect(standing).toMatchObject({ counted: false, rank: null, players: 0, streak: 0 });
});

test('the streak grows on days in a row and breaks after a missed day', async () => {
  const solve = { attempts: 1, hints: 0, seconds: 5 };
  await recordSolve('t2_me', 'me', '2026-11-22', 'classic', solve);
  await recordSolve('t2_me', 'me', '2026-11-23', 'classic', solve);
  await recordSolve('t2_me', 'me', '2026-11-23', 'classic', solve);
  await recordSolve('t2_me', 'me', '2026-11-24', 'expedition', solve);
  expect(await getStanding('t2_me', '2026-11-23', 'classic', true, '2026-11-24')).toMatchObject({
    streak: 2,
    bestStreak: 2,
  });
  // Nothing on the 24th or 25th: by the 26th it is gone, the best stays.
  expect(await getStanding('t2_me', '2026-11-23', 'classic', true, '2026-11-26')).toMatchObject({
    streak: 0,
    bestStreak: 2,
  });
});

test('a low rank shows the top 10 and the rows around the player', async () => {
  for (let i = 0; i < 14; i += 1) {
    await recordSolve(`t2_${i}`, `p${i}`, DAY, 'classic', { attempts: 1, hints: 0, seconds: i });
  }
  const standing = await getStanding('t2_12', DAY, 'classic', true, DAY);
  expect(standing.rank).toBe(13);
  expect(standing.rows.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14]);
});

test('deleting a user removes them from shared boards only', async () => {
  const solve = { attempts: 1, hints: 0, seconds: 5 };
  await recordSolve('t2_a', 'ann', DAY, 'classic', solve);
  await recordSolve('t2_me', 'me', DAY, 'classic', solve);
  await deleteUserData('t2_me');
  expect(await redis.zCard(`lb:${DAY}:classic`)).toBe(1);
  expect(await redis.hGetAll(`lb:${DAY}:classic:names`)).toEqual({ t2_a: 'ann' });
  expect(await redis.hGetAll('stats:t2_me')).toEqual({});
});
