import { and, eq, sql } from 'drizzle-orm'
import { dailyGameStats, games, playerGameSession } from '../../db/schema'
import { useDb } from '../../db/client'
import { SessionEndPayloadSchema } from '../../db/validators'

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const body = await readBody(event)
  const payload = SessionEndPayloadSchema.parse(body)

  const gameRows = await db
    .select({
      gameNo: games.gameNo,
      puzzleType: games.puzzleType,
      maxScore: games.maxScore,
    })
    .from(games)
    .where(and(
      eq(games.gameNo, payload.gameNo),
      eq(games.puzzleType, payload.puzzleType),
    ))
    .limit(1)

  const game = gameRows[0]
  if (!game) {
    throw createError({ statusCode: 404, statusMessage: `Game ${payload.gameNo} not found` })
  }

  const finishedAt = new Date().toISOString()
  const completed = payload.solvedExact
  const isGold = payload.medal === 'gold'
  const outcomeTier = payload.medal ?? (payload.reachedEnd ? 'finished' : 'unfinished')

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
      bestScore: payload.score,
      maxScore: game.maxScore,
      outcomeTier,
      completed,
      gold: isGold,
      hintsLevel1: payload.hintsLevel1,
      hintsLevel2: payload.hintsLevel2,
      hintsLevel3: payload.hintsLevel3,
      pastRoadViewed: false,
    })
    .onConflictDoUpdate({
      target: playerGameSession.sessionId,
      set: {
        finishedAt,
        attempts: payload.attemptNumber,
        bestScore: payload.score,
        outcomeTier,
        completed,
        gold: isGold,
        hintsLevel1: payload.hintsLevel1,
        hintsLevel2: payload.hintsLevel2,
        hintsLevel3: payload.hintsLevel3,
      },
    })

  await db
    .update(games)
    .set({
      playsCount: sql`${games.playsCount} + 1`,
      goldCount: payload.medal === 'gold' ? sql`${games.goldCount} + 1` : games.goldCount,
      silverCount: payload.medal === 'silver' ? sql`${games.silverCount} + 1` : games.silverCount,
      bronzeCount: payload.medal === 'bronze' ? sql`${games.bronzeCount} + 1` : games.bronzeCount,
      finishedCount: completed ? sql`${games.finishedCount} + 1` : games.finishedCount,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(and(
      eq(games.gameNo, payload.gameNo),
      eq(games.puzzleType, payload.puzzleType),
    ))

  await db
    .insert(dailyGameStats)
    .values({
      gameNo: payload.gameNo,
      puzzleType: payload.puzzleType,
      plays: 1,
      completions: completed ? 1 : 0,
      goldCompletions: payload.medal === 'gold' ? 1 : 0,
      silverCompletions: payload.medal === 'silver' ? 1 : 0,
      bronzeCompletions: payload.medal === 'bronze' ? 1 : 0,
      totalAttempts: 1,
      hintLevel1Uses: payload.hintsLevel1,
      hintLevel2Uses: payload.hintsLevel2,
      hintLevel3Uses: payload.hintsLevel3,
      completionRate: completed ? 100 : 0,
      pastRoadsOpened: 0,
      updatedAt: sql`(datetime('now'))`,
    })
    .onConflictDoUpdate({
      target: [dailyGameStats.gameNo, dailyGameStats.puzzleType],
      set: {
        plays: sql`${dailyGameStats.plays} + 1`,
        completions: completed ? sql`${dailyGameStats.completions} + 1` : dailyGameStats.completions,
        goldCompletions: payload.medal === 'gold'
          ? sql`${dailyGameStats.goldCompletions} + 1`
          : dailyGameStats.goldCompletions,
        silverCompletions: payload.medal === 'silver'
          ? sql`${dailyGameStats.silverCompletions} + 1`
          : dailyGameStats.silverCompletions,
        bronzeCompletions: payload.medal === 'bronze'
          ? sql`${dailyGameStats.bronzeCompletions} + 1`
          : dailyGameStats.bronzeCompletions,
        totalAttempts: sql`${dailyGameStats.totalAttempts} + 1`,
        hintLevel1Uses: sql`${dailyGameStats.hintLevel1Uses} + ${payload.hintsLevel1}`,
        hintLevel2Uses: sql`${dailyGameStats.hintLevel2Uses} + ${payload.hintsLevel2}`,
        hintLevel3Uses: sql`${dailyGameStats.hintLevel3Uses} + ${payload.hintsLevel3}`,
        completionRate: sql`ROUND(((CAST(${dailyGameStats.completions} + ${completed ? 1 : 0} AS REAL)) / (${dailyGameStats.plays} + 1)) * 100, 2)`,
        updatedAt: sql`(datetime('now'))`,
      },
    })

  return {
    ok: true,
    gameNo: payload.gameNo,
    medal: payload.medal,
    score: payload.score,
    solvedExact: payload.solvedExact,
    reachedEnd: payload.reachedEnd,
  }
})
