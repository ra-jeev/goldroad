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

/** Marks a day whose road number is being taken. Ends by itself. */
const NUMBER_CLAIM = 'claim';
const NUMBER_CLAIM_MS = 10_000;

/**
 * The day's public road number. The first request claims the day, and only
 * then takes the next number, so two first requests at the same time never
 * use up two numbers. Others wait for the number the claimer writes. If the
 * claimer fails, the claim ends by itself and the next request takes over.
 */
export async function getOrCreateRoadNo(day: string): Promise<number> {
  const key = roadNoKey(day);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const existing = await redis.get(key);
    if (existing && existing !== NUMBER_CLAIM) return Number(existing);
    if (!existing) {
      const claimed = await redis.set(key, NUMBER_CLAIM, {
        nx: true,
        expiration: new Date(Date.now() + NUMBER_CLAIM_MS),
      });
      if (claimed) {
        const next = await redis.incrBy(ROAD_COUNT_KEY, 1);
        // A plain set also removes the claim's expiry: the number is for ever.
        await redis.set(key, String(next));
        return next;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new RoadGenerationError(`Could not give ${day} a road number`);
}

function toPublic(day: string, roadNo: number, mode: RoadMode, road: StoredRoad): PublicRoad {
  return { day, roadNo, mode, board: road.board, target: road.target };
}
