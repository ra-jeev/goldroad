import type { H3Event } from 'h3';
import { and, eq, sql } from 'drizzle-orm';
import { games, playerRoadAnalytics } from '../../db/schema';
import { useDb } from '../../db/client';
import { SessionStartPayloadSchema } from '../../db/validators';
import { parsePayload } from '../../utils/validation';

const route = 'POST /api/session/start';

type RateLimitedEvent = H3Event & {
  context: {
    cloudflare?: {
      env?: {
        RATE_LIMITER?: RateLimit;
      };
    };
  };
};

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
  const payload = parsePayload(
    SessionStartPayloadSchema,
    await readBody(event),
  );
  const context = {
    route,
    player: payload.playerUUID.slice(0, 8),
    session: payload.sessionId.slice(0, 8),
    gameNo: payload.gameNo,
    puzzleType: payload.puzzleType,
  };

  if (!(await checkRateLimit(event, payload.playerUUID))) {
    console.error('[api/session/start] rate limit exceeded', context);
    setResponseStatus(event, 429);
    return { ok: false, error: 'rate_limited' };
  }

  const db = useDb(event);
  const gameRows = await db
    .select({ gameNo: games.gameNo })
    .from(games)
    .where(
      and(
        eq(games.gameNo, payload.gameNo),
        eq(games.puzzleType, payload.puzzleType),
        eq(games.current, true),
      ),
    )
    .limit(1);

  if (!gameRows[0]) {
    throw createError({
      statusCode: 404,
      statusMessage: `Game ${payload.gameNo} not found or not the current road`,
    });
  }

  const nowIso = new Date().toISOString();
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
      .where(
        and(
          eq(games.gameNo, payload.gameNo),
          eq(games.puzzleType, payload.puzzleType),
        ),
      ),
  ]);

  return { ok: true, gameNo: payload.gameNo };
});
