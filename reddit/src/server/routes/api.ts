import { context, reddit } from '@devvit/web/server';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type {
  CommentResponse,
  ErrorResponse,
  FinishResponse,
  HintResponse,
  RoadMode,
  RoadResponse,
  PlayerRun,
  StartResponse,
  Standing,
} from '../../shared/api';
import { utcDay } from '../core/day';
import { dayForPost } from '../core/post';
import { getGoldRoutes, getOrCreateRoad } from '../core/road';
import { ensureResultsThread, resultText, ThreadBusyError } from '../core/comments';
import {
  claimComment,
  finishTry,
  getRun,
  guestHint,
  isCounted,
  type Player,
  RunError,
  saveComment,
  startTry,
  useHint,
} from '../core/runs';
import { getHeat } from '../core/heat';
import { getStanding } from '../core/standing';

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

function player(): Player | null {
  const { userId, username } = context;
  return userId ? { id: userId, name: username ?? 'walker' } : null;
}

async function standingFor(day: string, mode: RoadMode, run: PlayerRun | null): Promise<Standing | null> {
  const { userId } = context;
  if (!userId || !run?.solved) return null;
  const [road, gold] = await Promise.all([getOrCreateRoad(day, mode), getGoldRoutes(day, mode)]);
  const heat = gold?.[0] ? await getHeat(day, mode, road.board.tiles.length, gold[0]) : null;
  return getStanding(userId, day, mode, await isCounted(userId, day, mode), utcDay(), heat);
}

function fail(c: Context, error: unknown) {
  if (error instanceof RunError) return c.json<ErrorResponse>({ error: error.message }, error.status);
  if (error instanceof ThreadBusyError) return c.json<ErrorResponse>({ error: error.message }, 409);
  if (error instanceof z.ZodError) return c.json<ErrorResponse>({ error: 'Bad request' }, 400);
  throw error;
}

api.get('/road', async (c) => {
  try {
    const mode: RoadMode = ModeSchema.catch('classic').parse(c.req.query('mode'));
    const day = await postDay();
    const road = await getOrCreateRoad(day, mode);
    const { userId } = context;
    const run = userId ? await getRun(userId, day, mode) : null;
    return c.json<RoadResponse>({
      road,
      username: context.username ?? null,
      run,
      standing: await standingFor(day, mode, run),
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
    const result = await finishTry(player(), day, mode, road, path);
    const standing = result.outcome === 'solved' ? await standingFor(day, mode, result.run) : null;
    return c.json<FinishResponse>({ ...result, standing });
  } catch (error) {
    return fail(c, error);
  }
});

/**
 * Post the player's result from their own account, as a reply to the pinned
 * results comment. The server writes the text from its own record, so a
 * comment can never claim a better result. One per road and mode.
 */
api.post('/comment', async (c) => {
  try {
    const { mode } = ModeBody.parse(await c.req.json());
    const { userId, postId } = context;
    if (!userId || !postId) throw new RunError(403, 'Log in to comment');
    const day = await postDay();
    const run = await getRun(userId, day, mode);
    if (!run.solved) throw new RunError(403, 'Solve the road first');
    if (!(await claimComment(userId, day, mode))) throw new RunError(429, 'Result already posted');

    try {
      const road = await getOrCreateRoad(day, mode);
      const threadId = await ensureResultsThread(postId);
      const comment = await reddit.submitComment({
        id: threadId as `t1_${string}`,
        text: resultText(road.roadNo, mode, run),
        runAs: 'USER',
      });
      await saveComment(userId, day, mode, comment.id);
      return c.json<CommentResponse>({ commentId: comment.id, run: { ...run, commented: true } });
    } catch (error) {
      await saveComment(userId, day, mode, null);
      throw error;
    }
  } catch (error) {
    return fail(c, error);
  }
});

/** Join the subreddit. Only ever on the player's own tap. */
api.post('/subscribe', async (c) => {
  try {
    if (!context.userId) throw new RunError(403, 'Log in to join');
    await reddit.subscribeToCurrentSubreddit();
    return c.json({ subscribed: true });
  } catch (error) {
    return fail(c, error);
  }
});
