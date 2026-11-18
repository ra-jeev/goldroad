import { reddit, redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { afterEach, expect, vi } from 'vitest';
import { ensurePostFlairs, flairDailyPost, streakFlairText, updateStreakFlair } from './flair';
import { deleteUserData } from './userIndex';

const test = createDevvitTest();
afterEach(() => vi.restoreAllMocks());

type FakeUser = Awaited<ReturnType<typeof reddit.getUserByUsername>>;

function userWithFlair(flairText: string | undefined) {
  const user = { getUserFlairBySubreddit: vi.fn().mockResolvedValue(flairText ? { flairText } : undefined) };
  vi.spyOn(reddit, 'getUserByUsername').mockResolvedValue(user as unknown as FakeUser);
}

test('the flair text shows the streak, and the best when it is higher', () => {
  expect(streakFlairText(5, 5)).toBe('🔥 5-day road');
  expect(streakFlairText(2, 9)).toBe('🔥 2-day road · best 9');
});

test('an empty flair or one the app wrote is updated', async () => {
  const set = vi.spyOn(reddit, 'setUserFlair').mockResolvedValue(undefined);
  userWithFlair(undefined);
  await updateStreakFlair('t2_a', 'ann', 1, 1);
  userWithFlair('🔥 1-day road');
  await updateStreakFlair('t2_a', 'ann', 2, 2);

  expect(set).toHaveBeenCalledTimes(2);
  expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ username: 'ann', text: '🔥 2-day road' }));
});

test("a flair the player chose is never replaced", async () => {
  const set = vi.spyOn(reddit, 'setUserFlair').mockResolvedValue(undefined);
  userWithFlair('Puzzle fan');
  await updateStreakFlair('t2_a', 'ann', 3, 3);
  expect(set).not.toHaveBeenCalled();
});

test('a flair failure does not throw, and the flair key is removed with the user', async () => {
  vi.spyOn(reddit, 'setUserFlair').mockRejectedValueOnce(new Error('no mod rights'));
  userWithFlair(undefined);
  await expect(updateStreakFlair('t2_a', 'ann', 1, 1)).resolves.toBeUndefined();

  vi.spyOn(reddit, 'setUserFlair').mockResolvedValue(undefined);
  await updateStreakFlair('t2_a', 'ann', 1, 1);
  expect(await redis.get('flair:t2_a')).toBe('🔥 1-day road');
  await deleteUserData('t2_a');
  expect(await redis.get('flair:t2_a')).toBeUndefined();
});

test('post flairs are made once, and the daily post gets "Daily road"', async () => {
  const templates: { id: string; text: string }[] = [{ id: 'f_bug', text: 'Bug' }];
  vi.spyOn(reddit, 'getPostFlairTemplates').mockImplementation(async () => templates as never);
  const create = vi.spyOn(reddit, 'createPostFlairTemplate').mockImplementation(async (options) => {
    const template = { id: `f_${templates.length}`, text: options.text };
    templates.push(template);
    return template as never;
  });
  const set = vi.spyOn(reddit, 'setPostFlair').mockResolvedValue(undefined);

  const dailyId = await ensurePostFlairs();
  await ensurePostFlairs();
  expect(create).toHaveBeenCalledTimes(2);
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ text: 'Daily road', modOnly: true }));

  await flairDailyPost('t3_post');
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ postId: 't3_post', flairTemplateId: dailyId }));
});

test('a deleted "Daily road" template is made again', async () => {
  await redis.set('flair:post:daily', 'f_gone');
  vi.spyOn(reddit, 'getPostFlairTemplates').mockResolvedValue([]);
  vi.spyOn(reddit, 'createPostFlairTemplate').mockImplementation(
    async (options) => ({ id: `f_${options.text}`, text: options.text }) as never,
  );
  const set = vi
    .spyOn(reddit, 'setPostFlair')
    .mockRejectedValueOnce(new Error('no such template'))
    .mockResolvedValue(undefined);

  await flairDailyPost('t3_post');
  expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ flairTemplateId: 'f_Daily road' }));
});
