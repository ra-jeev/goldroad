import { reddit, redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect, vi } from 'vitest';
import { buildEdgeMap, canMove } from '#game/shared/utils/puzzleEngine';
import type { RoadPostData } from '../../shared/api';
import { dayForPost, ensureDailyPost } from './post';
import { getGoldRoutes, getOrCreateRoad } from './road';

const test = createDevvitTest();

// The road generator enumerates routes, and a slow board can take seconds.
const SLOW = 60_000;

test('stores one road per day and keeps gold routes apart', async () => {
  const first = await getOrCreateRoad('2026-11-20', 'classic');
  const again = await getOrCreateRoad('2026-11-20', 'classic');

  expect(again).toEqual(first);
  expect(first.roadNo).toBe(1);
  expect(JSON.stringify(first)).not.toContain('optimal');

  const gold = await getGoldRoutes('2026-11-20', 'classic');
  expect(gold?.length).toBeGreaterThan(0);

  // The stored gold route is a legal walk on the stored board.
  const route = gold![0]!;
  const edges = buildEdgeMap(first.board);
  expect(route[0]).toBe(first.board.start);
  expect(route.at(-1)).toBe(first.board.end);
  for (let i = 1; i < route.length; i++) {
    expect(canMove(route[i - 1]!, route[i]!, edges)).toBe(true);
  }
}, SLOW);

test('numbers road days in order', async () => {
  const a = await getOrCreateRoad('2026-11-20', 'classic');
  const b = await getOrCreateRoad('2026-11-21', 'classic');
  const aExpedition = await getOrCreateRoad('2026-11-20', 'expedition');

  expect(a.roadNo).toBe(1);
  expect(b.roadNo).toBe(2);
  expect(aExpedition.roadNo).toBe(1);
}, SLOW);

test('daily post is created once and carries the board in postData', async () => {
  const spy = vi.spyOn(reddit, 'submitCustomPost');

  const first = await ensureDailyPost('2026-11-24');
  const second = await ensureDailyPost('2026-11-24');

  expect(first.created).toBe(true);
  expect(second).toEqual({ postId: first.postId, created: false });
  expect(spy).toHaveBeenCalledTimes(1);

  const options = spy.mock.calls[0]![0];
  const road = await getOrCreateRoad('2026-11-24', 'classic');
  expect(options.title).toBe(`GoldRoad #1 · Target ${road.target} · Tue 24 Nov`);
  expect(options.entry).toBe('default');

  const postData = options.postData as RoadPostData;
  expect(postData.tiles).toEqual(road.board.tiles);
  expect(JSON.stringify(postData).length).toBeLessThan(2048);

  expect(await dayForPost(first.postId)).toBe('2026-11-24');
  expect(await redis.get('post:day:2026-11-24')).toBe(first.postId);
}, SLOW);
