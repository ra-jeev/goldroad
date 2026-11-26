import { redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect } from 'vitest';
import { deleteIdleUsers, hasPlayed, markSeen, remember } from './userIndex';

const test = createDevvitTest();

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 11, 31);

test('deletes the data of players not seen for 30 days, and keeps the rest', async () => {
  await redis.set('run:t2_gone', 'x');
  await remember('t2_gone', 'run:t2_gone');
  await markSeen('t2_gone', NOW - 31 * DAY_MS);
  await redis.set('run:t2_here', 'x');
  await remember('t2_here', 'run:t2_here');
  await markSeen('t2_here', NOW - 29 * DAY_MS);

  expect(await deleteIdleUsers(NOW)).toBe(1);

  expect(await redis.get('run:t2_gone')).toBeUndefined();
  expect(await redis.hKeys('user:t2_gone')).toEqual([]);
  expect(await redis.zScore('users:seen', 't2_gone')).toBeUndefined();
  expect(await redis.get('run:t2_here')).toBe('x');
  expect(await deleteIdleUsers(NOW)).toBe(0);
});

test('knows which modes a player has played before', async () => {
  expect(await hasPlayed('t2_new', 'classic')).toBe(false);
  await remember('t2_new', 'run:t2_new:2026-11-25:classic');
  await remember('t2_new', 'vote:t2_new:classic');
  expect(await hasPlayed('t2_new', 'classic')).toBe(true);
  expect(await hasPlayed('t2_new', 'expedition')).toBe(false);
});
