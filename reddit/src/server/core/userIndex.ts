import { redis } from '@devvit/web/server';

/**
 * Every key that holds data of one user, so a deleted account can be removed
 * in full. A "key" belongs to the user alone and is deleted. A "member" is a
 * shared leaderboard: only the user's entry is removed from it.
 */
const indexKey = (userId: string) => `user:${userId}`;

export type IndexKind = 'key' | 'member';

export async function remember(userId: string, key: string, kind: IndexKind = 'key'): Promise<void> {
  await redis.hSet(indexKey(userId), { [key]: kind });
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
    } else {
      await redis.del(key);
    }
  }
  await redis.del(indexKey(userId));
}
