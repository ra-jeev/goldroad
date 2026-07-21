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
  SessionStartPayloadSchema,
  SessionEndPayloadSchema,
  HintRequestPayloadSchema,
} from '../../shared/validators/game'
import type { SessionStartPayload, SessionEndPayload, HintRequestPayload } from '../../shared/validators/game'

// Re-export shared validators (source of truth for domain shapes)
export {
  BoardSchema,
  EdgePairSchema,
  PathResultSchema,
  HintResultSchema,
  PublicGameSchema,
  SessionStartPayloadSchema,
  SessionEndPayloadSchema,
  HintRequestPayloadSchema,
}

export type { SessionStartPayload, SessionEndPayload, HintRequestPayload }

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
 * Validator for optimalPathsJson field: string that must contain valid JSON
 * representing an array of arrays of tile indexes (all gold route paths).
 */
const optimalPathsJsonValidator = z.string().refine(
  (val) => {
    try {
      const parsed = JSON.parse(val)
      // Array of paths, where each path is an array of tile indexes
      return z.array(z.array(z.number().int().min(0))).safeParse(parsed).success
    } catch {
      return false
    }
  },
  { message: 'optimalPathsJson must be valid JSON array of arrays of tile indexes' },
)

export const insertGameSchema = createInsertSchema(games, {
  gameNo:           s => s.positive(),
  maxScore:         s => s.positive(),
  totalCoins:       s => s.positive(),
  boardJson:        () => boardJsonValidator,
  optimalPathsJson: () => optimalPathsJsonValidator,
  playableAt:       s => z.iso.datetime({ offset: true }),
})

export const selectGameSchema = createSelectSchema(games, {
  boardJson:        s => s.transform((val) => {
    try {
      return BoardSchema.parse(JSON.parse(val))
    } catch (e) {
      throw new Error(`Failed to parse boardJson from database: ${e instanceof Error ? e.message : String(e)}`)
    }
  }),
  optimalPathsJson: s => s.transform((val) => {
    try {
      return z.array(z.array(z.number().int().min(0))).parse(JSON.parse(val))
    } catch (e) {
      throw new Error(`Failed to parse optimalPathsJson from database: ${e instanceof Error ? e.message : String(e)}`)
    }
  }),
})

export type InsertGame = z.infer<typeof insertGameSchema>
export type SelectGame = z.infer<typeof selectGameSchema>
