import { and, eq, sql } from 'drizzle-orm';
import { calcMedalForAttempt } from '../../../lib/gameTiers';
import { games, playerRoadAnalytics } from '../../db/schema';
import { useDb } from '../../db/client';
import { SessionEndPayloadSchema } from '../../db/validators';
import { parsePayload } from '../../utils/validation';

const route = 'POST /api/session/end';

type RateLimitedEvent = {
  context: {
    cloudflare?: {
      env?: {
        RATE_LIMITER?: RateLimit;
      };
    };
  };
};

type LogContext = {
  route: string;
  player: string;
  session: string;
  gameNo: number;
  puzzleType: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isExpectedHttpError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    error.statusCode < 500
  );
}

function logContext(payload: { playerUUID: string; sessionId: string; gameNo: number; puzzleType: string }): LogContext {
  return {
    route,
    player: payload.playerUUID.slice(0, 8),
    session: payload.sessionId.slice(0, 8),
    gameNo: payload.gameNo,
    puzzleType: payload.puzzleType,
  };
}

async function limitByPlayerUUID(event: RateLimitedEvent, playerUUID: string) {
  const rateLimiter = event.context.cloudflare?.env?.RATE_LIMITER;
  if (!rateLimiter) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Rate limiter unavailable',
    });
  }

  return rateLimiter.limit({ key: playerUUID });
}

