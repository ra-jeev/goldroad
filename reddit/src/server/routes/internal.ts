import type { TaskResponse } from '@devvit/web/server';
import type { TriggerResponse, UiResponse } from '@devvit/web/shared';
import { Hono } from 'hono';
import { ensurePostFlairs } from '../core/flair';
import { ensureDailyPost, PostBusyError } from '../core/post';
import { fillRoadBuffer } from '../core/roadBuffer';
import { sendStreakReminders } from '../core/reminders';
import { dayPostId } from '../core/post';
import { utcDay } from '../core/day';
import { notifications } from '@devvit/web/server';
import { COMMUNITY_OPTIONS } from '../core/community';
import { createTestRoadPost } from '../core/testRoad';
import type { CommunityOptionId } from '../../shared/api';
import { context } from '@devvit/web/server';

import { DEV_SUBREDDIT as TEST_SUBREDDIT } from '../core/devSubreddit';
import { deleteIdleUsers, deleteUserData, IDLE_DAYS } from '../core/userIndex';
import { reddit } from '@devvit/web/server';

export const internal = new Hono();

/** 00:00 UTC every day (devvit.json). Creates the day's post once. */
internal.post('/scheduler/daily-road', async (c) => {
  const result = await ensureDailyPost();
  console.log(`daily-road: ${result.created ? 'created' : 'kept'} ${result.postId}`);
  await logBuffer('daily-road');
  return c.json<TaskResponse>({}, 200);
});

/** Top up the road buffer and log what it did. Never fails the job. */
async function logBuffer(job: string) {
  try {
    const { made, waiting, ready } = await fillRoadBuffer();
    console.log(`${job}: made ${made.join(', ') || 'nothing'}; ${ready} roads ready; waiting for votes: ${waiting.join(', ') || 'none'}`);
  } catch (error) {
    console.error(`${job}: could not fill the road buffer: ${error}`);
  }
}

/**
 * 23:30 UTC every day (devvit.json). Keeps ROAD_BUFFER_DAYS of roads ready,
 * so the 00:00 post only reads one. 23:30 on Saturday is also when Sunday's
 * vote closes and its road is made. If a road is missing, the 00:00 post
 * makes it itself.
 */
internal.post('/scheduler/next-road', async (c) => {
  await logBuffer('next-road');
  return c.json<TaskResponse>({}, 200);
});

/**
 * Every 30 minutes, at :05 and :35 (devvit.json): players for whom it is now
 * 7 PM. Five minutes late, so the 00:00 daily post exists when the 00:00 slot
 * runs.
 */
internal.post('/scheduler/streak-reminder', async (c) => {
  try {
    const run = await sendStreakReminders();
    if (run.sent || run.failed || run.skipped) {
      console.log(`streak-reminder ${run.slot}: sent ${run.sent}, failed ${run.failed}${run.skipped ? `, skipped: ${run.skipped}` : ''}`);
    }
  } catch (error) {
    console.error(`streak-reminder failed: ${error}`);
  }
  return c.json<TaskResponse>({}, 200);
});

/** 03:15 UTC every day (devvit.json). Deletes the data of players gone 30 days. */
internal.post('/scheduler/delete-idle', async (c) => {
  try {
    const deleted = await deleteIdleUsers();
    if (deleted) console.log(`delete-idle: deleted the data of ${deleted} players`);
  } catch (error) {
    console.error(`delete-idle failed: ${error}`);
  }
  return c.json<TaskResponse>({}, 200);
});

/**
 * Moderator menu: delete one player's GoldRoad data, for a removal request.
 * Takes a username, or a t2_ id for an account that no longer exists.
 */
internal.post('/menu/delete-player', async (c) =>
  c.json<UiResponse>({
    showForm: {
      name: 'deletePlayer',
      form: {
        title: "Delete a player's GoldRoad data",
        description: `Removes their tries, solves, streak, leaderboard entries, votes and reminders. This cannot be undone. Players who do not come back for ${IDLE_DAYS} days are deleted on their own.`,
        acceptLabel: 'Delete',
        fields: [{ type: 'string', name: 'player', label: 'Username or t2_ id', required: true }],
      },
    },
  }),
);

