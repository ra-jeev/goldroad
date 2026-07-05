import { and, asc, eq, gt, lte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { games, type NewGame } from '../db/schema';
import { generatePuzzle } from './puzzleGenerator';

export const ROAD_ROTATION_CRON = '0 0 * * *';
export const ROAD_POOL_BUFFER_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
const PUZZLE_TYPES = ['classic', 'expedition'] as const;

type PuzzleType = (typeof PUZZLE_TYPES)[number];
type GoldroadDb = ReturnType<typeof createGoldroadDb>;

export interface RoadRotationResult {
  rotated: boolean;
  previousGameNo: number | null;
  currentGameNo: number | null;
  generatedRows: number;
  poolDryFallback: boolean;
  futureDaysAvailable: number;
}

export function createGoldroadDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export async function rotateRoadAndReplenishPool(
  db: GoldroadDb,
  now = new Date(),
): Promise<RoadRotationResult> {
  const nowIso = now.toISOString();
  const currentRows = await getCurrentRows(db, nowIso);

  if (currentRows.length === 0) {
    const generatedRows = await bootstrapInitialRoadPool(db, now);
    const current = await getCurrentRows(db, nowIso);

    return {
      rotated: false,
      previousGameNo: null,
      currentGameNo: current[0]?.gameNo ?? null,
      generatedRows,
      poolDryFallback: false,
      futureDaysAvailable: await countFutureRoadDays(
        db,
        current[0]?.gameNo ?? null,
      ),
    };
  }

  const currentGameNo = currentRows[0]!.gameNo;
  const currentPlayableAt = currentRows[0]!.playableAt;
  const rotationAt =
    currentRows.find((row) => row.nextGameAt !== null)?.nextGameAt ??
    addDaysIso(currentPlayableAt, 1);

  let activeGameNo = currentGameNo;
  let activePlayableAt = currentPlayableAt;
  let generatedRows = 0;
  let rotated = false;
  let poolDryFallback = false;

  if (rotationAt <= nowIso) {
    const nextGameNo = currentGameNo + 1;
    const nextPlayableAt = rotationAt;
    const readyRows = await getRowsForGameNo(db, nextGameNo);

    if (!hasBothPuzzleTypes(readyRows)) {
      poolDryFallback = true;
      console.error(
        `[road-rotation] Puzzle pool ran dry before game ${nextGameNo}; generating fallback rows during rotation.`,
      );
      generatedRows += await ensureRoadDay(db, nextGameNo, nextPlayableAt);
    }

    await db
      .update(games)
      .set({
        current: false,
        nextGameAt: null,
        updatedAt: nowIso,
      })
      .where(
        and(
          eq(games.active, true),
          eq(games.current, true),
          eq(games.gameNo, currentGameNo),
        ),
      );

    await db
      .update(games)
      .set({
        current: true,
        nextGameAt: addDaysIso(nextPlayableAt, 1),
        updatedAt: nowIso,
      })
      .where(and(eq(games.active, true), eq(games.gameNo, nextGameNo)));

    rotated = true;
    activeGameNo = nextGameNo;
    activePlayableAt = nextPlayableAt;
  }

  generatedRows += await ensureFuturePool(
    db,
    activeGameNo,
    activePlayableAt,
  );

  return {
    rotated,
    previousGameNo: rotated ? currentGameNo : null,
    currentGameNo: activeGameNo,
    generatedRows,
    poolDryFallback,
    futureDaysAvailable: await countFutureRoadDays(db, activeGameNo),
  };
}

async function getCurrentRows(db: GoldroadDb, nowIso: string) {
  return db
    .select({
      gameNo: games.gameNo,
      puzzleType: games.puzzleType,
      playableAt: games.playableAt,
      nextGameAt: games.nextGameAt,
    })
    .from(games)
    .where(
      and(
        eq(games.active, true),
        eq(games.current, true),
        lte(games.playableAt, nowIso),
      ),
    )
    .orderBy(asc(games.gameNo));
}

async function getRowsForGameNo(db: GoldroadDb, gameNo: number) {
  return db
    .select({
      puzzleType: games.puzzleType,
    })
    .from(games)
    .where(and(eq(games.active, true), eq(games.gameNo, gameNo)));
}

async function ensureFuturePool(
  db: GoldroadDb,
  currentGameNo: number,
  currentPlayableAt: string,
) {
  let generatedRows = 0;

  for (let offset = 1; offset <= ROAD_POOL_BUFFER_DAYS; offset++) {
    generatedRows += await ensureRoadDay(
      db,
      currentGameNo + offset,
      addDaysIso(currentPlayableAt, offset),
    );
  }

  return generatedRows;
}

async function bootstrapInitialRoadPool(db: GoldroadDb, now: Date) {
  const playableAt = startOfUtcDayIso(now);
  const generatedRows = await ensureRoadDay(db, 1, playableAt, true);

  await db
    .update(games)
    .set({
      current: true,
      nextGameAt: addDaysIso(playableAt, 1),
      updatedAt: now.toISOString(),
    })
    .where(and(eq(games.active, true), eq(games.gameNo, 1)));

  return generatedRows + (await ensureFuturePool(db, 1, playableAt));
}

async function ensureRoadDay(
  db: GoldroadDb,
  gameNo: number,
  playableAt: string,
  current = false,
) {
  const existingRows = await getRowsForGameNo(db, gameNo);
  const existingTypes = new Set(existingRows.map((row) => row.puzzleType));
  let generatedRows = 0;

  for (const puzzleType of PUZZLE_TYPES) {
    if (existingTypes.has(puzzleType)) continue;

    await db
      .insert(games)
      .values(buildGameRow(gameNo, puzzleType, playableAt, current));
    generatedRows++;
  }

  return generatedRows;
}

function buildGameRow(
  gameNo: number,
  puzzleType: PuzzleType,
  playableAt: string,
  current: boolean,
): NewGame {
  const puzzle = generatePuzzle(puzzleType);

  if (!puzzle) {
    throw new Error(
      `Failed to generate ${puzzleType} puzzle for game ${gameNo}`,
    );
  }

  return {
    gameNo,
    puzzleType,
    boardJson: JSON.stringify(puzzle.board),
    optimalPathsJson: JSON.stringify(puzzle.optimalPaths),
    maxScore: puzzle.maxScore,
    totalCoins: puzzle.totalCoins,
    difficultyBand: puzzle.difficultyBand,
    goldSilverGap: puzzle.goldSilverGap,
    active: true,
    current,
    playableAt,
    nextGameAt: current ? addDaysIso(playableAt, 1) : null,
  };
}

async function countFutureRoadDays(
  db: GoldroadDb,
  currentGameNo: number | null,
) {
  if (currentGameNo === null) return 0;

  const rows = await db
    .select({
      gameNo: games.gameNo,
      puzzleType: games.puzzleType,
    })
    .from(games)
    .where(
      and(
        eq(games.active, true),
        eq(games.current, false),
        gt(games.gameNo, currentGameNo),
      ),
    )
    .orderBy(asc(games.gameNo));

  const byGameNo = new Map<number, Set<PuzzleType>>();

  for (const row of rows) {
    const puzzleTypes = byGameNo.get(row.gameNo) ?? new Set<PuzzleType>();
    puzzleTypes.add(row.puzzleType);
    byGameNo.set(row.gameNo, puzzleTypes);
  }

  return [...byGameNo.values()].filter((types) => hasBothPuzzleTypes(types))
    .length;
}

function hasBothPuzzleTypes(
  rowsOrTypes: Array<{ puzzleType: PuzzleType }> | Set<PuzzleType>,
) {
  const types =
    rowsOrTypes instanceof Set
      ? rowsOrTypes
      : new Set(rowsOrTypes.map((row) => row.puzzleType));

  return PUZZLE_TYPES.every((puzzleType) => types.has(puzzleType));
}

function addDaysIso(iso: string, days: number) {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

function startOfUtcDayIso(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  ).toISOString();
}
