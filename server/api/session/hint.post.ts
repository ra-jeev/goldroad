import { and, eq, sql } from 'drizzle-orm';
import { dailyGameStats, games, playerGameSession } from '../../db/schema';
import { useDb } from '../../db/client';
import { HintRequestPayloadSchema } from '../../db/validators';
import { computeHint } from '../../utils/hints';
import { parseHintGameRow } from '../../utils/apiGames';

export default defineEventHandler(async (event) => {
  const db = useDb(event);
  const body = await readBody(event);
  const payload = HintRequestPayloadSchema.parse(body);

  const rows = await db
    .select({
      maxScore: games.maxScore,
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
    throw createError({
      statusCode: 404,
      statusMessage: `Game ${payload.gameNo} not found`,
    });
  }

  const parsed = parseHintGameRow(row);
  const hint = computeHint(parsed.optimalPaths, payload.pathHistory);
  const startedAt = new Date().toISOString();
  const attemptsBeforeFirstHint = Math.max(0, payload.attemptNumber - 1);
  const firstHintMoveIndex = Math.max(0, payload.pathHistory.length - 1);

  await db
    .insert(playerGameSession)
    .values({
      playerId: payload.playerUUID,
      gameNo: payload.gameNo,
      puzzleType: payload.puzzleType,
      sessionId: payload.sessionId,
      startedAt,
      attempts: payload.attemptNumber,
      maxScore: row.maxScore,
      completed: false,
      gold: false,
      hintsUsed: 1,
      attemptsBeforeFirstHint,
      firstHintMoveIndex,
      pastRoadViewed: false,
    })
    .onConflictDoUpdate({
      target: playerGameSession.sessionId,
      set: {
        attempts: payload.attemptNumber,
        hintsUsed: sql`${playerGameSession.hintsUsed} + 1`,
        attemptsBeforeFirstHint: sql`COALESCE(${playerGameSession.attemptsBeforeFirstHint}, ${attemptsBeforeFirstHint})`,
        firstHintMoveIndex: sql`COALESCE(${playerGameSession.firstHintMoveIndex}, ${firstHintMoveIndex})`,
      },
    });

  await db
    .insert(dailyGameStats)
    .values({
      gameNo: payload.gameNo,
      puzzleType: payload.puzzleType,
      hintUses: 1,
    })
    .onConflictDoUpdate({
      target: [dailyGameStats.gameNo, dailyGameStats.puzzleType],
      set: {
        hintUses: sql`${dailyGameStats.hintUses} + 1`,
        updatedAt: sql`(datetime('now'))`,
      },
    });

  return {
    ok: true,
    hint,
  };
});
