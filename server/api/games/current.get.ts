import { and, eq, lte } from 'drizzle-orm'
import { games } from '../../db/schema'
import { useDb } from '../../db/client'
import { parsePublicGameRow } from '../../utils/apiGames'

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const nowIso = new Date().toISOString()

  const rows = await db
    .select({
      gameNo: games.gameNo,
      puzzleType: games.puzzleType,
      boardJson: games.boardJson,
      maxScore: games.maxScore,
      totalCoins: games.totalCoins,
      playableAt: games.playableAt,
      nextGameAt: games.nextGameAt,
    })
    .from(games)
    .where(and(eq(games.active, true), eq(games.current, true), lte(games.playableAt, nowIso)))
    .limit(2) // Fetch both current puzzles

  if (rows.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'No current games available' })
  }

  // Parse and organize by puzzle type
  const parsedGames = rows.map(row => parsePublicGameRow(row))
  
  const classic = parsedGames.find(g => g.puzzleType === 'classic')
  const expedition = parsedGames.find(g => g.puzzleType === 'expedition')

  // Return both puzzles (or null if one type is missing)
  return {
    classic: classic ? {
      gameNo: classic.gameNo,
      puzzleType: classic.puzzleType,
      board: classic.board,
      maxScore: classic.maxScore,
      totalCoins: classic.totalCoins,
      playableAt: classic.playableAt,
      nextGameAt: classic.nextGameAt,
    } : null,
    expedition: expedition ? {
      gameNo: expedition.gameNo,
      puzzleType: expedition.puzzleType,
      board: expedition.board,
      maxScore: expedition.maxScore,
      totalCoins: expedition.totalCoins,
      playableAt: expedition.playableAt,
      nextGameAt: expedition.nextGameAt,
    } : null,
  }
})
