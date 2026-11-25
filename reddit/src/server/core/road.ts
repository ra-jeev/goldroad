import { redis } from '@devvit/web/server';
import { generatePuzzle } from '#game/server/utils/puzzleGenerator';
import type { Board } from '#game/shared/types/game';
import type { PublicRoad, RoadMode } from '../../shared/api';
import { communityPick, shapeFor } from './community';

/** Public board and target. Safe to send to any client. */
const roadKey = (day: string, mode: RoadMode) => `road:${day}:${mode}`;
/** Gold routes. Server only, never returned by an /api/ endpoint. */
const goldKey = (day: string, mode: RoadMode) => `gold:${day}:${mode}`;
/** Day → road number, and the running count of road days. */
const roadNoKey = (day: string) => `roadno:${day}`;
const ROAD_COUNT_KEY = 'roadno:count';

type StoredRoad = { board: Board; target: number };

export class RoadGenerationError extends Error {}

/**
 * Return the road for a day and mode. Generate and store it on first use.
 *
 * Two parallel first calls can both generate; `nx` makes the first write win
 * and the loser reads the winner's road back, so every player sees one board.
 */
export async function getOrCreateRoad(day: string, mode: RoadMode): Promise<PublicRoad> {
  const roadNo = await getOrCreateRoadNo(day);
  return toPublic(day, roadNo, mode, await ensureRoad(day, mode));
}

/**
 * Make and store a day's road before its day starts, so the 00:00 post only
 * reads it. A board can take seconds to make. The road number is not taken
 * here: it is given when the road is first shown, so numbers stay in order.
 */
export async function prepareRoad(day: string, mode: RoadMode): Promise<void> {
  await ensureRoad(day, mode);
}

async function ensureRoad(day: string, mode: RoadMode): Promise<StoredRoad> {
  const stored = await redis.get(roadKey(day, mode));
  if (stored) return JSON.parse(stored) as StoredRoad;

  // A Sunday road takes the shape the community voted for.
  const shape = shapeFor(await communityPick(day));
  const puzzle =
    generatePuzzle(mode, shape.rows, shape.cols, shape.blockedEdges, undefined, shape.tileRange) ??
    generatePuzzle(mode);
  if (!puzzle) throw new RoadGenerationError(`No ${mode} road for ${day}`);

  // One transaction writes the board and its gold routes together, so a
  // board never goes live without the routes its hints need. The first
  // caller wins; a later one reads the winner's road back.
  const road: StoredRoad = { board: puzzle.board, target: puzzle.maxScore };
  const tx = await redis.watch(roadKey(day, mode));
  if (!(await redis.get(roadKey(day, mode)))) {
    await tx.multi();
    await tx.set(goldKey(day, mode), JSON.stringify(puzzle.optimalPaths));
    await tx.set(roadKey(day, mode), JSON.stringify(road));
    const done = await tx.exec();
    if (done !== null && done.length > 0) return road;
  } else {
    await tx.unwatch();
  }
  const winner = await redis.get(roadKey(day, mode));
  if (!winner) throw new RoadGenerationError(`Lost road write for ${day}`);
  return JSON.parse(winner) as StoredRoad;
}

export async function getGoldRoutes(day: string, mode: RoadMode): Promise<number[][] | null> {
  const stored = await redis.get(goldKey(day, mode));
  return stored ? (JSON.parse(stored) as number[][]) : null;
}

async function getOrCreateRoadNo(day: string): Promise<number> {
  const existing = await redis.get(roadNoKey(day));
  if (existing) return Number(existing);
  const next = await redis.incrBy(ROAD_COUNT_KEY, 1);
  const won = await redis.set(roadNoKey(day), String(next), { nx: true });
  if (won) return next;
  return Number(await redis.get(roadNoKey(day)));
}

function toPublic(day: string, roadNo: number, mode: RoadMode, road: StoredRoad): PublicRoad {
  return { day, roadNo, mode, board: road.board, target: road.target };
}
