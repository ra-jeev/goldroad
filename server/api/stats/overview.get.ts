import { and, desc, eq, lt, lte, sql } from 'drizzle-orm';
import { games, playerRoadAnalytics } from '../../db/schema';
import { useDb } from '../../db/client';
import type {
  CommunityRoadStats,
  PuzzleType,
  StatsOverview,
  StatsRoadDay,
} from '../../../shared/types/game';

type AggregatedRoadStatsRow = {
  gameNo: number;
  puzzleType: PuzzleType;
  plays: number;
  exactSolves: number;
  gold: number;
  silver: number;
  bronze: number;
  hintUsers: number;
  totalHints: number;
  averageAttemptsBeforeFirstHint: number | null;
  averageFirstHintMoveIndex: number | null;
  averageDeadEndCount: number | null;
  averageWrongExitCount: number | null;
  averageSolveTimeMs: number | null;
};

function createEmptyStatsRoadDay(gameNo: number | null): StatsRoadDay {
  return {
    gameNo,
    classic: null,
    expedition: null,
  };
}

function roundNullable(value: number | null, digits = 2): number | null {
  if (value === null || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
}

function buildEmptyCommunityRoadStats(
  gameNo: number,
  puzzleType: PuzzleType,
): CommunityRoadStats {
  return {
    gameNo,
    puzzleType,
    plays: 0,
    exactSolves: 0,
    solveRate: 0,
    gold: 0,
    silver: 0,
    bronze: 0,
    behavior: {
      hintUsers: 0,
      totalHints: 0,
      hintUseRate: 0,
      averageAttemptsBeforeFirstHint: null,
      averageFirstHintMoveIndex: null,
      averageDeadEndCount: null,
      averageWrongExitCount: null,
      averageSolveTimeMs: null,
    },
  };
}

function toCommunityRoadStats(row: AggregatedRoadStatsRow): CommunityRoadStats {
  const solveRate =
    row.plays > 0 ? Math.round((row.exactSolves / row.plays) * 100) : 0;
  const hintUseRate =
    row.plays > 0 ? Math.round((row.hintUsers / row.plays) * 100) : 0;

  return {
    gameNo: row.gameNo,
    puzzleType: row.puzzleType,
    plays: row.plays,
    exactSolves: row.exactSolves,
    solveRate,
    gold: row.gold,
    silver: row.silver,
    bronze: row.bronze,
    behavior: {
      hintUsers: row.hintUsers,
      totalHints: row.totalHints,
      hintUseRate,
      averageAttemptsBeforeFirstHint: roundNullable(
        row.averageAttemptsBeforeFirstHint,
      ),
      averageFirstHintMoveIndex: roundNullable(row.averageFirstHintMoveIndex),
      averageDeadEndCount: roundNullable(row.averageDeadEndCount),
      averageWrongExitCount: roundNullable(row.averageWrongExitCount),
      averageSolveTimeMs: roundNullable(row.averageSolveTimeMs, 0),
    },
  };
}

async function getRoadDayStats(
  db: ReturnType<typeof useDb>,
  gameNo: number,
): Promise<StatsRoadDay> {
  const [gameRows, aggregateRows] = await Promise.all([
    db
      .select({
        gameNo: games.gameNo,
        puzzleType: games.puzzleType,
      })
      .from(games)
      .where(and(eq(games.active, true), eq(games.gameNo, gameNo))),
    db
      .select({
        gameNo: playerRoadAnalytics.gameNo,
        puzzleType: playerRoadAnalytics.puzzleType,
        plays: sql<number>`COUNT(*)`,
        exactSolves: sql<number>`SUM(CASE WHEN ${playerRoadAnalytics.solved} = 1 THEN 1 ELSE 0 END)`,
        gold: sql<number>`SUM(CASE WHEN ${playerRoadAnalytics.solved} = 1 AND ${playerRoadAnalytics.attempts} = 1 THEN 1 ELSE 0 END)`,
        silver: sql<number>`SUM(CASE WHEN ${playerRoadAnalytics.solved} = 1 AND ${playerRoadAnalytics.attempts} = 2 THEN 1 ELSE 0 END)`,
        bronze: sql<number>`SUM(CASE WHEN ${playerRoadAnalytics.solved} = 1 AND ${playerRoadAnalytics.attempts} = 3 THEN 1 ELSE 0 END)`,
        hintUsers: sql<number>`SUM(CASE WHEN ${playerRoadAnalytics.hintsUsed} > 0 THEN 1 ELSE 0 END)`,
        totalHints: sql<number>`COALESCE(SUM(${playerRoadAnalytics.hintsUsed}), 0)`,
        averageAttemptsBeforeFirstHint: sql<
          number | null
        >`AVG(${playerRoadAnalytics.attemptsBeforeFirstHint})`,
        averageFirstHintMoveIndex: sql<
          number | null
        >`AVG(${playerRoadAnalytics.firstHintMoveIndex})`,
        averageDeadEndCount: sql<
          number | null
        >`AVG(${playerRoadAnalytics.deadEndCount})`,
        averageWrongExitCount: sql<
          number | null
        >`AVG(${playerRoadAnalytics.wrongExitCount})`,
        averageSolveTimeMs: sql<
          number | null
        >`AVG(${playerRoadAnalytics.solveTimeMs})`,
      })
      .from(playerRoadAnalytics)
      .where(eq(playerRoadAnalytics.gameNo, gameNo))
      .groupBy(playerRoadAnalytics.gameNo, playerRoadAnalytics.puzzleType),
  ]);

  const roadDay = createEmptyStatsRoadDay(gameNo);

  for (const row of gameRows) {
    roadDay[row.puzzleType] = buildEmptyCommunityRoadStats(
      row.gameNo,
      row.puzzleType,
    );
  }

  for (const row of aggregateRows as AggregatedRoadStatsRow[]) {
    roadDay[row.puzzleType] = toCommunityRoadStats(row);
  }

  return roadDay;
}

export default defineEventHandler(async (event): Promise<StatsOverview> => {
  const db = useDb(event);
  const nowIso = new Date().toISOString();

  const currentRows = await db
    .select({ gameNo: games.gameNo })
    .from(games)
    .where(
      and(
        eq(games.active, true),
        eq(games.current, true),
        lte(games.playableAt, nowIso),
      ),
    )
    .orderBy(desc(games.gameNo))
    .limit(1);

  const currentGameNo = currentRows[0]?.gameNo ?? null;

  let yesterdayGameNo: number | null = null;
  if (currentGameNo !== null) {
    const yesterdayRows = await db
      .select({ gameNo: games.gameNo })
      .from(games)
      .where(and(eq(games.active, true), lt(games.gameNo, currentGameNo)))
      .orderBy(desc(games.gameNo))
      .limit(1);

    yesterdayGameNo = yesterdayRows[0]?.gameNo ?? null;
  }

  const [current, yesterday] = await Promise.all([
    currentGameNo !== null
      ? getRoadDayStats(db, currentGameNo)
      : Promise.resolve(createEmptyStatsRoadDay(null)),
    yesterdayGameNo !== null
      ? getRoadDayStats(db, yesterdayGameNo)
      : Promise.resolve(createEmptyStatsRoadDay(null)),
  ]);

  return {
    current,
    yesterday,
  };
});
