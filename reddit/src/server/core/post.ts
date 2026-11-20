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

/** The day a post belongs to. Null for posts this app did not make. */
export async function dayForPost(postId: string): Promise<string | null> {
  return (await redis.get(postDayKey(postId))) ?? null;
}
