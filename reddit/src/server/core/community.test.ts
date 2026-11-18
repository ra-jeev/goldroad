import { redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect } from 'vitest';
import { ballotSunday, castVote, communityPick, getBallot, isSunday, shapeFor } from './community';
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
