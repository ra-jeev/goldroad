import { and, eq, sql } from 'drizzle-orm';
import { calcMedalForAttempt } from '../../../lib/gameTiers';
import { dailyGameStats, games, playerGameSession } from '../../db/schema';
import { useDb } from '../../db/client';
import { SessionEndPayloadSchema } from '../../db/validators';

export default defineEventHandler(async (event) => {
  const db = useDb(event);
  const body = await readBody(event);
  const payload = SessionEndPayloadSchema.parse(body);

  const gameRows = await db
    .select({
      gameNo: games.gameNo,
      puzzleType: games.puzzleType,
      maxScore: games.maxScore,
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
    throw createError({
      statusCode: 404,
      statusMessage: `Game ${payload.gameNo} not found`,
    });
  }

  const medal = calcMedalForAttempt(payload.attemptNumber, payload.solved);
  const finishedAt = new Date().toISOString();
  const completed = payload.solved;
  const isGold = medal === 'gold';
  const outcomeTier = medal ?? (completed ? 'finished' : 'unfinished');
  const deadEndDelta = payload.endReason === 'dead-end' ? 1 : 0;
  const wrongExitDelta = payload.endReason === 'wrong-exit' ? 1 : 0;

  await db
    .insert(playerGameSession)
    .values({
      playerId: payload.playerUUID,
      gameNo: payload.gameNo,
      puzzleType: payload.puzzleType,
      sessionId: payload.sessionId,
      startedAt: finishedAt,
      finishedAt,
      attempts: payload.attemptNumber,
      maxScore: game.maxScore,
      outcomeTier,
      completed,
      gold: isGold,
      hintsUsed: payload.hintsUsed,
      deadEndCount: deadEndDelta,
      wrongExitCount: wrongExitDelta,
      pastRoadViewed: false,
    })
    .onConflictDoUpdate({
      target: playerGameSession.sessionId,
      set: {
        finishedAt,
        attempts: payload.attemptNumber,
        outcomeTier,
        completed,
        gold: isGold,
        hintsUsed: sql`MAX(${playerGameSession.hintsUsed}, ${payload.hintsUsed})`,
        deadEndCount: sql`${playerGameSession.deadEndCount} + ${deadEndDelta}`,
        wrongExitCount: sql`${playerGameSession.wrongExitCount} + ${wrongExitDelta}`,
      },
    });

  await db
    .update(games)
    .set({
      playsCount: sql`${games.playsCount} + 1`,
      goldCount:
        medal === 'gold' ? sql`${games.goldCount} + 1` : games.goldCount,
      silverCount:
        medal === 'silver' ? sql`${games.silverCount} + 1` : games.silverCount,
      bronzeCount:
        medal === 'bronze' ? sql`${games.bronzeCount} + 1` : games.bronzeCount,
      finishedCount: completed
        ? sql`${games.finishedCount} + 1`
        : games.finishedCount,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(
      and(
        eq(games.gameNo, payload.gameNo),
        eq(games.puzzleType, payload.puzzleType),
      ),
    );

  await db
    .insert(dailyGameStats)
    .values({
      gameNo: payload.gameNo,
      puzzleType: payload.puzzleType,
      plays: 1,
      completions: completed ? 1 : 0,
      goldCompletions: medal === 'gold' ? 1 : 0,
      silverCompletions: medal === 'silver' ? 1 : 0,
      bronzeCompletions: medal === 'bronze' ? 1 : 0,
      totalAttempts: 1,
      deadEndCount: deadEndDelta,
      wrongExitCount: wrongExitDelta,
      completionRate: completed ? 100 : 0,
      pastRoadsOpened: 0,
      updatedAt: sql`(datetime('now'))`,
    })
    .onConflictDoUpdate({
      target: [dailyGameStats.gameNo, dailyGameStats.puzzleType],
      set: {
        plays: sql`${dailyGameStats.plays} + 1`,
        completions: completed
          ? sql`${dailyGameStats.completions} + 1`
          : dailyGameStats.completions,
        goldCompletions:
          medal === 'gold'
            ? sql`${dailyGameStats.goldCompletions} + 1`
            : dailyGameStats.goldCompletions,
        silverCompletions:
          medal === 'silver'
            ? sql`${dailyGameStats.silverCompletions} + 1`
            : dailyGameStats.silverCompletions,
        bronzeCompletions:
          medal === 'bronze'
            ? sql`${dailyGameStats.bronzeCompletions} + 1`
            : dailyGameStats.bronzeCompletions,
        totalAttempts: sql`${dailyGameStats.totalAttempts} + 1`,
        deadEndCount: sql`${dailyGameStats.deadEndCount} + ${deadEndDelta}`,
        wrongExitCount: sql`${dailyGameStats.wrongExitCount} + ${wrongExitDelta}`,
        completionRate: sql`ROUND(((CAST(${dailyGameStats.completions} + ${completed ? 1 : 0} AS REAL)) / (${dailyGameStats.plays} + 1)) * 100, 2)`,
        updatedAt: sql`(datetime('now'))`,
      },
    });

  return {
    ok: true,
    gameNo: payload.gameNo,
    medal,
    score: payload.score,
    solved: payload.solved,
  };
});
