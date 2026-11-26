import { redis } from '@devvit/web/server';

/**
 * Every key that holds data of one user, so a deleted account can be removed
 * in full. A "key" belongs to the user alone and is deleted. A "member" is a
 * shared leaderboard: only the user's entry is removed from it. A "field" is
 * a shared hash keyed by user id: only the user's field is removed.
 */
const indexKey = (userId: string) => `user:${userId}`;

export type IndexKind = 'key' | 'member' | 'field';

/** User id → the last time the user played or opened a road, in ms. */
const SEEN_KEY = 'users:seen';

/**
 * Devvit gives apps no event for a deleted account, so the data of a player
 * who has not come back for this long is deleted (the Devvit rules ask for 30
 * days). A deleted account never comes back, so its data goes in time.
 */
export const IDLE_DAYS = 30;
const IDLE_MS = IDLE_DAYS * 24 * 60 * 60 * 1000;

export async function remember(userId: string, key: string, kind: IndexKind = 'key'): Promise<void> {
  await redis.hSet(indexKey(userId), { [key]: kind });
  await markSeen(userId);
}

/**
 * True when the player has started this mode on any road before. The client
 * then skips the how-to-play guide, also on a new device or a new app
 * version, where the browser's own note of it is gone.
 */
export async function hasPlayed(userId: string, mode: 'classic' | 'expedition'): Promise<boolean> {
  const prefix = `run:${userId}:`;
  const suffix = `:${mode}`;
  return (await redis.hKeys(indexKey(userId))).some((key) => key.startsWith(prefix) && key.endsWith(suffix));
}

/** The player is here: their data is kept for another IDLE_DAYS. */
export async function markSeen(userId: string, now: number = Date.now()): Promise<void> {
  await redis.zAdd(SEEN_KEY, { member: userId, score: now });
}

/**
 * Delete the data of players not seen for IDLE_DAYS. Runs from a daily job,
 * in batches, and stops before the job's time runs out; the next run goes on.
 */
export async function deleteIdleUsers(now: number = Date.now(), budgetMs = 20_000): Promise<number> {
  const stopAt = Date.now() + budgetMs;
  let deleted = 0;
  while (Date.now() < stopAt) {
    const idle = await redis.zRange(SEEN_KEY, 0, now - IDLE_MS, { by: 'score', limit: { offset: 0, count: 50 } });
    if (idle.length === 0) break;
    for (const { member } of idle) {
      await deleteUserData(member);
      deleted += 1;
    }
  }
  return deleted;
}

/** The hash of display names that goes with a leaderboard. */
export const namesKey = (boardKey: string) => `${boardKey}:names`;

/** Remove everything stored for one user (Devvit rules, deleted accounts). */
export async function deleteUserData(userId: string): Promise<void> {
  const entries = Object.entries(await redis.hGetAll(indexKey(userId)));
  for (const [key, kind] of entries) {
    if (kind === 'member') {
      await redis.zRem(key, [userId]);
      await redis.hDel(namesKey(key), [userId]);
    } else if (kind === 'field') {
      await redis.hDel(key, [userId]);
    } else {
      await redis.del(key);
    }
  }
  await redis.del(indexKey(userId));
  await redis.zRem(SEEN_KEY, [userId]);
}