internal.post('/form/delete-player', async (c) => {
  const { player } = (await c.req.json()) as { player?: string };
  const name = (player ?? '').trim().replace(/^\/?u\//, '');
  if (!name) return c.json<UiResponse>({ showToast: 'Give a username or a t2_ id.' });
  try {
    let userId: string | undefined = /^t2_[a-z0-9]+$/i.test(name) ? name : undefined;
    if (!userId) userId = (await reddit.getUserByUsername(name))?.id;
    if (!userId) return c.json<UiResponse>({ showToast: `No account u/${name}. For a deleted account, give its t2_ id.` });
    await deleteUserData(userId);
    console.log(`delete-player: deleted the data of ${userId}`);
    return c.json<UiResponse>({ showToast: 'Player data deleted.' });
  } catch (error) {
    console.error(`delete-player failed: ${error}`);
    return c.json<UiResponse>({ showToast: 'Could not delete the player data.' }, 400);
  }
});

/** A moderator can post today's road by hand, for example after install. */
internal.post('/menu/post-today', async (c) => {
  try {
    const result = await ensureDailyPost();
    return c.json<UiResponse>({
      showToast: result.created ? "Today's road is posted." : "Today's road was already posted.",
      navigateTo: `https://reddit.com/comments/${result.postId}`,
    });
  } catch (error) {
    if (error instanceof PostBusyError) return c.json<UiResponse>({ showToast: error.message });
    console.error(`post-today failed: ${error}`);
    return c.json<UiResponse>({ showToast: "Could not post today's road." }, 400);
  }
});

/** Moderator menu: pick a Sunday vote option, then post a test road for it. */
internal.post('/menu/test-road', async (c) => {
  if (context.subredditName !== TEST_SUBREDDIT) {
    return c.json<UiResponse>({ showToast: `Test roads work only in r/${TEST_SUBREDDIT}.` });
  }
  return c.json<UiResponse>({
    showForm: {
      name: 'testRoad',
      form: {
        title: 'Post a test Sunday road',
        acceptLabel: 'Post',
        fields: [
          {
            type: 'select',
            name: 'option',
            label: 'Vote option',
            required: true,
            options: COMMUNITY_OPTIONS.map((option) => ({ label: `${option.label}: ${option.blurb}`, value: option.id })),
          },
        ],
      },
    },
  });
});

internal.post('/form/test-road', async (c) => {
  if (context.subredditName !== TEST_SUBREDDIT) {
    return c.json<UiResponse>({ showToast: `Test roads work only in r/${TEST_SUBREDDIT}.` });
  }
  try {
    const { option } = (await c.req.json()) as { option?: string[] | string };
    const id = (Array.isArray(option) ? option[0] : option) as CommunityOptionId;
    const postId = await createTestRoadPost(id);
    return c.json<UiResponse>({ showToast: 'Test road posted.', navigateTo: `https://reddit.com/comments/${postId}` });
  } catch (error) {
    console.error(`test-road failed: ${error}`);
    return c.json<UiResponse>({ showToast: 'Could not post the test road.' }, 400);
  }
});

/**
 * Moderator menu, dev subreddit only: ask Reddit to show the app's game badge,
 * linking to today's post, so we can see what Reddit draws.
 */
internal.post('/menu/test-badge', async (c) => {
  if (context.subredditName !== TEST_SUBREDDIT) {
    return c.json<UiResponse>({ showToast: `The badge test works only in r/${TEST_SUBREDDIT}.` });
  }
  try {
    const postId = await dayPostId(utcDay());
    if (!postId) return c.json<UiResponse>({ showToast: 'There is no post for today yet.' });
    const result = await notifications.requestShowGameBadge({ post: postId as `t3_${string}` });
    const status = await notifications.getGameBadgeStatus();
    console.log(`test-badge: ${JSON.stringify(result)} status ${JSON.stringify(status)}`);
    const until = status.expiresAt ? ` until ${new Date(status.expiresAt).toISOString().slice(11, 16)} UTC` : '';
    return c.json<UiResponse>({
      showToast: result.success
        ? `Badge requested${status.hasActiveBadge ? `, active${until}` : ', but not active yet'}.`
        : `Badge refused: ${result.message ?? 'no reason given'}`,
    });
  } catch (error) {
    console.error(`test-badge failed: ${error}`);
    return c.json<UiResponse>({ showToast: `Badge failed: ${String(error).slice(0, 120)}` });
  }
});

internal.post('/triggers/on-app-install', async (c) => {
  try {
    await ensurePostFlairs();
  } catch (error) {
    console.error(`could not create post flairs: ${error}`);
  }
  try {
    const result = await ensureDailyPost();
    await logBuffer('on-app-install');
    return c.json<TriggerResponse>({ status: 'success', message: `Road post ${result.postId}` });
  } catch (error) {
    console.error(`on-app-install failed: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'Could not create road post' }, 400);
  }
});
