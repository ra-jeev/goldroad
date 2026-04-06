import { z } from 'zod'
import { BoardSchema, DifficultyBandSchema, PathResultSchema } from '../../shared/validators/game'

const RawGameRowSchema = z.object({
  gameNo: z.number().int().positive(),
  boardJson: z.string(),
  optimalPathsJson: z.string(),
  maxScore: z.number().int().positive(),
  totalCoins: z.number().int().positive(),
  difficultyBand: DifficultyBandSchema,
  playableAt: z.string().datetime({ offset: true }),
  nextGameAt: z.string().datetime({ offset: true }).nullable(),
  routeCount: z.number().int().nonnegative(),
  goldSilverGap: z.number().int().nonnegative(),
})

type RawGameRow = z.infer<typeof RawGameRowSchema>

export function parseGameRow(row: RawGameRow) {
  const parsed = RawGameRowSchema.parse(row)
  const board = BoardSchema.parse(JSON.parse(parsed.boardJson))
  const optimalPaths = z.array(z.array(z.number())).parse(JSON.parse(parsed.optimalPathsJson))

  return {
    gameNo: parsed.gameNo,
    board,
    maxScore: parsed.maxScore,
    totalCoins: parsed.totalCoins,
    difficultyBand: parsed.difficultyBand,
    playableAt: parsed.playableAt,
    nextGameAt: parsed.nextGameAt,
    routeCount: parsed.routeCount,
    goldSilverGap: parsed.goldSilverGap,
    optimalPaths,
  }
}
