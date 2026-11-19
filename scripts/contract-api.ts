import type { z } from 'zod';
import { calcMedalForAttempt } from '../lib/gameTiers';
import { MIN_CLIENT_VERSION } from '../lib/gameConstants';
import {
  ArchiveBoardResponseSchema,
  CurrentGamesResponseSchema,
  HintRequestPayloadSchema,
  HintResponseSchema,
  PastGamesResponseSchema,
  RandomArchiveResponseSchema,
  SessionEndPayloadSchema,
  SessionEndResponseSchema,
  SessionStartPayloadSchema,
  SessionStartResponseSchema,
  StatsOverviewSchema,
  type HintResult,
  type PublicGame,
} from '../shared/validators/game';

type ArchivedRoad = PublicGame & { optimalPaths: number[][] };

export function buildAPIContract(classic: ArchivedRoad, expedition: ArchivedRoad, hint: HintResult):
  Record<string, { schema: z.ZodType; sample: unknown; io?: 'input' | 'output' }> {
  const { gameNo } = classic;
  const withoutPaths = ({ optimalPaths: _paths, ...road }: ArchivedRoad) => road;
  const summarize = ({ maxScore, totalCoins }: ArchivedRoad) => ({ maxScore, totalCoins });
  const session = {
    gameNo,
    puzzleType: classic.puzzleType,
    playerUUID: '00000000-0000-4000-8000-000000000001',
    sessionId: '00000000-0000-4000-8000-000000000002',
  };
  const attemptNumber = 1;
  const hintsUsed = 1;
  const solveTimeMs = 90000;
  return {
    'current-games': {
      schema: CurrentGamesResponseSchema,
      sample: { classic: withoutPaths(classic), expedition: withoutPaths(expedition),
        minClientVersion: MIN_CLIENT_VERSION },
    },
    'archive-board': {
      schema: ArchiveBoardResponseSchema,
      sample: { classic, expedition },
    },
    'past-games': {
      schema: PastGamesResponseSchema,
      sample: { count: 1, games: [{ gameNo, playableAt: classic.playableAt,
        classic: summarize(classic), expedition: summarize(expedition) }] },
    },
    'random-archive': { schema: RandomArchiveResponseSchema, sample: { gameNo } },
    'stats-overview': {
      schema: StatsOverviewSchema,
      sample: {
        currentGameNo: gameNo + 1,
        yesterday: {
          gameNo,
          expedition: null,
          classic: {
            gameNo, puzzleType: 'classic', plays: 2, exactSolves: 1, solveRate: 50,
            gold: 1, silver: 0, bronze: 0, solvedAttempts: { '1': 1 }, solvedAttemptsExact: { '1': 1 },
            behavior: {
              hintUsers: 1, totalHints: hintsUsed, hintUseRate: 50,
              averageAttemptsBeforeFirstHint: 1, averageFirstHintMoveIndex: 2,
              averageSolveTimeMs: solveTimeMs, bestSolveTimeMs: solveTimeMs,
            },
          },
        },
      },
    },
    'hint-request': {
      schema: HintRequestPayloadSchema, io: 'input',
      sample: { ...session, attemptNumber, pathHistory: [classic.board.start], guidePath: [] },
    },
    'hint-response': { schema: HintResponseSchema, sample: { ok: true, hint } },
    'session-start-request': { schema: SessionStartPayloadSchema, sample: session, io: 'input' },
    'session-start-response': { schema: SessionStartResponseSchema, sample: { ok: true, gameNo } },
    'session-end-request': {
      schema: SessionEndPayloadSchema, io: 'input',
      sample: { ...session, score: classic.maxScore, moves: classic.optimalPaths[0]!.length,
        attemptNumber, hintsUsed, solveTimeMs },
    },
    'session-end-response': {
      schema: SessionEndResponseSchema,
      sample: { ok: true, gameNo, score: classic.maxScore, solved: true,
        medal: calcMedalForAttempt(attemptNumber, true) },
    },
  };
}
