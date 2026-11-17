import { context, reddit, redis } from '@devvit/web/server';
import type { RoadPostData } from '../../shared/api';
import { shortDayLabel, utcDay } from './day';
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
export async function ensureDailyPost(day: string = utcDay()): Promise<DailyPostResult> {
  const existing = await redis.get(dayPostKey(day));
  if (existing) return { postId: existing, created: false };

  const road = await getOrCreateRoad(day, 'classic');
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
  };

  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: `GoldRoad #${road.roadNo} · Target ${road.target} · ${shortDayLabel(day)}`,
    entry: 'default',
    postData,
    textFallback: {
      text: `GoldRoad #${road.roadNo}. Walk from the footprints to the flag and land exactly on ${road.target}. Open this post in the Reddit app or on new Reddit to play.`,
    },
  });

  await redis.set(dayPostKey(day), post.id);
  await redis.set(postDayKey(post.id), day);
  return { postId: post.id, created: true };
}

/** The day a post belongs to. Null for posts this app did not make. */
export async function dayForPost(postId: string): Promise<string | null> {
  return (await redis.get(postDayKey(postId))) ?? null;
}
