import { and, desc, eq, lt } from 'drizzle-orm'
import { games } from '../../db/schema'
import { useDb } from '../../db/client'

const DEFAULT_LIMIT = 30

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const query = getQuery(event)

  const parsedLimit = Number.parseInt(String(query.limit ?? DEFAULT_LIMIT), 10)
  const limit = Number.isNaN(parsedLimit) ? DEFAULT_LIMIT : Math.max(1, Math.min(100, parsedLimit))

  const currentRows = await db
    .select({ gameNo: games.gameNo })
    .from(games)
    .where(eq(games.current, true))
    .limit(1)

  const currentGameNo = currentRows[0]?.gameNo

  const rows = await db
    .select({
      gameNo: games.gameNo,
      maxScore: games.maxScore,
      totalCoins: games.totalCoins,
      playableAt: games.playableAt,
      difficultyBand: games.difficultyBand,
    })
    .from(games)
    .where(
      currentGameNo !== undefined
        ? and(eq(games.active, true), lt(games.gameNo, currentGameNo))
        : eq(games.active, true),
    )
    .orderBy(desc(games.gameNo))
    .limit(limit)

  return {
    count: rows.length,
    games: rows,
  }
})
