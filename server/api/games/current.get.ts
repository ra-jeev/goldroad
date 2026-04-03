import { and, eq, lte } from 'drizzle-orm'
import { games } from '../../db/schema'
import { useDb } from '../../db/client'
import { parseGameRow } from '../../utils/apiGames'

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const nowIso = new Date().toISOString()

  const rows = await db
    .select({
      gameNo: games.gameNo,
      boardJson: games.boardJson,
      optimalPathJson: games.optimalPathJson,
      maxScore: games.maxScore,
      totalCoins: games.totalCoins,
      difficultyBand: games.difficultyBand,
      playableAt: games.playableAt,
      nextGameAt: games.nextGameAt,
      routeCount: games.routeCount,
      goldSilverGap: games.goldSilverGap,
    })
    .from(games)
    .where(and(eq(games.active, true), eq(games.current, true), lte(games.playableAt, nowIso)))
    .limit(1)

  const current = rows[0]
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'No current game available' })
  }

  const game = parseGameRow(current)
  return {
    gameNo: game.gameNo,
    board: game.board,
    maxScore: game.maxScore,
    totalCoins: game.totalCoins,
    difficultyBand: game.difficultyBand,
    playableAt: game.playableAt,
    nextGameAt: game.nextGameAt,
    routeCount: game.routeCount,
    goldSilverGap: game.goldSilverGap,
  }
})
