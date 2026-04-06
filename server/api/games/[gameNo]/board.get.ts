import { and, eq } from 'drizzle-orm'
import { games } from '../../../db/schema'
import { useDb } from '../../../db/client'
import { parsePublicGameRow } from '../../../utils/apiGames'

export default defineEventHandler(async (event) => {
  const db = useDb(event)

  const gameNoRaw = getRouterParam(event, 'gameNo')
  const gameNo = Number.parseInt(gameNoRaw ?? '', 10)
  if (!Number.isInteger(gameNo) || gameNo <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid gameNo param' })
  }

  const rows = await db
    .select({
      gameNo: games.gameNo,
      boardJson: games.boardJson,
      maxScore: games.maxScore,
      totalCoins: games.totalCoins,
      difficultyBand: games.difficultyBand,
      playableAt: games.playableAt,
      nextGameAt: games.nextGameAt,
    })
    .from(games)
    .where(and(eq(games.gameNo, gameNo), eq(games.active, true)))
    .limit(1)

  const row = rows[0]
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: `Game ${gameNo} not found` })
  }

  const game = parsePublicGameRow(row)
  return {
    gameNo: game.gameNo,
    board: game.board,
    maxScore: game.maxScore,
    totalCoins: game.totalCoins,
    difficultyBand: game.difficultyBand,
    playableAt: game.playableAt,
    nextGameAt: game.nextGameAt,
  }
})
