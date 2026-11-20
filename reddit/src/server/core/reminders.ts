import { notifications, redis } from '@devvit/web/server';
import type { ReminderState } from '../../shared/api';
import { utcDay } from './day';
import { dayPostId } from './post';
import { streakAtRisk } from './standing';
import { remember } from './userIndex';

/**
 * Streak reminders. A player opts in from the app (Reddit's own push
 * notification opt-in). Each evening, a player whose streak ends at midnight
 * UTC, because today's Classic road is not solved yet, gets one notification
 * that opens today's post.
 */
const ON_KEY = 'remind:on';
const ASKED_KEY = 'remind:asked';
/** Reddit takes at most 1000 recipients in one call. */
const BATCH = 1000;

export async function getReminderState(userId: string): Promise<ReminderState> {
  const [on, asked] = await Promise.all([redis.hGet(ON_KEY, userId), redis.hGet(ASKED_KEY, userId)]);
  return { on: on === '1', asked: asked === '1' };
}

/** The player said yes or no. Either way, the app does not ask again. */
export async function setReminder(userId: string, on: boolean): Promise<ReminderState> {
  if (on) {
    const result = await notifications.optInCurrentUser();
    if (!result.success) throw new Error(result.message ?? 'Opt-in failed');
    await redis.hSet(ON_KEY, { [userId]: '1' });
    await remember(userId, ON_KEY, 'field');
  } else {
    await notifications.optOutCurrentUser().catch((error) => console.error(`opt-out failed: ${error}`));
    await redis.hDel(ON_KEY, [userId]);
  }
  await markAsked(userId);
  return getReminderState(userId);
}

export async function markAsked(userId: string): Promise<void> {
  await redis.hSet(ASKED_KEY, { [userId]: '1' });
  await remember(userId, ASKED_KEY, 'field');
}

export type ReminderRun = { sent: number; failed: number; skipped: string | null };

/** Send tonight's reminders. Safe to run twice: a day is sent only once. */
export async function sendStreakReminders(today: string = utcDay()): Promise<ReminderRun> {
  const claimed = await redis.set(`remind:sent:${today}`, '1', { nx: true });
  if (!claimed) return { sent: 0, failed: 0, skipped: 'already sent today' };
  const postId = await dayPostId(today);
  if (!postId) return { sent: 0, failed: 0, skipped: 'no post today' };

  const optedIn = Object.keys(await redis.hGetAll(ON_KEY));
  const recipients: { userId: `t2_${string}`; link: `t3_${string}`; data: { streak: string } }[] = [];
  for (const userId of optedIn) {
    const streak = await streakAtRisk(userId, today);
    if (streak > 0) {
      recipients.push({ userId: userId as `t2_${string}`, link: postId as `t3_${string}`, data: { streak: String(streak) } });
    }
  }

  const run: ReminderRun = { sent: 0, failed: 0, skipped: null };
  for (let i = 0; i < recipients.length; i += BATCH) {
    const response = await notifications.enqueue({
      title: '🔥 Keep your road going',
      // Sent at 20:00 UTC, so this is right in every time zone.
      body: 'Your {{streak}}-day road ends in 4 hours. Walk today’s GoldRoad to keep it.',
      recipients: recipients.slice(i, i + BATCH),
    });
    run.sent += response.successCount;
    run.failed += response.failureCount;
    for (const error of response.errors) console.error(`reminder to ${error.userId}: ${error.message}`);
  }
  return run;
}
