import { notifications, redis } from '@devvit/web/server';
import type { ReminderState } from '../../shared/api';
import { dayEndMs, utcDay } from './day';
import { dayPostId } from './post';
import { streakAtRisk } from './standing';
import { remember } from './userIndex';

/**
 * Streak reminders. A player opts in from the app (Reddit's own push
 * notification opt-in). At 7 PM in the player's own time zone, a player whose
 * streak is at risk (yesterday's Classic road solved, today's not yet) gets
 * one notification that opens today's post.
 *
 * Every road lasts exactly 24 hours, so a player's 7 PM falls inside each road
 * once, whatever the time zone. The app stores the player's UTC offset and
 * refreshes it on each visit, so summer time and travel stay right.
 */
const ON_KEY = 'remind:on'; // userId → UTC offset in minutes
const ASKED_KEY = 'remind:asked';
/** Players whose 7 PM falls in one UTC half-hour: userId → '1'. */
const slotKey = (slot: number) => `remind:slot:${slot}`;
/** Who got today's reminder, so a re-run never sends twice. */
const sentKey = (day: string) => `remind:sent:${day}`;

const LOCAL_SEND_MINUTE = 19 * 60;
const SLOT_MINUTES = 30;
const DAY_MINUTES = 24 * 60;
/** Reddit takes at most 1000 recipients in one call. */
const BATCH = 1000;

/** UTC offsets run from -12:00 to +14:00. */
function validOffset(offset: number): boolean {
  return Number.isInteger(offset) && offset >= -12 * 60 && offset <= 14 * 60;
}

/** The UTC half-hour (minutes after 00:00 UTC) when it is 7 PM at this offset. */
export function slotFor(offset: number): number {
  const minute = (((LOCAL_SEND_MINUTE - offset) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return minute - (minute % SLOT_MINUTES);
}

export async function getReminderState(userId: string): Promise<ReminderState> {
  const [stored, asked] = await Promise.all([redis.hGet(ON_KEY, userId), redis.hGet(ASKED_KEY, userId)]);
  return { on: stored !== undefined, asked: asked === '1', offset: stored === undefined ? null : Number(stored) };
}

async function placeInSlot(userId: string, offset: number) {
  const previous = await redis.hGet(ON_KEY, userId);
  if (previous !== undefined) await redis.hDel(slotKey(slotFor(Number(previous))), [userId]);
  const slot = slotKey(slotFor(offset));
  await redis.hSet(ON_KEY, { [userId]: String(offset) });
  await redis.hSet(slot, { [userId]: '1' });
  await remember(userId, ON_KEY, 'field');
  await remember(userId, slot, 'field');
}

/** The player said yes or no. Either way, the app does not ask again. */
export async function setReminder(userId: string, on: boolean, offset = 0): Promise<ReminderState> {
  if (on) {
    if (!validOffset(offset)) throw new Error(`Bad UTC offset ${offset}`);
    const result = await notifications.optInCurrentUser();
    if (!result.success) throw new Error(result.message ?? 'Opt-in failed');
    await placeInSlot(userId, offset);
  } else {
    await notifications.optOutCurrentUser().catch((error) => console.error(`opt-out failed: ${error}`));
    const previous = await redis.hGet(ON_KEY, userId);
    if (previous !== undefined) await redis.hDel(slotKey(slotFor(Number(previous))), [userId]);
    await redis.hDel(ON_KEY, [userId]);
  }
  await markAsked(userId);
  return getReminderState(userId);
}

/** The app saw a new UTC offset (summer time, travel): move the player's slot. */
export async function updateOffset(userId: string, offset: number): Promise<ReminderState> {
  if (!validOffset(offset)) throw new Error(`Bad UTC offset ${offset}`);
  const state = await getReminderState(userId);
  if (state.on && state.offset !== offset) await placeInSlot(userId, offset);
  return getReminderState(userId);
}

export async function markAsked(userId: string): Promise<void> {
  await redis.hSet(ASKED_KEY, { [userId]: '1' });
  await remember(userId, ASKED_KEY, 'field');
}

export type ReminderRun = { slot: number; sent: number; failed: number; skipped: string | null };

/** Send the reminders for the half-hour that `now` falls in. Runs every 30 minutes. */
export async function sendStreakReminders(now: number = Date.now()): Promise<ReminderRun> {
  const date = new Date(now);
  const minute = date.getUTCHours() * 60 + date.getUTCMinutes();
  const slot = minute - (minute % SLOT_MINUTES);
  const run: ReminderRun = { slot, sent: 0, failed: 0, skipped: null };

  const today = utcDay(date);
  const postId = await dayPostId(today);
  if (!postId) return { ...run, skipped: 'no post today' };
  const hours = String(Math.max(1, Math.round((dayEndMs(today) - now) / 3_600_000)));

  const recipients: { userId: `t2_${string}`; link: `t3_${string}`; data: { streak: string; hours: string } }[] = [];
  for (const userId of Object.keys(await redis.hGetAll(slotKey(slot)))) {
    const streak = await streakAtRisk(userId, today);
    if (streak < 1) continue;
    if (!(await redis.hSetNX(sentKey(today), userId, '1'))) continue;
    recipients.push({
      userId: userId as `t2_${string}`,
      link: postId as `t3_${string}`,
      data: { streak: String(streak), hours },
    });
  }
  await redis.expire(sentKey(today), 2 * 24 * 60 * 60);

  for (let i = 0; i < recipients.length; i += BATCH) {
    const response = await notifications.enqueue({
      title: '🔥 Keep your road going',
      body: 'Your {{streak}}-day road ends in {{hours}} hours. Walk today’s GoldRoad to keep it.',
      recipients: recipients.slice(i, i + BATCH),
    });
    run.sent += response.successCount;
    run.failed += response.failureCount;
    for (const error of response.errors) console.error(`reminder to ${error.userId}: ${error.message}`);
  }
  return run;
}
