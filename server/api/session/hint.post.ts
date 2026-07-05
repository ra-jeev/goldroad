import { and, eq, sql } from 'drizzle-orm';
import { games, playerRoadAnalytics } from '../../db/schema';
import { useDb } from '../../db/client';
import { HintRequestPayloadSchema } from '../../db/validators';
import { computeHint } from '../../utils/hints';
import { parseHintGameRow } from '../../utils/apiGames';
import { parsePayload } from '../../utils/validation';

const route = 'POST /api/session/hint';

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
        return parsePayload(HintRequestPayloadSchema, body);
      } catch (error) {
        console.error('[api/session/hint] invalid request payload', {
          route,
          error: errorMessage(error),
        });
        throw error;
      }
    })();
    context = logContext(payload);

    const rateLimit = await limitByPlayerUUID(event, payload.playerUUID);
    if (!rateLimit.success) {
      console.error('[api/session/hint] rate limit exceeded', context);
      setResponseStatus(event, 429);
      return {
        ok: false,
        error: 'rate_limited',
      };
    }

    const db = useDb(event);
    const rows = await db
      .select({
        boardJson: games.boardJson,
        optimalPathsJson: games.optimalPathsJson,
      })
      .from(games)
      .where(
        and(
          eq(games.gameNo, payload.gameNo),
          eq(games.puzzleType, payload.puzzleType),
          eq(games.active, true),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      console.error('[api/session/hint] game not found', context);
      throw createError({
        statusCode: 404,
        statusMessage: `Game ${payload.gameNo} not found`,
      });
    }

    const parsed = parseHintGameRow(row);
    const hint = computeHint(parsed.optimalPaths, payload.pathHistory);

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
    if (existing?.solved && existing.solveSessionId !== payload.sessionId) {
      return {
        ok: true,
        hint,
      };
    }

    const nowIso = new Date().toISOString();
    const attemptsBeforeFirstHint =
      existing?.attemptsBeforeFirstHint ?? Math.max(0, payload.attemptNumber - 1);
    const firstHintMoveIndex =
      existing?.firstHintMoveIndex ?? Math.max(0, payload.pathHistory.length - 1);
    const nextAttempts = Math.max(existing?.attempts ?? 0, payload.attemptNumber);
    const nextHintsUsed = (existing?.hintsUsed ?? 0) + 1;

    await db
      .insert(playerRoadAnalytics)
      .values({
        playerId: payload.playerUUID,
        gameNo: payload.gameNo,
        puzzleType: payload.puzzleType,
        attempts: nextAttempts,
        solved: false,
        hintsUsed: nextHintsUsed,
        attemptsBeforeFirstHint,
        firstHintMoveIndex,
        solveTimeMs: existing?.solveTimeMs ?? null,
        deadEndCount: existing?.deadEndCount ?? 0,
        wrongExitCount: existing?.wrongExitCount ?? 0,
        lastPlayedAt: nowIso,
        solvedAt: existing?.solvedAt ?? null,
        solveSessionId: existing?.solveSessionId ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .onConflictDoUpdate({
        target: [
          playerRoadAnalytics.playerId,
          playerRoadAnalytics.gameNo,
          playerRoadAnalytics.puzzleType,
        ],
        set: {
          attempts: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 AND COALESCE(${playerRoadAnalytics.solveSessionId}, '') <> ${payload.sessionId} THEN ${playerRoadAnalytics.attempts} ELSE MAX(${playerRoadAnalytics.attempts}, ${payload.attemptNumber}) END`,
          hintsUsed: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 AND COALESCE(${playerRoadAnalytics.solveSessionId}, '') <> ${payload.sessionId} THEN ${playerRoadAnalytics.hintsUsed} ELSE ${playerRoadAnalytics.hintsUsed} + 1 END`,
          attemptsBeforeFirstHint: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 AND COALESCE(${playerRoadAnalytics.solveSessionId}, '') <> ${payload.sessionId} THEN ${playerRoadAnalytics.attemptsBeforeFirstHint} ELSE COALESCE(${playerRoadAnalytics.attemptsBeforeFirstHint}, ${attemptsBeforeFirstHint}) END`,
          firstHintMoveIndex: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 AND COALESCE(${playerRoadAnalytics.solveSessionId}, '') <> ${payload.sessionId} THEN ${playerRoadAnalytics.firstHintMoveIndex} ELSE COALESCE(${playerRoadAnalytics.firstHintMoveIndex}, ${firstHintMoveIndex}) END`,
          lastPlayedAt: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 AND COALESCE(${playerRoadAnalytics.solveSessionId}, '') <> ${payload.sessionId} THEN ${playerRoadAnalytics.lastPlayedAt} ELSE ${nowIso} END`,
          updatedAt: sql`CASE WHEN ${playerRoadAnalytics.solved} = 1 AND COALESCE(${playerRoadAnalytics.solveSessionId}, '') <> ${payload.sessionId} THEN ${playerRoadAnalytics.updatedAt} ELSE ${nowIso} END`,
        },
      });

    if (!existing) {
      await db
        .update(games)
        .set({
          playsCount: sql`${games.playsCount} + 1`,
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
      hint,
    };
  } catch (error) {
    if (!isExpectedHttpError(error)) {
      console.error('[api/session/hint] request failed', {
        ...(context ?? { route }),
        error: errorMessage(error),
      });
    }
    throw error;
  }
});
