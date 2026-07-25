import { z } from 'zod'
import { BoardSchema } from '../../shared/validators/game'

/** Schema for game board endpoints (public game data) */
const PublicGameRowSchema = z.object({
  gameNo: z.number().int().positive(),
  puzzleType: z.enum(['classic', 'expedition']),
  boardJson: z.string(),
  maxScore: z.number().int().positive(),
  totalCoins: z.number().int().positive(),
  playableAt: z.string().datetime({ offset: true }),
  nextGameAt: z.string().datetime({ offset: true }).nullable(),
})

/** Schema for hint endpoint (needs optimal paths) */
const HintGameRowSchema = z.object({
  boardJson: z.string(),
  optimalPathsJson: z.string(),
})

type PublicGameRow = z.infer<typeof PublicGameRowSchema>
type HintGameRow = z.infer<typeof HintGameRowSchema>

/** Parse game row for public game endpoints (board data) */
export function parsePublicGameRow(row: PublicGameRow) {
  const parsed = PublicGameRowSchema.parse(row)
  const board = BoardSchema.parse(JSON.parse(parsed.boardJson))

  return {
    gameNo: parsed.gameNo,
    puzzleType: parsed.puzzleType,
    board,
    maxScore: parsed.maxScore,
    totalCoins: parsed.totalCoins,
    playableAt: parsed.playableAt,
    nextGameAt: parsed.nextGameAt,
  }
}

/** Parse game row for hint endpoint (needs optimal paths and board) */
export function parseHintGameRow(row: HintGameRow) {
  const parsed = HintGameRowSchema.parse(row)
  const board = BoardSchema.parse(JSON.parse(parsed.boardJson))
  const optimalPaths = z.array(z.array(z.number())).parse(JSON.parse(parsed.optimalPathsJson))

  return {
    board,
    optimalPaths,
  }
}
