import type { H3Event } from 'h3';
import { and, eq } from 'drizzle-orm';
import { games } from '../../db/schema';
import { useDb } from '../../db/client';
import { HintRequestPayloadSchema } from '../../db/validators';
import { computeHint } from '../../../shared/utils/hints';
import { parseHintGameRow } from '../../utils/apiGames';
import { parsePayload } from '../../utils/validation';

const route = 'POST /api/session/hint';

type RateLimitedEvent = H3Event & {
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

/**
 * Rate limit on both the player-supplied UUID and the request's network
 * address, so rotating the client-generated UUID alone cannot bypass the
 * limit (RP0-4). Either key tripping is enough to reject the request.
 */
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

  return { success: byPlayer.success && byIp.success };
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

    const rateLimit = await checkRateLimit(event, payload.playerUUID);
    if (!rateLimit.success) {
      console.error('[api/session/hint] rate limit exceeded', context);
      setResponseStatus(event, 429);
      return {
        ok: false,
        error: 'rate_limited',
      };
    }

    const db = useDb(event);
    // Only the current road can request server-computed hints. Archive/replay
    // play computes hints locally from client-shipped optimal paths (RP0-5)
    // and must never reach this contract (RP0-4).
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
          eq(games.current, true),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      console.error('[api/session/hint] game not found or not current', context);
      throw createError({
        statusCode: 404,
        statusMessage: `Game ${payload.gameNo} not found or not the current road`,
      });
    }

    const parsed = parseHintGameRow(row);
    const hint = computeHint(parsed.optimalPaths, payload.pathHistory);

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
