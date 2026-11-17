import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect } from 'vitest';
import type { PublicRoad } from '../../shared/api';
import { getHeat } from './heat';
import { finishTry, startTry } from './runs';

const test = createDevvitTest();

const DAY = '2026-11-24';
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
const WRONG_EXIT = [0, 1, 4, 7, 8];

async function walk(id: string, path: number[]) {
  await startTry(id, DAY, 'classic');
  return finishTry({ id, name: id }, DAY, 'classic', road, path);
}

test('the crowd map counts each player once, on their first finished try', async () => {
  await walk('t2_a', WRONG_EXIT);
  await walk('t2_a', WINNING); // second try: not counted
  await walk('t2_b', WINNING);
  await finishTry(null, DAY, 'classic', road, WINNING); // logged out: not counted

  const heat = await getHeat(DAY, 'classic', 9, WINNING);
  expect(heat.walkers).toBe(2);
  expect(heat.tiles).toEqual([2, 1, 0, 1, 1, 0, 1, 2, 2]);
  expect(heat.firstSteps).toEqual({ 1: 1, 3: 1 });
  expect(heat.goldRoute).toEqual(WINNING);
});
