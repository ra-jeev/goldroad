/**
 * Zod validators for the GoldRoad server.
 *
 * API payload validators are imported from shared/validators/game.ts (the source of truth).
 * Database table validators are derived from Drizzle schemas via drizzle-zod.
 */

import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { games } from './schema'
import {
  BoardSchema,
  EdgePairSchema,
  PathResultSchema,
  HintResultSchema,
  PublicGameSchema,
  PastGameSummarySchema,
  SessionEndPayloadSchema,
  HintRequestPayloadSchema,
} from '../../shared/validators/game'
import type { SessionEndPayload, HintRequestPayload } from '../../shared/validators/game'

// Re-export shared validators (source of truth for domain shapes)
export {
  BoardSchema,
  EdgePairSchema,
  PathResultSchema,
  HintResultSchema,
  PublicGameSchema,
  PastGameSummarySchema,
  SessionEndPayloadSchema,
  HintRequestPayloadSchema,
}

export type { SessionEndPayload, HintRequestPayload }

// ---------------------------------------------------------------------------
// Database table validators (derived from Drizzle)
// ---------------------------------------------------------------------------

/**
 * Validator for boardJson field: string that must contain valid JSON
 * matching the Board schema (1-D tile values, edges, start/end indexes).
 */
const boardJsonValidator = z.string().refine(
  (val) => {
    try {
      const parsed = JSON.parse(val)
      return BoardSchema.safeParse(parsed).success
    } catch {
      return false
    }
  },
  { message: 'boardJson must be valid JSON conforming to Board schema' },
)

/**
 * Validator for optimalPathJson field: string that must contain valid JSON
 * representing an array of tile indexes (the gold route path).
 */
const optimalPathJsonValidator = z.string().refine(
  (val) => {
    try {
      const parsed = JSON.parse(val)
      // Path is an ordered array of tile indexes
      return z.array(z.number().int().min(0)).safeParse(parsed).success
    } catch {
      return false
    }
  },
  { message: 'optimalPathJson must be valid JSON array of tile indexes' },
)

export const insertGameSchema = createInsertSchema(games, {
  gameNo:          s => s.positive(),
  maxScore:        s => s.positive(),
  totalCoins:      s => s.positive(),
  boardJson:       () => boardJsonValidator,
  optimalPathJson: () => optimalPathJsonValidator,
  playableAt:      s => z.iso.datetime({ offset: true }),
})

export const selectGameSchema = createSelectSchema(games, {
  boardJson:       s => s.transform((val) => {
    try {
      return BoardSchema.parse(JSON.parse(val))
    } catch (e) {
      throw new Error(`Failed to parse boardJson from database: ${e instanceof Error ? e.message : String(e)}`)
    }
  }),
  optimalPathJson: s => s.transform((val) => {
    try {
      return z.array(z.number().int().min(0)).parse(JSON.parse(val))
    } catch (e) {
      throw new Error(`Failed to parse optimalPathJson from database: ${e instanceof Error ? e.message : String(e)}`)
    }
  }),
})

export type InsertGame = z.infer<typeof insertGameSchema>
export type SelectGame = z.infer<typeof selectGameSchema>

