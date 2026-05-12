import { and, desc, eq, inArray, lt, lte } from 'drizzle-orm';
import { games, playerRoadAnalytics } from '../../db/schema';
import { useDb } from '../../db/client';

const RECENT_POOL_SIZE = 30;

export default defineEventHandler(async (event) => {
  const db = useDb(event);
  const query = getQuery(event);
  const playerId = typeof query.playerId === 'string' ? query.playerId : null;

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

  const candidateRows = await db
    .select({ gameNo: games.gameNo })
    .from(games)
    .where(
      currentGameNo !== undefined
        ? and(eq(games.active, true), lt(games.gameNo, currentGameNo))
        : eq(games.active, true),
    )
    .groupBy(games.gameNo)
    .orderBy(desc(games.gameNo))
    .limit(RECENT_POOL_SIZE);

  if (!candidateRows.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No past game available',
    });
  }

  let candidateGameNos = candidateRows.map((row) => row.gameNo);

  if (playerId) {
    const playedRows = await db
      .select({ gameNo: playerRoadAnalytics.gameNo })
      .from(playerRoadAnalytics)
      .where(
        and(
          eq(playerRoadAnalytics.playerId, playerId),
          inArray(playerRoadAnalytics.gameNo, candidateGameNos),
        ),
      );

    const playedSet = new Set(playedRows.map((row) => row.gameNo));
    const unplayedGameNos = candidateGameNos.filter(
      (gameNo) => !playedSet.has(gameNo),
    );
    if (unplayedGameNos.length) {
      candidateGameNos = unplayedGameNos;
    }
  }

  const randomIndex = Math.floor(Math.random() * candidateGameNos.length);
  const gameNo = candidateGameNos[randomIndex] ?? candidateGameNos[0];

  if (gameNo === undefined) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No game available in candidate pool',
    });
  }

  return { gameNo };
});
