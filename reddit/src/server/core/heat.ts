import { redis } from '@devvit/web/server';
import type { Heat, RoadMode } from '../../shared/api';

/**
 * "Where the crowd walked": one count per tile over every player's first
 * finished try, and one per first step. No user ids: only totals.
 */
const heatKey = (day: string, mode: RoadMode) => `heat:${day}:${mode}`;

export async function recordWalk(day: string, mode: RoadMode, path: number[]): Promise<void> {
  const key = heatKey(day, mode);
  const fields = ['walkers', ...path.map((tile) => `t${tile}`)];
  if (path[1] !== undefined) fields.push(`f${path[1]}`);
  await Promise.all(fields.map((field) => redis.hIncrBy(key, field, 1)));
}

export async function getHeat(
  day: string,
  mode: RoadMode,
  tileCount: number,
  goldRoute: number[],
): Promise<Heat> {
  const stored = await redis.hGetAll(heatKey(day, mode));
  const tiles = Array.from({ length: tileCount }, (_, tile) => Number(stored[`t${tile}`] ?? 0));
  const firstSteps: Record<number, number> = {};
  for (const [field, value] of Object.entries(stored)) {
    if (field.startsWith('f')) firstSteps[Number(field.slice(1))] = Number(value);
  }
  return { walkers: Number(stored.walkers ?? 0), tiles, firstSteps, goldRoute };
}
