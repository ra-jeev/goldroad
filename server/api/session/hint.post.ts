import { and, eq, sql } from 'drizzle-orm'
import { dailyGameStats, games, playerGameSession } from '../../db/schema'
import { useDb } from '../../db/client'
import { HintRequestPayloadSchema } from '../../db/validators'
import { computeHint } from '../../utils/hints'
import { parseGameRow } from '../../utils/apiGames'

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const body = await readBody(event)
  const payload = HintRequestPayloadSchema.parse(body)

  const rows = await db
    .select({
      gameNo: games.gameNo,
      boardJson: games.boardJson,
      optimalPathsJson: games.optimalPathsJson,
      maxScore: games.maxScore,
      totalCoins: games.totalCoins,
      difficultyBand: games.difficultyBand,
      playableAt: games.playableAt,
      nextGameAt: games.nextGameAt,
      routeCount: games.routeCount,
      goldSilverGap: games.goldSilverGap,
    })
    .from(games)
    .where(and(eq(games.gameNo, payload.gameNo), eq(games.active, true)))
    .limit(1)

  const row = rows[0]
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: `Game ${payload.gameNo} not found` })
  }

  const parsed = parseGameRow(row)
  const hint = computeHint(
    parsed.optimalPaths,
    payload.currentTileIndex,
    parsed.board.cols,
    payload.level,
  )

  const sessionWhere = and(
    eq(playerGameSession.sessionId, payload.sessionId),
    eq(playerGameSession.playerId, payload.playerUUID),
    eq(playerGameSession.gameNo, payload.gameNo),
  )

  if (payload.level === 1) {
    await db
      .update(playerGameSession)
      .set({ hintsLevel1: sql`${playerGameSession.hintsLevel1} + 1` })
      .where(sessionWhere)
  } else if (payload.level === 2) {
    await db
      .update(playerGameSession)
      .set({ hintsLevel2: sql`${playerGameSession.hintsLevel2} + 1` })
      .where(sessionWhere)
  } else {
    await db
      .update(playerGameSession)
      .set({ hintsLevel3: sql`${playerGameSession.hintsLevel3} + 1` })
      .where(sessionWhere)
  }

  await db
    .insert(dailyGameStats)
    .values({
      gameNo: payload.gameNo,
      hintLevel1Uses: payload.level === 1 ? 1 : 0,
      hintLevel2Uses: payload.level === 2 ? 1 : 0,
      hintLevel3Uses: payload.level === 3 ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: dailyGameStats.gameNo,
      set: {
        hintLevel1Uses: payload.level === 1 ? sql`${dailyGameStats.hintLevel1Uses} + 1` : dailyGameStats.hintLevel1Uses,
        hintLevel2Uses: payload.level === 2 ? sql`${dailyGameStats.hintLevel2Uses} + 1` : dailyGameStats.hintLevel2Uses,
        hintLevel3Uses: payload.level === 3 ? sql`${dailyGameStats.hintLevel3Uses} + 1` : dailyGameStats.hintLevel3Uses,
        updatedAt: sql`(datetime('now'))`,
      },
    })

  return {
    ok: true,
    hint,
  }
})
