import { redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect } from 'vitest';
import type { PublicRoad } from '../../shared/api';
import { finishTry, startTry } from './runs';
import { getTrap, wrongStep } from './trap';

const test = createDevvitTest();

const DAY = '2026-11-24';
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
const GOLD = [0, 3, 6, 7, 8];

async function walk(id: string, path: number[]) {
  await startTry(id, DAY, 'classic');
  return finishTry({ id, name: id }, DAY, 'classic', road, path);
}

test('the wrong step is the first one no gold route takes', () => {
  const gold = [GOLD, [0, 3, 4, 7, 8]];
  expect(wrongStep([0, 1, 4, 7, 8], gold)).toEqual({ from: 0, to: 1 });
  expect(wrongStep([0, 3, 4, 5, 8], gold)).toEqual({ from: 4, to: 5 });
  expect(wrongStep([0, 3, 4, 7, 8], gold)).toBeNull();
});

test('the trap is the wrong step most first tries took', async () => {
  await redis.set(`gold:${DAY}:classic`, JSON.stringify([GOLD]));
  await walk('t2_a', [0, 1, 4, 7, 8]);
  await walk('t2_a', GOLD); // second try: not counted
  await walk('t2_b', [0, 1, 4, 7, 8]);
  await walk('t2_c', [0, 3, 4, 7, 8]);
  await walk('t2_d', GOLD);
  await finishTry(null, DAY, 'classic', road, [0, 3, 4, 7, 8]); // logged out: not counted

  expect(await getTrap(DAY, 'classic')).toEqual({
    walkers: 4,
    solvedFirst: 1,
    trapped: 2,
    from: 0,
    wrongTo: 1,
    goldTo: 3,
    goldRoute: GOLD,
  });
});
