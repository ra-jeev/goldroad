import { notifications, redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { afterEach, expect, vi } from 'vitest';
import { getReminderState, markAsked, sendStreakReminders, setReminder, slotFor, updateOffset } from './reminders';
import { deleteUserData } from './userIndex';

const test = createDevvitTest();
afterEach(() => vi.restoreAllMocks());

const TODAY = '2026-11-25';
const IST = 330; // India, UTC+5:30
const NEW_YORK = -300; // UTC-5
const at = (time: string) => Date.parse(`${TODAY}T${time}:00Z`);

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

test('7 PM local maps to the right UTC half-hour', () => {
  expect(slotFor(0)).toBe(19 * 60);
  expect(slotFor(IST)).toBe(13 * 60 + 30); // 7 PM in India is 13:30 UTC
  expect(slotFor(NEW_YORK)).toBe(0); // 7 PM in New York is 00:00 UTC
  expect(slotFor(-480)).toBe(3 * 60); // California: 03:00 UTC
  expect(slotFor(345)).toBe(13 * 60); // Nepal, UTC+5:45: 13:15 UTC, in the 13:00 slot
});

test('a yes or a no is remembered, and the app asks only once', async () => {
  fakeNotifications();
  expect(await getReminderState('t2_a')).toEqual({ on: false, asked: false, offset: null });
  expect(await setReminder('t2_a', true, IST)).toEqual({ on: true, asked: true, offset: IST });
  expect(await setReminder('t2_a', false)).toEqual({ on: false, asked: true, offset: null });
  await markAsked('t2_b');
  expect(await getReminderState('t2_b')).toEqual({ on: false, asked: true, offset: null });
});

test('each player gets one reminder at their own 7 PM, only when the streak is at risk', async () => {
  const enqueue = fakeNotifications();
  await redis.set(`post:day:${TODAY}`, 't3_today');
  await setReminder('t2_india', true, IST);
  await setReminder('t2_india_done', true, IST);
  await setReminder('t2_ny', true, NEW_YORK);
  await streak('t2_india', '2026-11-24', 4);
  await streak('t2_india_done', TODAY, 5);
  await streak('t2_ny', '2026-11-24', 2);

  // 13:30 UTC: 7 PM in India. Only the at-risk Indian player; 10.5 hours left.
  expect(await sendStreakReminders(at('13:30'))).toMatchObject({ sent: 1 });
  expect(enqueue.mock.calls[0]![0].recipients).toEqual([
    { userId: 't2_india', link: 't3_today', data: { streak: '4', hours: '11' } },
  ]);
  // A second run in the same half-hour sends nothing.
  expect(await sendStreakReminders(at('13:45'))).toMatchObject({ sent: 0 });
  // 00:00 UTC, when today's road starts, is 7 PM the evening before in New York.
  expect(await sendStreakReminders(at('00:00'))).toMatchObject({ sent: 1 });
  expect(enqueue.mock.calls[1]![0].recipients).toEqual([
    { userId: 't2_ny', link: 't3_today', data: { streak: '2', hours: '24' } },
  ]);
});

test('a new offset moves the player to the new slot', async () => {
  const enqueue = fakeNotifications();
  await redis.set(`post:day:${TODAY}`, 't3_today');
  await setReminder('t2_a', true, 0);
  await streak('t2_a', '2026-11-24', 3);
  await updateOffset('t2_a', IST);
  expect(await sendStreakReminders(at('19:00'))).toMatchObject({ sent: 0 });
  expect(await sendStreakReminders(at('13:30'))).toMatchObject({ sent: 1 });
  expect(enqueue).toHaveBeenCalledTimes(1);
});

test('a deleted account leaves the reminder list and its slot', async () => {
  fakeNotifications();
  await setReminder('t2_a', true, IST);
  await deleteUserData('t2_a');
  expect(await getReminderState('t2_a')).toEqual({ on: false, asked: false, offset: null });
  expect(await redis.hGetAll(`remind:slot:${slotFor(IST)}`)).toEqual({});
});
