/**
 * Domain validators (Zod schemas) for GoldRoad — the source of truth.
 *
 * These define the exact shape and constraints of all core domain objects.
 * TypeScript types are derived from these validators using z.infer<>.
 *
 * This approach ensures types, validation, and API contracts stay in perfect sync.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives & enums
// ---------------------------------------------------------------------------

export const DirectionSchema = z.enum(['top', 'bottom', 'left', 'right']);

export const EdgeTypeSchema = z.enum(['missing', 'toll', 'bonus']);

export const MedalSchema = z.enum(['gold', 'silver', 'bronze']);

export const OutcomeTierSchema = z.enum([
  'gold',
  'silver',
  'bronze',
  'finished',
  'unfinished',
]);

export const DifficultyBandSchema = z.enum(['easy', 'medium', 'hard']);

export const PuzzleTypeSchema = z.enum(['classic', 'expedition']);

export const RunEndReasonSchema = z.enum([
  'solved',
  'wrong-exit',
  'dead-end',
  'retry',
]);

// ---------------------------------------------------------------------------
// Shared board model
// ---------------------------------------------------------------------------

export const EdgePairSchema = z.object({
  from: z.number().int().min(0),
  to: z.number().int().min(0),
});

function normalizedEdgeKey(from: number, to: number): string {
  return from < to ? `${from}:${to}` : `${to}:${from}`;
}

function isAdjacentEdge(from: number, to: number, cols: number): boolean {
  const fromRow = Math.floor(from / cols);
  const fromCol = from % cols;
  const toRow = Math.floor(to / cols);
  const toCol = to % cols;
  return Math.abs(fromRow - toRow) + Math.abs(fromCol - toCol) === 1;
}

export const BoardSchema = z
  .object({
    rows: z.number().int().min(3).max(10),
    cols: z.number().int().min(3).max(10),
    tiles: z.array(z.number().int().min(1).max(6)),
    missingEdges: z.array(EdgePairSchema),
    tollEdges: z.array(EdgePairSchema),
    bonusEdges: z.array(EdgePairSchema),
    tollValue: z.number().int().min(1).default(1),
    bonusValue: z.number().int().min(1).default(1),
    start: z.number().int().min(0),
    end: z.number().int().min(0),
  })
  .superRefine((board, ctx) => {
    const tileCount = board.rows * board.cols;

    if (board.tiles.length !== tileCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tiles'],
        message: `tiles must contain exactly ${tileCount} values for a ${board.rows}x${board.cols} board`,
      });
    }

    if (board.start >= tileCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['start'],
        message: 'start must be a valid tile index within board bounds',
      });
    }

    if (board.end >= tileCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: 'end must be a valid tile index within board bounds',
      });
    }

    if (board.start === board.end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: 'start and end must be different tiles',
      });
    }

    const edgeGroups = [
      ['missingEdges', board.missingEdges],
      ['tollEdges', board.tollEdges],
      ['bonusEdges', board.bonusEdges],
    ] as const;

    const seen = new Map<string, string>();

    for (const [groupName, edges] of edgeGroups) {
      edges.forEach((edge, index) => {
        if (edge.from >= tileCount || edge.to >= tileCount) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [groupName, index],
            message:
              'edge endpoints must be valid tile indexes within board bounds',
          });
        }

        if (edge.from === edge.to) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [groupName, index],
            message: 'edge endpoints must be different tiles',
          });
        }

        if (!isAdjacentEdge(edge.from, edge.to, board.cols)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [groupName, index],
            message: 'edges must connect orthogonally adjacent tiles only',
          });
        }

        const key = normalizedEdgeKey(edge.from, edge.to);
        const existingGroup = seen.get(key);
        if (existingGroup) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [groupName, index],
            message: `edge overlaps with an existing ${existingGroup} edge`,
          });
        } else {
          seen.set(key, groupName);
        }
      });
    }
  });

// ---------------------------------------------------------------------------
// Path finding
// ---------------------------------------------------------------------------

export const PathResultSchema = z.object({
  total: z.number().int().min(1),
  moves: z.number().int().min(1),
  path: z.array(z.number().int().min(0)).min(1),
});

// ---------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------

export const HintNextStepResultSchema = z.object({
  kind: z.literal('next-step'),
  nextTileIndex: z.number().int().min(0),
  guidePath: z.array(z.number().int().min(0)).min(2),
});

export const HintDivergedResultSchema = z.object({
  kind: z.literal('diverged'),
  divergenceTileIndex: z.number().int().min(0),
  correctTileIndex: z.number().int().min(0),
  guidePath: z.array(z.number().int().min(0)).min(2),
});

export const HintAlreadySolvedResultSchema = z.object({
  kind: z.literal('already-solved'),
  guidePath: z.array(z.number().int().min(0)).min(1),
});

export const HintResultSchema = z.union([
  HintNextStepResultSchema,
  HintDivergedResultSchema,
  HintAlreadySolvedResultSchema,
]);

// ---------------------------------------------------------------------------
// Public game data (sent to client)
// ---------------------------------------------------------------------------

export const PublicGameSchema = z.object({
  gameNo: z.number().int().positive(),
  puzzleType: PuzzleTypeSchema,
  board: BoardSchema,
  maxScore: z.number().int().min(1),
  totalCoins: z.number().int().min(1),
  difficultyBand: DifficultyBandSchema,
  playableAt: z.string().datetime({ offset: true }),
  nextGameAt: z.string().datetime({ offset: true }).nullable(),
});

export const CurrentGamesResponseSchema = z.object({
  classic: PublicGameSchema.nullable(),
  expedition: PublicGameSchema.nullable(),
});

export const CommunityBehaviorStatsSchema = z.object({
  hintUsers: z.number().int().min(0),
  totalHints: z.number().int().min(0),
  hintUseRate: z.number().min(0).max(100),
  averageAttemptsBeforeFirstHint: z.number().nullable(),
  averageFirstHintMoveIndex: z.number().nullable(),
  averageDeadEndCount: z.number().nullable(),
  averageWrongExitCount: z.number().nullable(),
  averageSolveTimeMs: z.number().nullable(),
});

export const CommunityRoadStatsSchema = z.object({
  gameNo: z.number().int().positive(),
  puzzleType: PuzzleTypeSchema,
  plays: z.number().int().min(0),
  exactSolves: z.number().int().min(0),
  solveRate: z.number().min(0).max(100),
  gold: z.number().int().min(0),
  silver: z.number().int().min(0),
  bronze: z.number().int().min(0),
  behavior: CommunityBehaviorStatsSchema,
});

export const StatsRoadDaySchema = z.object({
  gameNo: z.number().int().positive().nullable(),
  classic: CommunityRoadStatsSchema.nullable(),
  expedition: CommunityRoadStatsSchema.nullable(),
});

// Community stats are only reported for the previous, completed road —
// there are no dynamic community stats for the in-progress road (July 2026
// experience-review decision). `currentGameNo` identifies today's road so
// clients can key their own local result against it.
export const StatsOverviewSchema = z.object({
  currentGameNo: z.number().int().positive().nullable(),
  yesterday: StatsRoadDaySchema,
});

// ---------------------------------------------------------------------------
// API payloads
// ---------------------------------------------------------------------------

export const SessionEndPayloadSchema = z
  .object({
    playerUUID: z.string().uuid(),
    gameNo: z.number().int().positive(),
    puzzleType: PuzzleTypeSchema,
    sessionId: z.string().uuid(),
    score: z.number().int().min(0),
    moves: z.number().int().min(0),
    attemptNumber: z.number().int().positive(),
    solved: z.boolean(),
    endReason: RunEndReasonSchema,
    hintsUsed: z.number().int().min(0).default(0),
    solveTimeMs: z.number().int().min(0).nullable().optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.solved && payload.endReason !== 'solved') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endReason'],
        message: 'solved runs must use the solved endReason',
      });
    }

    if (!payload.solved && payload.endReason === 'solved') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endReason'],
        message: 'unsolved runs cannot use the solved endReason',
      });
    }
  });

export const HintRequestPayloadSchema = z.object({
  playerUUID: z.string().uuid(),
  gameNo: z.number().int().positive(),
  puzzleType: PuzzleTypeSchema,
  sessionId: z.string().uuid(),
  attemptNumber: z.number().int().positive(),
  pathHistory: z.array(z.number().int().min(0)).min(1),
});

// ---------------------------------------------------------------------------
// Database result types (inferred from validators)
// ---------------------------------------------------------------------------

export type Direction = z.infer<typeof DirectionSchema>;
export type EdgeType = z.infer<typeof EdgeTypeSchema>;
export type Medal = z.infer<typeof MedalSchema>;
export type OutcomeTier = z.infer<typeof OutcomeTierSchema>;
export type DifficultyBand = z.infer<typeof DifficultyBandSchema>;
export type PuzzleType = z.infer<typeof PuzzleTypeSchema>;
export type RunEndReason = z.infer<typeof RunEndReasonSchema>;

export type EdgePair = z.infer<typeof EdgePairSchema>;
export type Board = z.infer<typeof BoardSchema>;

export type PathResult = z.infer<typeof PathResultSchema>;

export type HintNextStepResult = z.infer<typeof HintNextStepResultSchema>;
export type HintDivergedResult = z.infer<typeof HintDivergedResultSchema>;
export type HintAlreadySolvedResult = z.infer<
  typeof HintAlreadySolvedResultSchema
>;
export type HintResult = z.infer<typeof HintResultSchema>;

export type PublicGame = z.infer<typeof PublicGameSchema>;
export type CurrentGamesResponse = z.infer<typeof CurrentGamesResponseSchema>;
export type CommunityBehaviorStats = z.infer<
  typeof CommunityBehaviorStatsSchema
>;
export type CommunityRoadStats = z.infer<typeof CommunityRoadStatsSchema>;
export type StatsRoadDay = z.infer<typeof StatsRoadDaySchema>;
export type StatsOverview = z.infer<typeof StatsOverviewSchema>;

export type SessionEndPayload = z.infer<typeof SessionEndPayloadSchema>;
export type HintRequestPayload = z.infer<typeof HintRequestPayloadSchema>;
