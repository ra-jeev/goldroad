import { and, eq } from 'drizzle-orm';
import { games } from '../../../db/schema';
import { useDb } from '../../../db/client';
import { parsePublicGameRow } from '../../../utils/apiGames';

export default defineEventHandler(async (event) => {
  const db = useDb(event);

  const gameNoRaw = getRouterParam(event, 'gameNo');
  const gameNo = Number.parseInt(gameNoRaw ?? '', 10);
  if (!Number.isInteger(gameNo) || gameNo <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid gameNo param',
    });
  }

  const rows = await db
    .select({
      gameNo: games.gameNo,
      puzzleType: games.puzzleType,
      boardJson: games.boardJson,
      maxScore: games.maxScore,
      totalCoins: games.totalCoins,
      difficultyBand: games.difficultyBand,
      playableAt: games.playableAt,
      nextGameAt: games.nextGameAt,
    })
    .from(games)
    .where(and(eq(games.gameNo, gameNo), eq(games.active, true)))
    .limit(2);

  if (rows.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: `Game ${gameNo} not found`,
    });
  }

  const parsedGames = rows.map((row) => parsePublicGameRow(row));
  const classic = parsedGames.find((entry) => entry.puzzleType === 'classic');
  const expedition = parsedGames.find(
    (entry) => entry.puzzleType === 'expedition',
  );

  return {
    classic: classic
      ? {
          gameNo: classic.gameNo,
          puzzleType: classic.puzzleType,
          board: classic.board,
          maxScore: classic.maxScore,
          totalCoins: classic.totalCoins,
          difficultyBand: classic.difficultyBand,
          playableAt: classic.playableAt,
          nextGameAt: classic.nextGameAt,
        }
      : null,
    expedition: expedition
      ? {
          gameNo: expedition.gameNo,
          puzzleType: expedition.puzzleType,
          board: expedition.board,
          maxScore: expedition.maxScore,
          totalCoins: expedition.totalCoins,
          difficultyBand: expedition.difficultyBand,
          playableAt: expedition.playableAt,
          nextGameAt: expedition.nextGameAt,
        }
      : null,
  };
});
