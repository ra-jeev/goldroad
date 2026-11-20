import { reddit } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { afterEach, expect, vi } from 'vitest';
import type { PlayerRun } from '../../shared/api';
import { ensureResultsThread, pinnedResultsThread, resultText, THREAD_TEXT } from './comments';
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
