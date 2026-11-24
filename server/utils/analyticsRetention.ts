import { lt } from 'drizzle-orm';
import { playerRoadAnalytics } from '../db/schema';
import type { createGoldroadDb } from './roadOperations';

/** Play stats are kept for 2 years. The privacy page states this period. */
export const ANALYTICS_RETENTION_DAYS = 730;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rows last played before this time are deleted. */
export function analyticsRetentionCutoff(now = new Date()): string {
  return new Date(now.getTime() - ANALYTICS_RETENTION_DAYS * DAY_MS).toISOString();
}

export async function pruneExpiredAnalytics(
  db: ReturnType<typeof createGoldroadDb>,
  now = new Date(),
): Promise<{ cutoff: string; deleted: number }> {
  const cutoff = analyticsRetentionCutoff(now);
  const result = await db
    .delete(playerRoadAnalytics)
    .where(lt(playerRoadAnalytics.lastPlayedAt, cutoff))
    .run();
  return { cutoff, deleted: result.meta?.changes ?? 0 };
}
