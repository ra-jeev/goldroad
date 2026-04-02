/**
 * Domain validators (Zod schemas) for GoldRoad — the source of truth.
 *
 * These define the exact shape and constraints of all core domain objects.
 * TypeScript types are derived from these validators using z.infer<>.
 *
 * This approach ensures types, validation, and API contracts stay in perfect sync.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Primitives & enums
// ---------------------------------------------------------------------------

export const DirectionSchema = z.enum(['top', 'bottom', 'left', 'right'])

export const EdgeTypeSchema = z.enum(['blocked', 'cost', 'bonus'])

export const OutcomeTierSchema = z.enum(['gold', 'silver', 'bronze', 'finished', 'unfinished'])

export const DifficultyBandSchema = z.enum(['easy', 'medium', 'hard'])

// ---------------------------------------------------------------------------
// Shared board model
// ---------------------------------------------------------------------------

export const EdgePairSchema = z.object({
  from: z.number().int().min(0),
  to: z.number().int().min(0),
})

export const BoardSchema = z.object({
  rows: z.number().int().min(3).max(10),
  cols: z.number().int().min(3).max(10),
  tiles: z.array(z.number().int().min(1).max(6)),
  blocked: z.array(EdgePairSchema),
  cost: z.array(EdgePairSchema),
  bonus: z.array(EdgePairSchema),
  costValue: z.number().int().min(1).default(1),
  bonusValue: z.number().int().min(1).default(1),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
})

// ---------------------------------------------------------------------------
// Path finding
// ---------------------------------------------------------------------------

export const PathResultSchema = z.object({
  total: z.number().int().min(1),
  moves: z.number().int().min(1),
  path: z.array(z.number().int().min(0)).min(1),
})

// ---------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------

export const HintLevel1ResultSchema = z.object({
  level: z.literal(1),
  direction: DirectionSchema,
  fromTileIndex: z.number().int().min(0),
})

export const HintLevel2ResultSchema = z.object({
  level: z.literal(2),
  tileIndexes: z.array(z.number().int().min(0)).min(2).max(3),
})

export const HintLevel3ResultSchema = z.object({
  level: z.literal(3),
  nextTileIndex: z.number().int().min(0),
})

export const HintResultSchema = z.union([
  HintLevel1ResultSchema,
  HintLevel2ResultSchema,
  HintLevel3ResultSchema,
])

// ---------------------------------------------------------------------------
// Public game data (sent to client)
// ---------------------------------------------------------------------------

export const PublicGameSchema = z.object({
  gameNo: z.number().int().positive(),
  board: BoardSchema,
  maxScore: z.number().int().min(1),
  totalCoins: z.number().int().min(1),
  difficultyBand: DifficultyBandSchema,
  playableAt: z.string().datetime({ offset: true }),
  nextGameAt: z.string().datetime({ offset: true }).nullable(),
})

export const PastGameSummarySchema = z.object({
  gameNo: z.number().int().positive(),
  maxScore: z.number().int().min(1),
  totalCoins: z.number().int().min(1),
  playableAt: z.string().datetime({ offset: true }),
})

// ---------------------------------------------------------------------------
// API payloads
// ---------------------------------------------------------------------------

export const SessionEndPayloadSchema = z.object({
  playerUUID: z.string().uuid(),
  gameNo: z.number().int().positive(),
  sessionId: z.string().uuid(),
  score: z.number().int().min(0),
  moves: z.number().int().min(0),
  attempts: z.number().int().positive(),
  tier: OutcomeTierSchema,
  hintsLevel1: z.number().int().min(0).default(0),
  hintsLevel2: z.number().int().min(0).default(0),
  hintsLevel3: z.number().int().min(0).default(0),
})

export const HintRequestPayloadSchema = z.object({
  playerUUID: z.string().uuid(),
  gameNo: z.number().int().positive(),
  sessionId: z.string().uuid(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  currentTileIndex: z.number().int().min(0),
})

// ---------------------------------------------------------------------------
// Database result types (inferred from validators)
// ---------------------------------------------------------------------------

export type Direction = z.infer<typeof DirectionSchema>
export type EdgeType = z.infer<typeof EdgeTypeSchema>
export type OutcomeTier = z.infer<typeof OutcomeTierSchema>
export type DifficultyBand = z.infer<typeof DifficultyBandSchema>

export type EdgePair = z.infer<typeof EdgePairSchema>
export type Board = z.infer<typeof BoardSchema>

export type PathResult = z.infer<typeof PathResultSchema>

export type HintLevel1Result = z.infer<typeof HintLevel1ResultSchema>
export type HintLevel2Result = z.infer<typeof HintLevel2ResultSchema>
export type HintLevel3Result = z.infer<typeof HintLevel3ResultSchema>
export type HintResult = z.infer<typeof HintResultSchema>

export type PublicGame = z.infer<typeof PublicGameSchema>
export type PastGameSummary = z.infer<typeof PastGameSummarySchema>

export type SessionEndPayload = z.infer<typeof SessionEndPayloadSchema>
export type HintRequestPayload = z.infer<typeof HintRequestPayloadSchema>
