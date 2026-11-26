import { redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect } from 'vitest';
import { getOrCreateRoadNo } from './road';

const test = createDevvitTest();

test('first requests at the same time use one road number', async () => {
  const numbers = await Promise.all(Array.from({ length: 6 }, () => getOrCreateRoadNo('2026-11-26')));
  expect(new Set(numbers)).toEqual(new Set([1]));
  expect(await redis.get('roadno:count')).toBe('1');
  expect(await redis.expireTime('roadno:2026-11-26')).toBeLessThan(0);
});

test('days that start at the same time get numbers with no gaps', async () => {
  const days = ['2026-11-26', '2026-11-27', '2026-11-28'];
  const numbers = await Promise.all([...days, ...days].map((day) => getOrCreateRoadNo(day)));
  expect(numbers.slice(0, 3)).toEqual(numbers.slice(3));
  expect([...numbers.slice(0, 3)].sort()).toEqual([1, 2, 3]);
  expect(await redis.get('roadno:count')).toBe('3');
});

test('goes on from a count that incrBy wrote', async () => {
  await redis.incrBy('roadno:count', 4);
  expect(await getOrCreateRoadNo('2026-11-26')).toBe(5);
  expect(await getOrCreateRoadNo('2026-11-26')).toBe(5);
});

test('takes over a claim that its claimer left behind', async () => {
  await redis.set('roadno:2026-11-26', 'claim', { expiration: new Date(Date.now() + 200) });
  expect(await getOrCreateRoadNo('2026-11-26')).toBe(1);
  expect(await redis.get('roadno:count')).toBe('1');
});
