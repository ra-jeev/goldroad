import { redis } from '@devvit/web/server';
import type { RoadMode, Trap } from '../../shared/api';
import { getGoldRoutes } from './road';

/**
 * "The trap": the step where first tries most often leave the gold road.
 * Counts only, never user ids. Fields: `walkers`, `solved`, and
 * `x<from>:<to>` for each wrong step.
 */
const trapKey = (day: string, mode: RoadMode) => `trap:${day}:${mode}`;

/** The first step of a walk that no gold route takes. Null for a gold walk. */
export function wrongStep(path: number[], goldRoutes: number[][]): { from: number; to: number } | null {
  let alive = goldRoutes;
  for (let i = 1; i < path.length; i += 1) {
    alive = alive.filter((route) => route[i] === path[i]);
    if (!alive.length) return { from: path[i - 1]!, to: path[i]! };
  }
  return null;
}

/** Add one player's first finished try. */
export async function recordFirstTry(day: string, mode: RoadMode, path: number[]): Promise<void> {
  const gold = await getGoldRoutes(day, mode);
  if (!gold?.length) return;
  const key = trapKey(day, mode);
  const wrong = wrongStep(path, gold);
  await redis.hIncrBy(key, 'walkers', 1);
  if (wrong) await redis.hIncrBy(key, `x${wrong.from}:${wrong.to}`, 1);
  else await redis.hIncrBy(key, 'solved', 1);
}

export async function getTrap(day: string, mode: RoadMode): Promise<Trap | null> {
  const gold = await getGoldRoutes(day, mode);
  if (!gold?.length) return null;
  const stored = await redis.hGetAll(trapKey(day, mode));

  let best: { from: number; to: number; count: number } | null = null;
  for (const [field, value] of Object.entries(stored)) {
    if (!field.startsWith('x')) continue;
    const [from, to] = field.slice(1).split(':').map(Number) as [number, number];
    const count = Number(value);
    if (!best || count > best.count) best = { from, to, count };
  }

  // Draw the gold route that passes the trap tile, so the right turn shows.
  const route = (best && gold.find((candidate) => candidate.includes(best.from))) ?? gold[0]!;
  const at = best ? route.indexOf(best.from) : -1;
  return {
    walkers: Number(stored.walkers ?? 0),
    solvedFirst: Number(stored.solved ?? 0),
    trapped: best?.count ?? 0,
    from: best?.from ?? null,
    wrongTo: best?.to ?? null,
    goldTo: at >= 0 ? (route[at + 1] ?? null) : null,
    goldRoute: route,
  };
}
