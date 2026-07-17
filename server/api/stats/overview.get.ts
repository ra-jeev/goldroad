import { and, desc, eq, lt, lte, sql } from 'drizzle-orm';
import { games, playerRoadAnalytics } from '../../db/schema';
import { useDb } from '../../db/client';
import type { StatsOverview, StatsRoadDay } from '../../../shared/types/game';
import {
  createEmptyStatsRoadDay,
  buildEmptyCommunityRoadStats,
  buildSolvedAttemptsDistribution,
  toCommunityRoadStats,
  type AggregatedRoadStatsRow,
  type SolvedAttemptsRow,
} from '../../utils/statsAggregation';

async function getRoadDayStats(
  db: ReturnType<typeof useDb>,
  gameNo: number,
): Promise<StatsRoadDay> {
  const [gameRows, aggregateRows, solvedAttemptRows] = await Promise.all([
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
    db
      .select({
        gameNo: playerRoadAnalytics.gameNo,
        puzzleType: playerRoadAnalytics.puzzleType,
        attempts: playerRoadAnalytics.attempts,
        count: sql<number>`COUNT(*)`,
      })
      .from(playerRoadAnalytics)
      .where(
        and(
          eq(playerRoadAnalytics.gameNo, gameNo),
          eq(playerRoadAnalytics.solved, true),
        ),
      )
      .groupBy(
        playerRoadAnalytics.gameNo,
        playerRoadAnalytics.puzzleType,
        playerRoadAnalytics.attempts,
      ),
  ]);

  const roadDay = createEmptyStatsRoadDay(gameNo);

  for (const row of gameRows) {
    roadDay[row.puzzleType] = buildEmptyCommunityRoadStats(
      row.gameNo,
      row.puzzleType,
    );
  }

  for (const row of aggregateRows as AggregatedRoadStatsRow[]) {
    const modeAttemptRows = (solvedAttemptRows as SolvedAttemptsRow[]).filter(
      (attemptRow) => attemptRow.puzzleType === row.puzzleType,
    );
    roadDay[row.puzzleType] = toCommunityRoadStats(
      row,
      buildSolvedAttemptsDistribution(modeAttemptRows),
    );
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

  // Community stats are only aggregated for the previous, completed road.
  // Today's road never gets a community aggregation (July 2026 decision).
  const yesterday =
    yesterdayGameNo !== null
      ? await getRoadDayStats(db, yesterdayGameNo)
      : createEmptyStatsRoadDay(null);

  return {
    currentGameNo,
    yesterday,
  };
});
