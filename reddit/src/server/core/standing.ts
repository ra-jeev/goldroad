import { redis } from '@devvit/web/server';
import type { Heat, LeaderRow, RoadMode, Standing } from '../../shared/api';
import { previousDay, utcDay } from './day';
import { namesKey, remember } from './userIndex';

const boardKey = (day: string, mode: RoadMode) => `lb:${day}:${mode}`;
const statsKey = (userId: string) => `stats:${userId}`;

/**
 * One sorted-set score orders the board: fewer tries, then fewer hints, then
 * less time. Lower is better. The medal follows from the tries.
 */
const TRY_WEIGHT = 1e8;
const HINT_WEIGHT = 1e6;
const MAX_SECONDS = HINT_WEIGHT - 1;

export function leaderScore(attempts: number, hints: number, seconds: number): number {
  return attempts * TRY_WEIGHT + hints * HINT_WEIGHT + Math.min(seconds, MAX_SECONDS);
}

function decode(score: number) {
  return {
    attempts: Math.floor(score / TRY_WEIGHT),
    hints: Math.floor((score % TRY_WEIGHT) / HINT_WEIGHT),
    seconds: score % HINT_WEIGHT,
  };
}

type Solve = { attempts: number; hints: number; seconds: number };

/** Put a counted solve on the board, and on the streak for Classic. */
export async function recordSolve(
  userId: string,
  name: string,
  day: string,
  mode: RoadMode,
  solve: Solve,
): Promise<void> {
  const key = boardKey(day, mode);
  await redis.zAdd(key, { member: userId, score: leaderScore(solve.attempts, solve.hints, solve.seconds) });
  await redis.hSet(namesKey(key), { [userId]: name });
  await remember(userId, key, 'member');
  if (mode === 'classic') await extendStreak(userId, day);
}

async function extendStreak(userId: string, day: string): Promise<void> {
  const stats = await redis.hGetAll(statsKey(userId));
  if (stats.lastDay === day) return;
  const streak = stats.lastDay === previousDay(day) ? Number(stats.streak ?? 0) + 1 : 1;
  const best = Math.max(streak, Number(stats.best ?? 0));
  await redis.hSet(statsKey(userId), { lastDay: day, streak: String(streak), best: String(best) });
  await remember(userId, statsKey(userId));
}

/** The streak as it is today: it breaks when a whole day goes by. */
async function readStreak(userId: string, today: string) {
  const stats = await redis.hGetAll(statsKey(userId));
  const alive = stats.lastDay === today || stats.lastDay === previousDay(today);
  return { streak: alive ? Number(stats.streak ?? 0) : 0, bestStreak: Number(stats.best ?? 0) };
}

const TOP = 10;

async function rowsAt(key: string, start: number, stop: number, userId: string): Promise<LeaderRow[]> {
  const entries = await redis.zRange(key, start, stop, { by: 'rank' });
  if (!entries.length) return [];
  const names = await redis.hGetAll(namesKey(key));
  return entries.map((entry, i) => ({
    rank: start + i + 1,
    name: names[entry.member] ?? 'walker',
    ...decode(entry.score),
    me: entry.member === userId,
  }));
}

export async function getStanding(
  userId: string,
  day: string,
  mode: RoadMode,
  counted: boolean,
  today: string = utcDay(),
  heat: Heat | null = null,
): Promise<Standing> {
  const key = boardKey(day, mode);
  const [index, players, streak] = await Promise.all([
    redis.zRank(key, userId),
    redis.zCard(key),
    readStreak(userId, today),
  ]);
  const rows = await rowsAt(key, 0, TOP - 1, userId);
  if (index !== undefined && index >= TOP) {
    rows.push(...(await rowsAt(key, Math.max(TOP, index - 1), index + 1, userId)));
  }
  return { counted, rank: index === undefined ? null : index + 1, players, ...streak, rows, heat };
}
