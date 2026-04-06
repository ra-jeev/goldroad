import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import { games, playerGameSession } from '../../db/schema'
import { useDb } from '../../db/client'
import { parseGameRow } from '../../utils/apiGames'

const RECENT_POOL_SIZE = 30

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const query = getQuery(event)
  const playerId = typeof query.playerId === 'string' ? query.playerId : null

  const currentRows = await db
    .select({ gameNo: games.gameNo })
    .from(games)
    .where(eq(games.current, true))
    .limit(1)

  const currentGameNo = currentRows[0]?.gameNo

  const baseCandidates = await db
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
    .where(
      currentGameNo !== undefined
        ? and(eq(games.active, true), lt(games.gameNo, currentGameNo))
        : eq(games.active, true),
    )
    .orderBy(desc(games.gameNo))
    .limit(RECENT_POOL_SIZE)

  if (!baseCandidates.length) {
    throw createError({ statusCode: 404, statusMessage: 'No past game available' })
  }

  let candidatePool = baseCandidates

  if (playerId) {
    const gameNos = baseCandidates.map(g => g.gameNo)
    const playedRows = await db
      .select({ gameNo: playerGameSession.gameNo })
      .from(playerGameSession)
      .where(and(eq(playerGameSession.playerId, playerId), inArray(playerGameSession.gameNo, gameNos)))

    const playedSet = new Set(playedRows.map(r => r.gameNo))
    const unplayed = baseCandidates.filter(g => !playedSet.has(g.gameNo))
    if (unplayed.length) candidatePool = unplayed
  }

  const randomPick = await db
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
    .where(inArray(games.gameNo, candidatePool.map(g => g.gameNo)))
    .orderBy(sql`RANDOM()`)
    .limit(1)

  const selected = randomPick[0] ?? candidatePool[0]
  if (!selected) {
    throw createError({ statusCode: 404, statusMessage: 'No game available in candidate pool' })
  }

  const game = parseGameRow(selected)
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
