import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { games } from '../../../db/schema';
import { useDb } from '../../../db/client';
import { parsePublicGameRow } from '../../../utils/apiGames';

const OptimalPathsSchema = z.array(z.array(z.number().int().min(0)));

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
      current: games.current,
      optimalPathsJson: games.optimalPathsJson,
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

  function serializeMode(
    row: (typeof rows)[number] | undefined,
  ): Record<string, unknown> | null {
    if (!row) return null;

    const parsed = parsePublicGameRow(row);

    // Archived (non-current) roads ship their solution paths so hints can
    // run locally with zero analytics calls (RP0-5). The live road's paths
    // never leave the server (P0-3 boundary).
    const optimalPaths = row.current
      ? undefined
      : OptimalPathsSchema.parse(JSON.parse(row.optimalPathsJson));

    return {
      gameNo: parsed.gameNo,
      puzzleType: parsed.puzzleType,
      board: parsed.board,
      maxScore: parsed.maxScore,
      totalCoins: parsed.totalCoins,
      difficultyBand: parsed.difficultyBand,
      playableAt: parsed.playableAt,
      nextGameAt: parsed.nextGameAt,
      ...(optimalPaths ? { optimalPaths } : {}),
    };
  }

  return {
    classic: serializeMode(
      rows.find((entry) => entry.puzzleType === 'classic'),
    ),
    expedition: serializeMode(
      rows.find((entry) => entry.puzzleType === 'expedition'),
    ),
  };
});
