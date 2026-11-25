import { redis } from '@devvit/web/server';
import type { CommunityOptionId, CommunityPick } from '../../shared/api';
import { COMMUNITY_OPTIONS } from './community';
import { ensureDailyPost } from './post';
import { prepareRoad } from './road';

/**
 * A test post for one Sunday vote option, so a moderator can play that board
 * before a real Sunday. Each test uses its own Sunday in the year 2000: an old
 * road, so it never counts for the leaderboard, the streak or the flair, and
 * it takes no road number.
 */
const COUNT_KEY = 'testroad:count';
const FIRST_SUNDAY = Date.parse('2000-01-02T00:00:00Z');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function createTestRoadPost(option: CommunityOptionId): Promise<string> {
  const choice = COMMUNITY_OPTIONS.find((item) => item.id === option);
  if (!choice) throw new Error(`Unknown option ${option}`);
  const n = await redis.incrBy(COUNT_KEY, 1);
  const day = new Date(FIRST_SUNDAY + (n - 1) * WEEK_MS).toISOString().slice(0, 10);

  const pick: CommunityPick = { id: choice.id, label: choice.label, votes: 0, total: 0 };
  await redis.set(`community:${day}`, JSON.stringify(pick));
  await redis.set(`roadno:${day}`, '0');
  await prepareRoad(day, 'expedition');
  const { postId } = await ensureDailyPost(day, { test: true });
  return postId;
}
