import { context } from '@devvit/web/server';
import { Hono } from 'hono';
import type { ErrorResponse, RoadResponse } from '../../shared/api';
import { utcDay } from '../core/day';
import { dayForPost } from '../core/post';
import { getOrCreateRoad } from '../core/road';

export const api = new Hono();

api.get('/road', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ error: 'No post in context' }, 400);

  // A post that this app did not create (for example a playtest post) shows
  // today's road. Daily posts keep their own day for ever.
  const day = (await dayForPost(postId)) ?? utcDay();
  const road = await getOrCreateRoad(day, 'classic');
  return c.json<RoadResponse>({ road, username: context.username ?? null });
});
