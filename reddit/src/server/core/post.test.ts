import { reddit, redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect, vi } from 'vitest';
import { buildEdgeMap, canMove } from '#game/shared/utils/puzzleEngine';
import type { RoadPostData } from '../../shared/api';
import { dayForPost, ensureDailyPost } from './post';
import { getGoldRoutes, getOrCreateRoad, prepareRoad } from './road';
import { createTestRoadPost } from './testRoad';

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

test('a road made early keeps its board and takes its number when shown', async () => {
  await prepareRoad('2026-11-21', 'classic');
  const today = await getOrCreateRoad('2026-11-20', 'classic');
  const stored = JSON.parse((await redis.get('road:2026-11-21:classic'))!);
  const tomorrow = await getOrCreateRoad('2026-11-21', 'classic');

  expect(today.roadNo).toBe(1);
  expect(tomorrow.roadNo).toBe(2);
  expect(tomorrow.board).toEqual(stored.board);
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

test('two callers at once make one daily post', async () => {
  const spy = vi.spyOn(reddit, 'submitCustomPost');
  await getOrCreateRoad('2026-11-25', 'classic');

  const results = await Promise.allSettled([ensureDailyPost('2026-11-25'), ensureDailyPost('2026-11-25')]);

  expect(spy).toHaveBeenCalledTimes(1);
  expect(results.filter((r) => r.status === 'fulfilled' && r.value.created)).toHaveLength(1);
}, SLOW);

test('two first calls for a road agree on one board with its gold routes', async () => {
  const [a, b] = await Promise.all([
    getOrCreateRoad('2026-11-26', 'expedition'),
    getOrCreateRoad('2026-11-26', 'expedition'),
  ]);
  expect(b.board).toEqual(a.board);
  expect((await getGoldRoutes('2026-11-26', 'expedition'))?.length).toBeGreaterThan(0);
}, SLOW);

test('a test Sunday road takes no road number and uses its own old Sunday', async () => {
  const spy = vi.spyOn(reddit, 'submitCustomPost');
  const flair = vi.spyOn(reddit, 'setPostFlair');

  const first = await createTestRoadPost('wide');
  const second = await createTestRoadPost('maze');
  const daily = await getOrCreateRoad('2026-11-24', 'classic');

  expect(await dayForPost(first)).toBe('2000-01-02');
  expect(await dayForPost(second)).toBe('2000-01-09');
  expect(daily.roadNo).toBe(1);
  const wide = await getOrCreateRoad('2000-01-02', 'expedition');
  expect(wide.board.cols).toBe(7);
  expect(spy.mock.calls[0]![0].title).toMatch(/^GoldRoad test road · Community road: Wide road/);
  expect(flair).not.toHaveBeenCalled();
}, SLOW);
