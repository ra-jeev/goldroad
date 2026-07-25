/**
 * Core game types — derived from shared/validators/game.ts validators.
 * Types are the source of truth via Zod schemas; TS types are inferred.
 */

import type { EdgeType } from '../validators/game';

export type {
  Direction,
  EdgeType,
  Medal,
  OutcomeTier,
  PuzzleType,
  RunEndReason,
  EdgePair,
  Board,
  PathResult,
  HintNextStepResult,
  HintDivergedResult,
  HintAlreadySolvedResult,
  HintResult,
  PublicGame,
  CurrentGamesResponse,
  CommunityBehaviorStats,
  CommunityRoadStats,
  StatsRoadDay,
  StatsOverview,
  SessionStartPayload,
  SessionEndPayload,
  HintRequestPayload,
} from '../validators/game';

/**
 * Fast O(1) edge-type lookup built from Board.missingEdges/tollEdges/bonusEdges.
 * Key format: "{fromId}->{toId}". Both directions are stored.
 * (Runtime utility, not validated)
 */
export type EdgeMap = Map<string, EdgeType>;
