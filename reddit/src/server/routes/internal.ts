import type { TaskResponse } from '@devvit/web/server';
import type { TriggerResponse, UiResponse } from '@devvit/web/shared';
import { Hono } from 'hono';
import { ensurePostFlairs } from '../core/flair';
import { nextDay, utcDay } from '../core/day';
import { ensureDailyPost } from '../core/post';
import { prepareRoad } from '../core/road';

export const internal = new Hono();

/** 00:00 UTC every day (devvit.json). Creates the day's post once. */
internal.post('/scheduler/daily-road', async (c) => {
  const result = await ensureDailyPost();
  console.log(`daily-road: ${result.created ? 'created' : 'kept'} ${result.postId}`);
  return c.json<TaskResponse>({}, 200);
});

/**
 * 23:30 UTC every day (devvit.json). Makes tomorrow's road now, so the 00:00
 * post only reads it. If this fails, the 00:00 post makes the road itself.
 */
internal.post('/scheduler/next-road', async (c) => {
  const day = nextDay(utcDay());
  for (const mode of ['classic', 'expedition'] as const) {
    try {
      await prepareRoad(day, mode);
      console.log(`next-road: ${mode} ready for ${day}`);
    } catch (error) {
      console.error(`next-road: could not make ${mode} for ${day}: ${error}`);
    }
  }
  return c.json<TaskResponse>({}, 200);
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
    console.error(`post-today failed: ${error}`);
    return c.json<UiResponse>({ showToast: "Could not post today's road." }, 400);
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
    return c.json<TriggerResponse>({ status: 'success', message: `Road post ${result.postId}` });
  } catch (error) {
    console.error(`on-app-install failed: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'Could not create road post' }, 400);
  }
});
