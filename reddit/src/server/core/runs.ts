import { redis } from '@devvit/web/server';
import { HINTS_PER_ROAD_MODE } from '#game/lib/gameConstants';
import { calcMedalForAttempt } from '#game/lib/gameTiers';
import { computeHint, hintRevealsNewTile } from '#game/shared/utils/hints';
import type { HintResult } from '#game/shared/types/game';
import type { Medal, PlayerRun, PublicRoad, RoadMode } from '../../shared/api';
import { replayRoute } from '../../shared/run';

const runKey = (userId: string, day: string, mode: RoadMode) => `run:${userId}:${day}:${mode}`;
/** Every run key of one user, so a deleted account can be removed in full. */
const userKey = (userId: string) => `user:${userId}`;

type StoredRun = {
  attempts?: string;
  hints?: string;
  guide?: string;
  firstStartMs?: string;
  solvedAttempt?: string;
  solveSeconds?: string;
  medal?: string;
};

export class RunError extends Error {
  constructor(
    readonly status: 400 | 403 | 429,
    message: string,
  ) {
    super(message);
  }
}

async function read(userId: string, day: string, mode: RoadMode): Promise<StoredRun> {
  return (await redis.hGetAll(runKey(userId, day, mode))) as StoredRun;
}

async function write(userId: string, day: string, mode: RoadMode, fields: Record<string, string>) {
  const key = runKey(userId, day, mode);
  await redis.hSet(key, fields);
  await redis.hSet(userKey(userId), { [key]: '1' });
}

function toPublic(stored: StoredRun): PlayerRun {
  const hintsUsed = Number(stored.hints ?? 0);
  return {
    attempts: Number(stored.attempts ?? 0),
    hintsUsed,
    hintsLeft: Math.max(0, HINTS_PER_ROAD_MODE - hintsUsed),
    guidePath: stored.guide ? (JSON.parse(stored.guide) as number[]) : [],
    solved: stored.solvedAttempt !== undefined,
    solvedAttempt: stored.solvedAttempt ? Number(stored.solvedAttempt) : null,
    medal: (stored.medal as Medal | undefined) ?? null,
    solveSeconds: stored.solveSeconds ? Number(stored.solveSeconds) : null,
  };
}

export async function getRun(userId: string, day: string, mode: RoadMode): Promise<PlayerRun> {
  return toPublic(await read(userId, day, mode));
}

/** Expedition opens once Classic is solved, as on the website. */
async function assertModeOpen(userId: string, day: string, mode: RoadMode) {
  if (mode === 'classic') return;
  const classic = await read(userId, day, 'classic');
  if (classic.solvedAttempt === undefined) throw new RunError(403, 'Solve Classic first');
}

/**
 * The first step of a try. Counts the try, and starts the clock on the very
 * first one. A reload that keeps the route on the device does not call this,
 * so it neither costs a try nor gives a free one.
 */
export async function startTry(userId: string, day: string, mode: RoadMode): Promise<PlayerRun> {
  await assertModeOpen(userId, day, mode);
  const stored = await read(userId, day, mode);
  if (stored.solvedAttempt !== undefined) return toPublic(stored);

  const attempts = Number(stored.attempts ?? 0) + 1;
  const fields: Record<string, string> = { attempts: String(attempts) };
  if (!stored.firstStartMs) fields.firstStartMs = String(Date.now());
  await write(userId, day, mode, fields);
  return toPublic({ ...stored, ...fields });
}

/**
 * The next hint for the route walked so far. Only a hint that shows a new
 * tile costs one of the five, as on the website.
 */
export async function useHint(
  userId: string,
  day: string,
  mode: RoadMode,
  road: PublicRoad,
  goldRoutes: number[][],
  path: number[],
): Promise<{ hint: HintResult; run: PlayerRun }> {
  await assertModeOpen(userId, day, mode);
  if (!replayRoute(road.board, road.target, path)) throw new RunError(400, 'Not a legal route');

  const stored = await read(userId, day, mode);
  const run = toPublic(stored);
  const hint = computeHint(goldRoutes, path, run.guidePath);
  if (!hintRevealsNewTile(run.guidePath, hint.guidePath)) return { hint, run };
  if (run.hintsLeft === 0) throw new RunError(429, 'No hints left');

  const fields = { hints: String(run.hintsUsed + 1), guide: JSON.stringify(hint.guidePath) };
  await write(userId, day, mode, fields);
  return { hint, run: toPublic({ ...stored, ...fields }) };
}

/** Hint for a logged-out player. Nothing is saved, so nothing is counted. */
export function guestHint(road: PublicRoad, goldRoutes: number[][], path: number[], guide: number[]): HintResult {
  if (!replayRoute(road.board, road.target, path)) throw new RunError(400, 'Not a legal route');
  return computeHint(goldRoutes, path, guide);
}

/**
 * The end of a try. The server walks the route itself and decides the
 * result. A solve is kept once: later solves of the same road change nothing.
 */
export async function finishTry(
  userId: string | null,
  day: string,
  mode: RoadMode,
  road: PublicRoad,
  path: number[],
): Promise<{ outcome: 'solved' | 'wrong-exit' | 'dead-end'; score: number; run: PlayerRun | null }> {
  const state = replayRoute(road.board, road.target, path);
  if (!state || !state.outcome) throw new RunError(400, 'Not a finished route');
  const { outcome, score } = state;
  if (!userId) return { outcome, score, run: null };

  await assertModeOpen(userId, day, mode);
  const stored = await read(userId, day, mode);
  if (outcome !== 'solved' || stored.solvedAttempt !== undefined) {
    return { outcome, score, run: toPublic(stored) };
  }
  // A solve with no recorded start (for example a lost request) still counts
  // as one try, never as zero.
  const attempt = Math.max(1, Number(stored.attempts ?? 0));
  const started = Number(stored.firstStartMs ?? Date.now());
  const medal = calcMedalForAttempt(attempt, true);
  const fields: Record<string, string> = {
    attempts: String(attempt),
    solvedAttempt: String(attempt),
    solveSeconds: String(Math.max(0, Math.round((Date.now() - started) / 1000))),
  };
  if (medal) fields.medal = medal;
  await write(userId, day, mode, fields);
  return { outcome, score, run: toPublic({ ...stored, ...fields }) };
}

/** Remove everything stored for one user (Devvit rules, deleted accounts). */
export async function deleteUserData(userId: string): Promise<void> {
  const keys = await redis.hKeys(userKey(userId));
  if (keys.length) await redis.del(...keys);
  await redis.del(userKey(userId));
}
