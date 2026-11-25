import { redis } from '@devvit/web/server';
import { HINTS_PER_ROAD_MODE } from '#game/lib/gameConstants';
import { calcMedalForAttempt } from '#game/lib/gameTiers';
import { computeHint, hintRevealsNewTile } from '#game/shared/utils/hints';
import type { HintResult } from '#game/shared/types/game';
import type { Medal, PlayerRun, PublicRoad, RoadMode } from '../../shared/api';
import { replayRoute } from '../../shared/run';
import { dayEndMs } from './day';
import { recordFirstTry } from './trap';
import { recordSolve } from './standing';
import { remember } from './userIndex';

const runKey = (userId: string, day: string, mode: RoadMode) => `run:${userId}:${day}:${mode}`;

type StoredRun = {
  attempts?: string;
  fails?: string;
  hints?: string;
  guide?: string;
  firstStartMs?: string;
  solvedAttempt?: string;
  solveSeconds?: string;
  medal?: string;
  /** "1" when the solve came inside the post's day and went on the board. */
  counted?: string;
  /** The player's result comment, once posted. One per road and mode. */
  commentId?: string;
  /** "1" once the first finished try went into the trap counts. */
  walked?: string;
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
  await remember(userId, key);
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
    commented: stored.commentId !== undefined,
  };
}

export async function getRun(userId: string, day: string, mode: RoadMode): Promise<PlayerRun> {
  return toPublic(await read(userId, day, mode));
}

/**
 * Keep one result comment per road and mode. Returns false when the player
 * has already posted one, so a double tap never posts twice.
 */
export async function claimComment(userId: string, day: string, mode: RoadMode): Promise<boolean> {
  const key = runKey(userId, day, mode);
  return (await redis.hSetNX(key, 'commentId', 'pending')) === 1;
}

/** The id of the player's posted result comment for a road, if there is one. */
export async function postedCommentId(userId: string, day: string, mode: RoadMode): Promise<string | null> {
  const id = (await read(userId, day, mode)).commentId;
  return id && id !== 'pending' ? id : null;
}

export async function saveComment(userId: string, day: string, mode: RoadMode, commentId: string | null) {
  const key = runKey(userId, day, mode);
  if (commentId) await redis.hSet(key, { commentId });
  else await redis.hDel(key, ['commentId']);
}

/** True when the player's solve went on the board and the streak. */
export async function isCounted(userId: string, day: string, mode: RoadMode): Promise<boolean> {
  return (await read(userId, day, mode)).counted === '1';
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

  // Count with one atomic step. Two starts can arrive together (a slow first
  // request, then the next try), and a read-then-write would count only one.
  const key = runKey(userId, day, mode);
  await redis.hIncrBy(key, 'attempts', 1);
  await redis.hSetNX(key, 'firstStartMs', String(Date.now()));
  await remember(userId, key);
  return toPublic(await read(userId, day, mode));
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

export type Player = { id: string; name: string };

/**
 * The end of a try. The server walks the route itself and decides the
 * result. A solve is kept once: later solves of the same road change nothing.
 * A solve inside the post's own day goes on the leaderboard and the streak.
 * A later one is kept, but as practice.
 */
export async function finishTry(
  player: Player | null,
  day: string,
  mode: RoadMode,
  road: PublicRoad,
  path: number[],
): Promise<{ outcome: 'solved' | 'wrong-exit' | 'dead-end'; score: number; run: PlayerRun | null }> {
  const state = replayRoute(road.board, road.target, path);
  if (!state || !state.outcome) throw new RunError(400, 'Not a finished route');
  const { outcome, score } = state;
  if (!player) return { outcome, score, run: null };
  const userId = player.id;

  await assertModeOpen(userId, day, mode);
  const stored = await read(userId, day, mode);
  // The trap counts each player's first finished try, once.
  if (Number(stored.attempts ?? 0) <= 1 && (await redis.hSetNX(runKey(userId, day, mode), 'walked', '1'))) {
    await remember(userId, runKey(userId, day, mode));
    await recordFirstTry(day, mode, path);
  }
  if (outcome !== 'solved') {
    // Count the failed walk too. If its start request was lost, the solve
    // that follows still cannot claim fewer tries than the walks that failed.
    if (stored.solvedAttempt === undefined) {
      await redis.hIncrBy(runKey(userId, day, mode), 'fails', 1);
      await remember(userId, runKey(userId, day, mode));
    }
    return { outcome, score, run: toPublic(stored) };
  }
  if (stored.solvedAttempt !== undefined) {
    // A retry of a saved solve. A failed request may have saved the solve but
    // not its rank and streak. recordSolve is safe to run again: it writes the
    // same rank, and a day already on the streak is not counted twice.
    if (stored.counted === '1') {
      await recordSolve(userId, player.name, day, mode, {
        attempts: Number(stored.solvedAttempt),
        hints: Number(stored.hints ?? 0),
        seconds: Number(stored.solveSeconds ?? 0),
      });
    }
    return { outcome, score, run: toPublic(stored) };
  }
  // A solve with no recorded start (for example a lost request) still counts
  // as one try, never as zero, and never fewer than the failed walks plus one.
  const attempt = Math.max(1, Number(stored.attempts ?? 0), Number(stored.fails ?? 0) + 1);
  const now = Date.now();
  const started = Number(stored.firstStartMs ?? now);
  const seconds = Math.max(0, Math.round((now - started) / 1000));
  const counted = now < dayEndMs(day);
  const medal = calcMedalForAttempt(attempt, true);
  const fields: Record<string, string> = {
    attempts: String(attempt),
    solvedAttempt: String(attempt),
    solveSeconds: String(seconds),
    counted: counted ? '1' : '0',
  };
  if (medal) fields.medal = medal;
  await write(userId, day, mode, fields);
  if (counted) {
    const hints = Number(stored.hints ?? 0);
    await recordSolve(userId, player.name, day, mode, { attempts: attempt, hints, seconds });
  }
  return { outcome, score, run: toPublic({ ...stored, ...fields }) };
}
