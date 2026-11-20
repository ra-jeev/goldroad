import { redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect } from 'vitest';
import { buildEdgeMap, canMove } from '#game/shared/utils/puzzleEngine';
import { ballotSunday, castVote, COMMUNITY_OPTIONS, communityPick, getBallot, isSunday, shapeFor } from './community';
import { getGoldRoutes, getOrCreateRoad } from './road';
import { deleteUserData } from './userIndex';

const test = createDevvitTest();

// 2026-11-29 is a Sunday.
const TUE = '2026-11-24';
const SAT = '2026-11-28';
const SUN = '2026-11-29';

test('the ballot is for the first Sunday after today', () => {
  expect(isSunday(SUN)).toBe(true);
  expect(isSunday(SAT)).toBe(false);
  expect(ballotSunday(TUE)).toBe(SUN);
  expect(ballotSunday(SAT)).toBe(SUN);
  // On a Sunday, voting is already for next week.
  expect(ballotSunday(SUN)).toBe('2026-12-06');
});

test('one vote per player; a changed vote moves the count', async () => {
  await castVote('t2_a', 'maze', TUE);
  await castVote('t2_b', 'maze', TUE);
  await castVote('t2_a', 'wide', SAT);
  await castVote('t2_a', 'wide', SAT);

  const ballot = await getBallot('t2_a', SAT);
  expect(ballot.myVote).toBe('wide');
  expect(ballot.total).toBe(2);
  expect(ballot.options.map((option) => option.votes)).toEqual([1, 0, 1]);
  expect((await getBallot(null, SAT)).myVote).toBeNull();
});

test('the winner shapes the Sunday road and stays fixed', async () => {
  await castVote('t2_a', 'coins', TUE);
  await castVote('t2_b', 'coins', TUE);
  await castVote('t2_c', 'maze', TUE);

  const pick = await communityPick(SUN);
  expect(pick).toEqual({ id: 'coins', label: 'Big coins', votes: 2, total: 3 });
  expect(shapeFor(pick)).toEqual({ tileRange: [1, 9] });

  // Votes cast later go to next week and do not move this pick.
  await castVote('t2_d', 'maze', SUN);
  await castVote('t2_e', 'maze', SUN);
  expect(await communityPick(SUN)).toEqual(pick);
});

test("once Sunday's road is made, new votes go to the week after", async () => {
  await castVote('t2_a', 'wide', SAT);
  // The 23:30 job made Sunday's road and fixed its pick.
  expect(await communityPick(SUN)).toMatchObject({ id: 'wide', votes: 1 });

  const ballot = await castVote('t2_b', 'maze', SAT);
  expect(ballot.sunday).toBe('2026-12-06');
  expect(await communityPick(SUN)).toMatchObject({ id: 'wide', votes: 1 });
});

test('no votes or a weekday means a normal road', async () => {
  expect(await communityPick(SUN)).toBeNull();
  expect(await communityPick(TUE)).toBeNull();
  expect(shapeFor(null)).toEqual({});
});

test('a deleted account loses its vote', async () => {
  await castVote('t2_a', 'maze', TUE);
  await deleteUserData('t2_a');
  expect(await redis.hGet(`ballot:${SUN}`, 't2_a')).toBeUndefined();
});

// Each ballot option must make a real, solvable road in both modes.
for (const option of COMMUNITY_OPTIONS) {
  test(`a ${option.label} Sunday makes a solvable road`, async () => {
    await castVote('t2_a', option.id, TUE);
    for (const mode of ['classic', 'expedition'] as const) {
      const road = await getOrCreateRoad(SUN, mode);
      const { board } = road;
      expect(board.rows).toBe(option.shape.rows ?? 6);
      expect(board.cols).toBe(option.shape.cols ?? 6);
      expect(board.tiles).toHaveLength(board.rows * board.cols);
      if (option.shape.tileRange) {
        const [low, high] = option.shape.tileRange;
        expect(board.tiles.every((value) => value >= low && value <= high)).toBe(true);
      }
      if (option.shape.blockedEdges) {
        // The generator may drop a few walls to keep the road solvable.
        expect(board.missingEdges.length).toBeGreaterThanOrEqual(option.shape.blockedEdges - 4);
      }

      const route = (await getGoldRoutes(SUN, mode))![0]!;
      const edges = buildEdgeMap(board);
      expect(route[0]).toBe(board.start);
      expect(route.at(-1)).toBe(board.end);
      for (let i = 1; i < route.length; i++) expect(canMove(route[i - 1]!, route[i]!, edges)).toBe(true);
      console.log(`${option.id} ${mode}: ${board.rows}x${board.cols}, ${board.missingEdges.length} walls, target ${road.target}`);
    }
  }, 120_000);
}
