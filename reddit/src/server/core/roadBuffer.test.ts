import { redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect } from 'vitest';
import { castVote, communityPick } from './community';
import { fillRoadBuffer } from './roadBuffer';

const test = createDevvitTest();

// 2026-11-25 is a Wednesday; 2026-11-29 is a Sunday.
const WED_NOON = Date.parse('2026-11-25T12:00:00Z');
const SAT_2330 = Date.parse('2026-11-28T23:30:00Z');

test('keeps five days ready, but a Sunday waits for its vote', async () => {
  await castVote('t2_a', 'maze', '2026-11-25');
  const first = await fillRoadBuffer(WED_NOON);

  // Thu, Fri, Sat and Mon are made; Sunday waits.
  expect(first.waiting).toEqual(['2026-11-29']);
  expect(first.ready).toBe(8);
  expect(await redis.get('road:2026-11-29:classic')).toBeUndefined();
  expect(await redis.get('road:2026-11-30:expedition')).toBeDefined();
  // Nothing fixed the Sunday pick early.
  expect(await redis.get('community:2026-11-29')).toBeUndefined();

  // A second run makes nothing new.
  expect((await fillRoadBuffer(WED_NOON)).made).toEqual([]);

  // Saturday 23:30: the vote closes and Sunday's road is made with the winner.
  const saturday = await fillRoadBuffer(SAT_2330);
  expect(saturday.waiting).toEqual([]);
  expect(saturday.made).toContain('2026-11-29:classic');
  expect(await communityPick('2026-11-29')).toMatchObject({ id: 'maze' });
}, 120_000);
