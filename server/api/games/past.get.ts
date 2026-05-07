import { and, desc, eq, lt } from 'drizzle-orm';
import { games } from '../../db/schema';
import { useDb } from '../../db/client';

const DEFAULT_LIMIT = 30;

export default defineEventHandler(async (event) => {
  const db = useDb(event);
  const query = getQuery(event);

  const parsedLimit = Number.parseInt(String(query.limit ?? DEFAULT_LIMIT), 10);
  const limit = Number.isNaN(parsedLimit)
    ? DEFAULT_LIMIT
    : Math.max(1, Math.min(100, parsedLimit));

  const currentRows = await db
    .select({ gameNo: games.gameNo })
    .from(games)
    .where(eq(games.current, true))
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
        ? and(eq(games.active, true), lt(games.gameNo, currentGameNo))
        : eq(games.active, true),
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
