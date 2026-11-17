import { reddit, redis } from '@devvit/web/server';
import type { Medal, PlayerRun, RoadMode } from '../../shared/api';

/** Post id → the pinned comment that collects results. */
const threadKey = (postId: string) => `thread:${postId}`;

const PENDING = 'pending';

export class ThreadBusyError extends Error {
  constructor() {
    super('The results comment is being created. Try again in a moment.');
  }
}

export const THREAD_TEXT =
  'Post your result as a reply here. Talk about the road below. No routes, please: let others find the gold.';

/**
 * The pinned comment under a road post. Reddit asks that plain score
 * comments are replies to one pinned comment, so every result goes here.
 * Created once per post: by the daily job, or on the first result shared.
 */
export async function ensureResultsThread(postId: string): Promise<string> {
  const key = threadKey(postId);
  const existing = await redis.get(key);
  if (existing && existing !== PENDING) return existing;
  // Only one caller creates the comment. The claim ends by itself if that
  // caller fails, so a crash never blocks the thread for ever.
  const claimed = await redis.set(key, PENDING, { nx: true, expiration: new Date(Date.now() + 30_000) });
  if (!claimed) throw new ThreadBusyError();
  try {
    const comment = await reddit.submitComment({ id: postId as `t3_${string}`, text: THREAD_TEXT, runAs: 'APP' });
    try {
      await comment.distinguish(true);
    } catch (error) {
      // The comment still works as the thread; it is only not pinned.
      console.error(`could not pin the results comment: ${error}`);
    }
    await redis.set(key, comment.id);
    return comment.id;
  } catch (error) {
    await redis.del(key);
    throw error;
  }
}

const MEDAL_ICON: Record<Medal, string> = { gold: '🥇', silver: '🥈', bronze: '🥉' };

function duration(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** The result as a comment: no link, no route, no spoiler. */
export function resultText(roadNo: number, mode: RoadMode, run: PlayerRun): string {
  const tries = run.solvedAttempt ?? run.attempts;
  const medal = run.medal ? `${MEDAL_ICON[run.medal]} ${run.medal[0]!.toUpperCase()}${run.medal.slice(1)}` : '✨ Solved';
  const parts = [
    `${medal} in ${tries} ${tries === 1 ? 'try' : 'tries'}`,
    `${run.hintsUsed} ${run.hintsUsed === 1 ? 'hint' : 'hints'}`,
  ];
  if (run.solveSeconds !== null) parts.push(duration(run.solveSeconds));
  return `GoldRoad #${roadNo} · ${mode === 'classic' ? 'Classic' : 'Expedition'}\n\n${parts.join(' · ')}`;
}
