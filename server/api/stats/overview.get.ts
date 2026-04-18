import { and, eq, lte } from 'drizzle-orm'
import { games } from '../../db/schema'
import { useDb } from '../../db/client'
import type { CommunityRoadStats, StatsOverview } from '../../../shared/types/game'

function toCommunityRoadStats(row: {
  gameNo: number
  puzzleType: 'classic' | 'expedition'
  playsCount: number
  finishedCount: number
  goldCount: number
  silverCount: number
  bronzeCount: number
}): CommunityRoadStats {
  const solveRate = row.playsCount > 0
    ? Math.round((row.finishedCount / row.playsCount) * 100)
    : 0

  return {
    gameNo: row.gameNo,
    puzzleType: row.puzzleType,
    plays: row.playsCount,
    exactSolves: row.finishedCount,
    solveRate,
    gold: row.goldCount,
    silver: row.silverCount,
    bronze: row.bronzeCount,
  }
}

export default defineEventHandler(async (event): Promise<StatsOverview> => {
  const db = useDb(event)
  const nowIso = new Date().toISOString()

  const rows = await db
    .select({
      gameNo: games.gameNo,
      puzzleType: games.puzzleType,
      playsCount: games.playsCount,
      finishedCount: games.finishedCount,
      goldCount: games.goldCount,
      silverCount: games.silverCount,
      bronzeCount: games.bronzeCount,
    })
    .from(games)
    .where(and(eq(games.active, true), eq(games.current, true), lte(games.playableAt, nowIso)))
    .limit(2)

  const current: StatsOverview['current'] = {
    classic: null,
    expedition: null,
  }

  for (const row of rows) {
    current[row.puzzleType] = toCommunityRoadStats(row)
  }

  return { current }
})