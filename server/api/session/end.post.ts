import type { H3Event } from 'h3';
import { and, eq, sql } from 'drizzle-orm';
import { calcMedalForAttempt } from '../../../lib/gameTiers';
import { games, playerRoadAnalytics } from '../../db/schema';
import { useDb } from '../../db/client';
import { SessionEndPayloadSchema } from '../../db/validators';
import { parsePayload } from '../../utils/validation';

const route = 'POST /api/session/end';

type RateLimitedEvent = H3Event & {
  context: {
    cloudflare?: {
      env?: {
        RATE_LIMITER?: RateLimit;
      };
    };
  };
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

async function checkRateLimit(event: RateLimitedEvent, playerUUID: string) {
  const rateLimiter = event.context.cloudflare?.env?.RATE_LIMITER;
  if (!rateLimiter) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Rate limiter unavailable',
    });
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const [byPlayer, byIp] = await Promise.all([
    rateLimiter.limit({ key: `player:${playerUUID}` }),
    rateLimiter.limit({ key: `ip:${ip}` }),
  ]);

  return byPlayer.success && byIp.success;
}

export default defineEventHandler(async (event) => {
  let context: Record<string, string | number> = { route };

  try {
    const payload = parsePayload(
      SessionEndPayloadSchema,
      await readBody(event),
    );
    context = {
      route,
      player: payload.playerUUID.slice(0, 8),
      session: payload.sessionId.slice(0, 8),
      gameNo: payload.gameNo,
      puzzleType: payload.puzzleType,
    };

    if (!(await checkRateLimit(event, payload.playerUUID))) {
      console.error('[api/session/end] rate limit exceeded', context);
      setResponseStatus(event, 429);
      return { ok: false, error: 'rate_limited' };
    }

    const db = useDb(event);
    const gameRows = await db
      .select({ maxScore: games.maxScore })
      .from(games)
      .where(
        and(
          eq(games.gameNo, payload.gameNo),
          eq(games.puzzleType, payload.puzzleType),
          eq(games.current, true),
        ),
      )
      .limit(1);

    const game = gameRows[0];
    if (!game) {
      throw createError({
        statusCode: 404,
        statusMessage: `Game ${payload.gameNo} not found or not the current road`,
      });
    }

    if (payload.score !== game.maxScore) {
      console.error('[api/session/end] score is not an exact solve', {
        ...context,
        score: payload.score,
        target: game.maxScore,
      });
      throw createError({
        statusCode: 400,
        statusMessage: 'score must equal this road\'s target',
      });
    }

    const nowIso = new Date().toISOString();
    const medal = calcMedalForAttempt(payload.attemptNumber, true);
    const goldDelta = medal === 'gold' ? 1 : 0;
    const silverDelta = medal === 'silver' ? 1 : 0;
    const bronzeDelta = medal === 'bronze' ? 1 : 0;
    const analyticsKey = and(
      eq(playerRoadAnalytics.playerId, payload.playerUUID),
      eq(playerRoadAnalytics.gameNo, payload.gameNo),
      eq(playerRoadAnalytics.puzzleType, payload.puzzleType),
    );
    const gameKey = and(
      eq(games.gameNo, payload.gameNo),
      eq(games.puzzleType, payload.puzzleType),
    );

    // D1 batch execution is atomic. `changes()` lets each aggregate update
    // consume the affected-row count of the immediately preceding statement:
    // a missed start increments plays once, and only the first solve update
    // increments finished/medal counts.
    await db.batch([
      db
        .insert(playerRoadAnalytics)
        .values({
          playerId: payload.playerUUID,
          gameNo: payload.gameNo,
          puzzleType: payload.puzzleType,
          attempts: 0,
          solved: false,
          hintsUsed: 0,
          deadEndCount: 0,
          wrongExitCount: 0,
          lastPlayedAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        .onConflictDoNothing(),
      db
        .update(games)
        .set({
          playsCount: sql`${games.playsCount} + changes()`,
          updatedAt: sql`CASE WHEN changes() > 0 THEN (datetime('now')) ELSE ${games.updatedAt} END`,
        })
        .where(gameKey),
      db
        .update(playerRoadAnalytics)
        .set({
          attempts: payload.attemptNumber,
          solved: true,
          hintsUsed: payload.hintsUsed,
          solveTimeMs: payload.solveTimeMs ?? null,
          lastPlayedAt: nowIso,
          solvedAt: nowIso,
          solveSessionId: payload.sessionId,
          updatedAt: nowIso,
        })
        .where(and(analyticsKey, eq(playerRoadAnalytics.solved, false))),
      db
        .update(games)
        .set({
          finishedCount: sql`${games.finishedCount} + changes()`,
          goldCount: sql`${games.goldCount} + changes() * ${goldDelta}`,
          silverCount: sql`${games.silverCount} + changes() * ${silverDelta}`,
          bronzeCount: sql`${games.bronzeCount} + changes() * ${bronzeDelta}`,
          updatedAt: sql`CASE WHEN changes() > 0 THEN (datetime('now')) ELSE ${games.updatedAt} END`,
        })
        .where(gameKey),
    ]);

    return {
      ok: true,
      gameNo: payload.gameNo,
      medal,
      score: payload.score,
      solved: true as const,
    };
  } catch (error) {
    if (!isExpectedHttpError(error)) {
      console.error('[api/session/end] request failed', {
        ...context,
        error: errorMessage(error),
      });
    }
    throw error;
  }
});
