import { redis } from '@devvit/web/server';
import type { RoadMode } from '../../shared/api';
import { isSunday } from './community';
import { nextDay, utcDay } from './day';
import { prepareRoad } from './road';

/** Days of roads kept ready ahead of today, as the website keeps its pool. */
export const ROAD_BUFFER_DAYS = 5;

const MODES: RoadMode[] = ['classic', 'expedition'];

/** A Sunday road waits for the vote, which closes at 23:30 UTC on Saturday. */
const VOTE_CLOSE_MS = 30 * 60 * 1000;

/** Stop making roads after this long, to stay inside a scheduled job's time. */
const TIME_BUDGET_MS = 20_000;

export type BufferResult = { made: string[]; waiting: string[]; ready: number };

/**
 * Make the missing roads for the next ROAD_BUFFER_DAYS days. A board can take
 * seconds, so a run stops at its time budget and the next run goes on. Runs
 * twice a day, so a missed day is soon made up.
 */
export async function fillRoadBuffer(now: number = Date.now()): Promise<BufferResult> {
  const started = Date.now();
  const result: BufferResult = { made: [], waiting: [], ready: 0 };
  let day = utcDay(new Date(now));
  for (let offset = 1; offset <= ROAD_BUFFER_DAYS; offset++) {
    day = nextDay(day);
    if (isSunday(day) && now < Date.parse(`${day}T00:00:00Z`) - VOTE_CLOSE_MS) {
      result.waiting.push(day);
      continue;
    }
    for (const mode of MODES) {
      if (await redis.get(`road:${day}:${mode}`)) {
        result.ready += 1;
        continue;
      }
      if (Date.now() - started > TIME_BUDGET_MS) return result;
      await prepareRoad(day, mode);
      result.made.push(`${day}:${mode}`);
      result.ready += 1;
    }
  }
  return result;
}
