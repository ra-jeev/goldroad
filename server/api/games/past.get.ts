import { and, desc, eq, lt, lte } from 'drizzle-orm';
import { games } from '../../db/schema';
import { useDb } from '../../db/client';
import { RECENT_ARCHIVE_DAY_LIMIT } from '../../../shared/utils/archive';

const DEFAULT_LIMIT = RECENT_ARCHIVE_DAY_LIMIT;

export default defineEventHandler(async (event) => {
  const db = useDb(event);
  const query = getQuery(event);

  const parsedLimit = Number.parseInt(String(query.limit ?? DEFAULT_LIMIT), 10);
  const limit = Number.isNaN(parsedLimit)
    ? DEFAULT_LIMIT
    : Math.max(1, Math.min(RECENT_ARCHIVE_DAY_LIMIT, parsedLimit));

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
    .limit(1);

  const currentGameNo = currentRows[0]?.gameNo;

  const rows = await db
    .select({
      gameNo: games.gameNo,
      puzzleType: games.puzzleType,
      maxScore: games.maxScore,
      totalCoins: games.totalCoins,
      playableAt: games.playableAt,
      difficultyBand: games.difficultyBand,
    })
    .from(games)
    .where(
      currentGameNo !== undefined
        ? and(
            eq(games.active, true),
            lte(games.playableAt, nowIso),
            lt(games.gameNo, currentGameNo),
          )
        : and(eq(games.active, true), lte(games.playableAt, nowIso)),
    )
    .orderBy(desc(games.gameNo))
    .limit(limit * 2);

  const grouped = new Map<
    number,
    {
      gameNo: number;
      playableAt: string;
      classic: {
        maxScore: number;
        totalCoins: number;
        difficultyBand: (typeof rows)[number]['difficultyBand'];
      } | null;
      expedition: {
        maxScore: number;
        totalCoins: number;
        difficultyBand: (typeof rows)[number]['difficultyBand'];
      } | null;
    }
  >();

  for (const row of rows) {
    const existing = grouped.get(row.gameNo) ?? {
      gameNo: row.gameNo,
      playableAt: row.playableAt,
      classic: null,
      expedition: null,
    };

    const modeSummary = {
      maxScore: row.maxScore,
      totalCoins: row.totalCoins,
      difficultyBand: row.difficultyBand,
    };

    if (row.puzzleType === 'classic') {
      existing.classic = modeSummary;
    } else {
      existing.expedition = modeSummary;
    }

    grouped.set(row.gameNo, existing);
  }

  const gamesList = [...grouped.values()].slice(0, limit);

  return {
    count: gamesList.length,
    games: gamesList,
  };
});
