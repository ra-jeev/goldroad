import { selectGameSchema } from '../db/validators'

interface RawGameRow {
  gameNo: number
  boardJson: string
  optimalPathJson: string
  maxScore: number
  totalCoins: number
  difficultyBand: 'easy' | 'medium' | 'hard'
  playableAt: string
  nextGameAt: string | null
  routeCount: number
  goldSilverGap: number
}

export function parseGameRow(row: RawGameRow) {
  const parsed = selectGameSchema.parse(row)
  return {
    gameNo: parsed.gameNo,
    board: parsed.boardJson,
    maxScore: parsed.maxScore,
    totalCoins: parsed.totalCoins,
    difficultyBand: parsed.difficultyBand,
    playableAt: parsed.playableAt,
    nextGameAt: parsed.nextGameAt,
    routeCount: parsed.routeCount,
    goldSilverGap: parsed.goldSilverGap,
    optimalPath: parsed.optimalPathJson,
  }
}
