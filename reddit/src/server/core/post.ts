import { context, reddit, redis } from '@devvit/web/server';
import type { RoadPostData } from '../../shared/api';
import { ensureResultsThread } from './comments';
import { shortDayLabel, utcDay } from './day';
import { flairDailyPost } from './flair';
import { communityPick } from './community';
import { getOrCreateRoad } from './road';

/** Day → post id, so the daily job never posts twice. */
const dayPostKey = (day: string) => `post:day:${day}`;
/** Post id → day, so a post always shows its own road, for ever. */
const postDayKey = (postId: string) => `post:${postId}`;
/** Held while one caller creates a day's post, so two callers never both post. */
const postLockKey = (day: string) => `post:lock:${day}`;

export class PostBusyError extends Error {
  constructor() {
    super("Today's post is being created. Try again in a moment.");
  }
}

export type DailyPostResult = { postId: string; created: boolean };

/**
 * Create the post for a day, unless it exists. Safe to call twice: the
 * scheduler, the install trigger and the mod menu all call it.
 */
export async function ensureDailyPost(
  day: string = utcDay(),
  { test = false }: { test?: boolean } = {},
): Promise<DailyPostResult> {
  const existing = await redis.get(dayPostKey(day));
  if (existing) return { postId: existing, created: false };

  // The scheduler and a moderator can both get here at once. Only the caller
  // that takes the lock posts. The lock ends by itself if that caller fails.
  const locked = await redis.set(postLockKey(day), '1', { nx: true, expiration: new Date(Date.now() + 120_000) });
  if (!locked) {
    const made = await redis.get(dayPostKey(day));
    if (made) return { postId: made, created: false };
    throw new PostBusyError();
  }
  try {
    return await createDailyPost(day, test);
  } finally {
    await redis.del(postLockKey(day));
  }
}

async function createDailyPost(day: string, test: boolean): Promise<DailyPostResult> {
  // A caller that held the lock before this one may have posted.
  const existing = await redis.get(dayPostKey(day));
  if (existing) return { postId: existing, created: false };

  const road = await getOrCreateRoad(day, 'classic');
  const pick = await communityPick(day);
  const { board } = road;
  const postData: RoadPostData = {
    day,
    roadNo: road.roadNo,
    target: road.target,
    rows: board.rows,
    cols: board.cols,
    tiles: board.tiles,
    start: board.start,
    end: board.end,
    ...(pick ? { community: pick.label } : {}),
  };
  const shape = pick ? ` · Community road: ${pick.label}` : '';

  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: test
      ? `GoldRoad test road${shape} · Target ${road.target}`
      : `GoldRoad #${road.roadNo}${shape} · Target ${road.target} · ${shortDayLabel(day)}`,
    entry: 'default',
    postData,
    textFallback: {
      text: `GoldRoad #${road.roadNo}. Walk from the footprints to the flag and land exactly on ${road.target}. Open this post in the Reddit app or on new Reddit to play.`,
    },
  });

  await redis.set(dayPostKey(day), post.id);
  await redis.set(postDayKey(post.id), day);
  if (test) return { postId: post.id, created: true };
  try {
    await flairDailyPost(post.id);
  } catch (error) {
    console.error(`could not flair the daily post: ${error}`);
  }
  try {
    await ensureResultsThread(post.id);
  } catch (error) {
    // The first shared result creates it later.
    console.error(`could not create the results comment: ${error}`);
  }
  return { postId: post.id, created: true };
}

/** The daily post of a day, if it was made. */
export async function dayPostId(day: string): Promise<string | null> {
  return (await redis.get(dayPostKey(day))) ?? null;
}

/** The day a post belongs to. Null for posts this app did not make. */
export async function dayForPost(postId: string): Promise<string | null> {
  return (await redis.get(postDayKey(postId))) ?? null;
}
