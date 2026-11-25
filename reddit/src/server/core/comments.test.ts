import { reddit, redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { afterEach, expect, vi } from 'vitest';
import type { PlayerRun } from '../../shared/api';
import { ensureResultsThread, pinnedResultsThread, resultParent, resultText, THREAD_TEXT } from './comments';
import { claimComment, saveComment } from './runs';

const test = createDevvitTest();
afterEach(() => vi.restoreAllMocks());

function fakeComment(id: string) {
  const distinguish = vi.fn().mockResolvedValue(undefined);
  return { comment: { id, distinguish } as unknown as Awaited<ReturnType<typeof reddit.submitComment>>, distinguish };
}

test('the results comment is posted and pinned once per post', async () => {
  const { comment, distinguish } = fakeComment('t1_thread');
  const spy = vi.spyOn(reddit, 'submitComment').mockResolvedValue(comment);

  expect(await ensureResultsThread('t3_post')).toBe('t1_thread');
  expect(await ensureResultsThread('t3_post')).toBe('t1_thread');

  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith({ id: 't3_post', text: THREAD_TEXT, runAs: 'APP' });
  expect(distinguish).toHaveBeenCalledWith(true);
});

test('a results comment that could not be pinned is pinned on the next call', async () => {
  const { comment, distinguish } = fakeComment('t1_thread');
  distinguish.mockRejectedValueOnce(new Error('no pin'));
  vi.spyOn(reddit, 'submitComment').mockResolvedValue(comment);
  const getComment = vi.spyOn(reddit, 'getCommentById').mockResolvedValue(comment as never);

  expect(await ensureResultsThread('t3_post')).toBe('t1_thread');
  expect(await ensureResultsThread('t3_post')).toBe('t1_thread');
  expect(await ensureResultsThread('t3_post')).toBe('t1_thread');

  // One failed pin, one retry that works, then no more tries.
  expect(distinguish).toHaveBeenCalledTimes(2);
  expect(getComment).toHaveBeenCalledTimes(1);
});

test('no result goes under a results comment that is not pinned', async () => {
  const { comment, distinguish } = fakeComment('t1_thread');
  distinguish.mockRejectedValue(new Error('no pin'));
  vi.spyOn(reddit, 'submitComment').mockResolvedValue(comment);
  vi.spyOn(reddit, 'getCommentById').mockResolvedValue(comment as never);

  await expect(pinnedResultsThread('t3_post')).rejects.toThrow('Try again in a moment');

  distinguish.mockResolvedValue(undefined);
  expect(await pinnedResultsThread('t3_post')).toBe('t1_thread');
});

test('a share before the pin is confirmed does not go under the comment', async () => {
  // The daily job stored the comment id, but its pin has not been confirmed.
  await redis.set('thread:t3_post', 't1_thread');
  const { comment, distinguish } = fakeComment('t1_thread');
  distinguish.mockRejectedValueOnce(new Error('not yet'));
  vi.spyOn(reddit, 'getCommentById').mockResolvedValue(comment as never);

  await expect(pinnedResultsThread('t3_post')).rejects.toThrow('Try again in a moment');
  expect(await pinnedResultsThread('t3_post')).toBe('t1_thread');
});

test("an Expedition result replies to the player's own Classic result", async () => {
  const own = { id: 't1_mine', authorId: 't2_me', removed: false, spam: false, body: 'GoldRoad #1 · Classic' };
  vi.spyOn(reddit, 'getCommentById').mockResolvedValue(own as never);
  expect(await resultParent('t3_post', 't1_mine', 't2_me')).toBe('t1_mine');
});

test('with no usable Classic result, an Expedition result goes under the pinned comment', async () => {
  await redis.set('thread:t3_post', 't1_thread');
  await redis.set('thread:t3_post:pinned', '1');
  const removed = { id: 't1_mine', authorId: 't2_me', removed: true, spam: false, body: 'x' };
  vi.spyOn(reddit, 'getCommentById').mockResolvedValue(removed as never);
  expect(await resultParent('t3_post', 't1_mine', 't2_me')).toBe('t1_thread');
  expect(await resultParent('t3_post', null, 't2_me')).toBe('t1_thread');
});

test('a failed post leaves no claim behind', async () => {
  vi.spyOn(reddit, 'submitComment').mockRejectedValueOnce(new Error('down'));
  await expect(ensureResultsThread('t3_post')).rejects.toThrow('down');

  vi.spyOn(reddit, 'submitComment').mockResolvedValue(fakeComment('t1_next').comment);
  expect(await ensureResultsThread('t3_post')).toBe('t1_next');
});

test('the result text has the medal, tries, hints and time, and no route', () => {
  const run: PlayerRun = {
    attempts: 1,
    hintsUsed: 0,
    hintsLeft: 5,
    guidePath: [0, 3, 6],
    solved: true,
    solvedAttempt: 1,
    medal: 'gold',
    solveSeconds: 102,
    commented: false,
  };
  expect(resultText(97, 'classic', run)).toBe('GoldRoad #97 · Classic\n\n🥇 Gold in 1 try · 0 hints · 1:42');
  expect(resultText(97, 'classic', { ...run, solvedAttempt: 4, medal: null, hintsUsed: 1 })).toBe(
    'GoldRoad #97 · Classic\n\n✨ Solved in 4 tries · 1 hint · 1:42',
  );
});

test('a player can post one result per road and mode', async () => {
  expect(await claimComment('t2_me', '2026-11-24', 'classic')).toBe(true);
  expect(await claimComment('t2_me', '2026-11-24', 'classic')).toBe(false);
  // A failed post gives the chance back.
  await saveComment('t2_me', '2026-11-24', 'classic', null);
  expect(await claimComment('t2_me', '2026-11-24', 'classic')).toBe(true);
  expect(await claimComment('t2_me', '2026-11-24', 'expedition')).toBe(true);
});
