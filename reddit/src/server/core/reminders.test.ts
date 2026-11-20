import { notifications, redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { afterEach, expect, vi } from 'vitest';
import { getReminderState, markAsked, sendStreakReminders, setReminder } from './reminders';
import { deleteUserData } from './userIndex';

const test = createDevvitTest();
afterEach(() => vi.restoreAllMocks());

const TODAY = '2026-11-25';

async function streak(userId: string, lastDay: string, days: number) {
  await redis.hSet(`stats:${userId}`, { lastDay, streak: String(days), best: String(days) });
}

function fakeNotifications() {
  vi.spyOn(notifications, 'optInCurrentUser').mockResolvedValue({ success: true });
  vi.spyOn(notifications, 'optOutCurrentUser').mockResolvedValue({ success: true });
  return vi
    .spyOn(notifications, 'enqueue')
    .mockImplementation(async (options) => ({ successCount: options.recipients.length, failureCount: 0, errors: [] }));
}

test('a yes or a no is remembered, and the app asks only once', async () => {
  fakeNotifications();
  expect(await getReminderState('t2_a')).toEqual({ on: false, asked: false });
  expect(await setReminder('t2_a', true)).toEqual({ on: true, asked: true });
  expect(await setReminder('t2_a', false)).toEqual({ on: false, asked: true });
  await markAsked('t2_b');
  expect(await getReminderState('t2_b')).toEqual({ on: false, asked: true });
});

test('only opted-in players whose streak ends tonight get a reminder, once a day', async () => {
  const enqueue = fakeNotifications();
  await redis.set(`post:day:${TODAY}`, 't3_today');
  for (const user of ['t2_risk', 't2_done', 't2_broken', 't2_quiet']) await setReminder(user, true);
  await redis.hDel('remind:on', ['t2_quiet']);
  await streak('t2_risk', '2026-11-24', 4); // solved yesterday, not today
  await streak('t2_done', TODAY, 5); // already solved today
  await streak('t2_broken', '2026-11-20', 9); // streak already gone
  await streak('t2_quiet', '2026-11-24', 2); // turned reminders off

  expect(await sendStreakReminders(TODAY)).toEqual({ sent: 1, failed: 0, skipped: null });
  expect(enqueue).toHaveBeenCalledTimes(1);
  expect(enqueue.mock.calls[0]![0].recipients).toEqual([
    { userId: 't2_risk', link: 't3_today', data: { streak: '4' } },
  ]);
  expect((await sendStreakReminders(TODAY)).skipped).toBe('already sent today');
});

test('a deleted account leaves the reminder list', async () => {
  fakeNotifications();
  await setReminder('t2_a', true);
  await deleteUserData('t2_a');
  expect(await getReminderState('t2_a')).toEqual({ on: false, asked: false });
});
