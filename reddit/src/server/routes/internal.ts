import type { TaskResponse } from '@devvit/web/server';
import type { TriggerResponse, UiResponse } from '@devvit/web/shared';
import { Hono } from 'hono';
import { ensureDailyPost } from '../core/post';

export const internal = new Hono();

/** 00:00 UTC every day (devvit.json). Creates the day's post once. */
internal.post('/scheduler/daily-road', async (c) => {
  const result = await ensureDailyPost();
  console.log(`daily-road: ${result.created ? 'created' : 'kept'} ${result.postId}`);
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
    const result = await ensureDailyPost();
    return c.json<TriggerResponse>({ status: 'success', message: `Road post ${result.postId}` });
  } catch (error) {
    console.error(`on-app-install failed: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'Could not create road post' }, 400);
  }
});
