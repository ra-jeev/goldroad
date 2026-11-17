import { context } from '@devvit/web/server';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type {
  ErrorResponse,
  FinishResponse,
  HintResponse,
  RoadMode,
  RoadResponse,
  StartResponse,
} from '../../shared/api';
import { utcDay } from '../core/day';
import { dayForPost } from '../core/post';
import { getGoldRoutes, getOrCreateRoad } from '../core/road';
import { finishTry, getRun, guestHint, RunError, startTry, useHint } from '../core/runs';

export const api = new Hono();

const ModeSchema = z.enum(['classic', 'expedition']);
const ModeBody = z.object({ mode: ModeSchema });
const Route = z.array(z.number().int().min(0).max(99)).min(1).max(100);
const RouteBody = z.object({ mode: ModeSchema, path: Route, guide: Route.optional() });

/** The road day for this post. Daily posts keep their own day for ever. */
async function postDay(): Promise<string> {
  const { postId } = context;
  if (!postId) throw new RunError(400, 'No post in context');
  // A post that this app did not create (for example a playtest post) shows
  // today's road.
  return (await dayForPost(postId)) ?? utcDay();
}

function fail(c: Context, error: unknown) {
  if (error instanceof RunError) return c.json<ErrorResponse>({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return c.json<ErrorResponse>({ error: 'Bad request' }, 400);
  throw error;
}

api.get('/road', async (c) => {
  try {
    const mode: RoadMode = ModeSchema.catch('classic').parse(c.req.query('mode'));
    const day = await postDay();
    const road = await getOrCreateRoad(day, mode);
    const { userId } = context;
    return c.json<RoadResponse>({
      road,
      username: context.username ?? null,
      run: userId ? await getRun(userId, day, mode) : null,
    });
  } catch (error) {
    return fail(c, error);
  }
});

api.post('/start', async (c) => {
  try {
    const { mode } = ModeBody.parse(await c.req.json());
    const { userId } = context;
    const day = await postDay();
    return c.json<StartResponse>({ run: userId ? await startTry(userId, day, mode) : null });
  } catch (error) {
    return fail(c, error);
  }
});

api.post('/hint', async (c) => {
  try {
    const { mode, path, guide } = RouteBody.parse(await c.req.json());
    const day = await postDay();
    const road = await getOrCreateRoad(day, mode);
    const gold = await getGoldRoutes(day, mode);
    if (!gold?.length) throw new Error(`No gold routes for ${day} ${mode}`);
    const { userId } = context;
    if (!userId) {
      return c.json<HintResponse>({ hint: guestHint(road, gold, path, guide ?? []), run: null });
    }
    return c.json<HintResponse>(await useHint(userId, day, mode, road, gold, path));
  } catch (error) {
    return fail(c, error);
  }
});

api.post('/finish', async (c) => {
  try {
    const { mode, path } = RouteBody.parse(await c.req.json());
    const day = await postDay();
    const road = await getOrCreateRoad(day, mode);
    const result = await finishTry(context.userId ?? null, day, mode, road, path);
    return c.json<FinishResponse>(result);
  } catch (error) {
    return fail(c, error);
  }
});