export default defineEventHandler(async (event) => {
  let context: LogContext | null = null;

  try {
    const body = await readBody(event);
    const payload = (() => {
      try {
        return parsePayload(SessionEndPayloadSchema, body);
      } catch (error) {
        console.error('[api/session/end] invalid request payload', {
          route,
          error: errorMessage(error),
        });
        throw error;
      }
    })();
    context = logContext(payload);

    const rateLimit = await limitByPlayerUUID(event, payload.playerUUID);
    if (!rateLimit.success) {
      console.error('[api/session/end] rate limit exceeded', context);
      setResponseStatus(event, 429);
      return {
        ok: false,
        error: 'rate_limited',
      };
    }

    const db = useDb(event);
    const gameRows = await db
      .select({
        gameNo: games.gameNo,
        puzzleType: games.puzzleType,
      })
      .from(games)
      .where(
        and(
          eq(games.gameNo, payload.gameNo),
          eq(games.puzzleType, payload.puzzleType),
        ),
      )
      .limit(1);

    const game = gameRows[0];
    if (!game) {
      console.error('[api/session/end] game not found', context);
      throw createError({
        statusCode: 404,
        statusMessage: `Game ${payload.gameNo} not found`,
      });
    }

    const existingRows = await db
      .select({
        attempts: playerRoadAnalytics.attempts,
        solved: playerRoadAnalytics.solved,
        hintsUsed: playerRoadAnalytics.hintsUsed,
        attemptsBeforeFirstHint: playerRoadAnalytics.attemptsBeforeFirstHint,
        firstHintMoveIndex: playerRoadAnalytics.firstHintMoveIndex,
        solveTimeMs: playerRoadAnalytics.solveTimeMs,
        deadEndCount: playerRoadAnalytics.deadEndCount,
        wrongExitCount: playerRoadAnalytics.wrongExitCount,
        solvedAt: playerRoadAnalytics.solvedAt,
        solveSessionId: playerRoadAnalytics.solveSessionId,
      })
      .from(playerRoadAnalytics)
      .where(
        and(
          eq(playerRoadAnalytics.playerId, payload.playerUUID),
          eq(playerRoadAnalytics.gameNo, payload.gameNo),
          eq(playerRoadAnalytics.puzzleType, payload.puzzleType),
        ),
      )
      .limit(1);

    const existing = existingRows[0] ?? null;
    const deadEndDelta = payload.endReason === 'dead-end' ? 1 : 0;
    const wrongExitDelta = payload.endReason === 'wrong-exit' ? 1 : 0;
    const finishedAt = new Date().toISOString();
    const submittedMedal = calcMedalForAttempt(
      payload.attemptNumber,
      payload.solved,
    );

    if (existing?.solved) {
      return {
        ok: true,
        gameNo: payload.gameNo,
        medal: submittedMedal,
        score: payload.score,
        solved: payload.solved,
      };
    }

    const nextSolved = payload.solved;
    const nextAttempts = nextSolved
      ? payload.attemptNumber
      : Math.max(existing?.attempts ?? 0, payload.attemptNumber);
    const nextHintsUsed = Math.max(existing?.hintsUsed ?? 0, payload.hintsUsed);
    const nextDeadEndCount = (existing?.deadEndCount ?? 0) + deadEndDelta;
    const nextWrongExitCount = (existing?.wrongExitCount ?? 0) + wrongExitDelta;
    const nextSolveTimeMs = nextSolved
      ? (payload.solveTimeMs ?? existing?.solveTimeMs ?? null)
      : (existing?.solveTimeMs ?? null);
    const nextSolvedAt = nextSolved ? finishedAt : (existing?.solvedAt ?? null);
    const nextSolveSessionId = nextSolved
      ? payload.sessionId
      : (existing?.solveSessionId ?? null);
    const medal = calcMedalForAttempt(nextAttempts, nextSolved);

    await db
      .insert(playerRoadAnalytics)
      .values({
        playerId: payload.playerUUID,
        gameNo: payload.gameNo,
        puzzleType: payload.puzzleType,
        attempts: nextAttempts,
        solved: nextSolved,
        hintsUsed: nextHintsUsed,
        attemptsBeforeFirstHint: existing?.attemptsBeforeFirstHint ?? null,
        firstHintMoveIndex: existing?.firstHintMoveIndex ?? null,
        solveTimeMs: nextSolveTimeMs,
        deadEndCount: nextDeadEndCount,
        wrongExitCount: nextWrongExitCount,
        lastPlayedAt: finishedAt,
        solvedAt: nextSolvedAt,
        solveSessionId: nextSolveSessionId,
        createdAt: finishedAt,
        updatedAt: finishedAt,
      })
      .onConflictDoUpdate({
        target: [
          playerRoadAnalytics.playerId,
          playerRoadAnalytics.gameNo,
          playerRoadAnalytics.puzzleType,
        ],
        set: {
          attempts: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 THEN ${playerRoadAnalytics.attempts} ELSE ${nextAttempts} END`,
          solved: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 THEN ${playerRoadAnalytics.solved} ELSE ${nextSolved ? 1 : 0} END`,
          hintsUsed: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 THEN ${playerRoadAnalytics.hintsUsed} ELSE MAX(${playerRoadAnalytics.hintsUsed}, ${payload.hintsUsed}) END`,
          attemptsBeforeFirstHint: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 THEN ${playerRoadAnalytics.attemptsBeforeFirstHint} ELSE COALESCE(${playerRoadAnalytics.attemptsBeforeFirstHint}, ${existing?.attemptsBeforeFirstHint ?? null}) END`,
          firstHintMoveIndex: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 THEN ${playerRoadAnalytics.firstHintMoveIndex} ELSE COALESCE(${playerRoadAnalytics.firstHintMoveIndex}, ${existing?.firstHintMoveIndex ?? null}) END`,
          solveTimeMs: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 THEN ${playerRoadAnalytics.solveTimeMs} ELSE ${nextSolveTimeMs} END`,
          deadEndCount: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 THEN ${playerRoadAnalytics.deadEndCount} ELSE ${playerRoadAnalytics.deadEndCount} + ${deadEndDelta} END`,
          wrongExitCount: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 THEN ${playerRoadAnalytics.wrongExitCount} ELSE ${playerRoadAnalytics.wrongExitCount} + ${wrongExitDelta} END`,
          lastPlayedAt: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 THEN ${playerRoadAnalytics.lastPlayedAt} ELSE ${finishedAt} END`,
          solvedAt: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 THEN ${playerRoadAnalytics.solvedAt} ELSE ${nextSolvedAt} END`,
          solveSessionId: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 THEN ${playerRoadAnalytics.solveSessionId} ELSE ${nextSolveSessionId} END`,
          updatedAt: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 THEN ${playerRoadAnalytics.updatedAt} ELSE ${finishedAt} END`,
        },
      });

    const playsDelta = existing ? 0 : 1;
    const exactSolveDelta = nextSolved ? 1 : 0;
    const goldDelta = medal === 'gold' ? 1 : 0;
    const silverDelta = medal === 'silver' ? 1 : 0;
    const bronzeDelta = medal === 'bronze' ? 1 : 0;

    if (
      playsDelta > 0 ||
      exactSolveDelta > 0 ||
      goldDelta > 0 ||
      silverDelta > 0 ||
      bronzeDelta > 0
    ) {
      await db
        .update(games)
        .set({
          playsCount: sql`${games.playsCount} + ${playsDelta}`,
          goldCount: sql`${games.goldCount} + ${goldDelta}`,
          silverCount: sql`${games.silverCount} + ${silverDelta}`,
          bronzeCount: sql`${games.bronzeCount} + ${bronzeDelta}`,
          finishedCount: sql`${games.finishedCount} + ${exactSolveDelta}`,
          updatedAt: sql`(datetime('now'))`,
        })
        .where(
          and(
            eq(games.gameNo, payload.gameNo),
            eq(games.puzzleType, payload.puzzleType),
          ),
        );
    }

    return {
      ok: true,
      gameNo: payload.gameNo,
      medal,
      score: payload.score,
      solved: payload.solved,
    };
  } catch (error) {
    if (!isExpectedHttpError(error)) {
      console.error('[api/session/end] request failed', {
        ...(context ?? { route }),
        error: errorMessage(error),
      });
    }
    throw error;
  }
});
