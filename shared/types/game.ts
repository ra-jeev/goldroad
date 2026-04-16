/**
 * Core game types — derived from shared/validators/game.ts validators.
 * Types are the source of truth via Zod schemas; TS types are inferred.
 */

import type { EdgeType } from '../validators/game'

export type {
  Direction,
  EdgeType,
  Medal,
  OutcomeTier,
  DifficultyBand,
  PuzzleType,
  EdgePair,
  Board,
  PathResult,
  HintLevel1Result,
  HintLevel2Result,
  HintLevel3Result,
  HintResult,
  PublicGame,
  CurrentGamesResponse,
  PastGameSummary,
  SessionEndPayload,
  HintRequestPayload,
} from '../validators/game'

/**
 * Fast O(1) edge-type lookup built from Board.blocked/toll/bonus.
 * Key format: "{fromId}->{toId}". Both directions are stored.
 * (Runtime utility, not validated)
 */
export type EdgeMap = Map<string, EdgeType>
