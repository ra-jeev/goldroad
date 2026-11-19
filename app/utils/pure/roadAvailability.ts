/**
 * The midnight contract (RP1-16): once the loaded road's own nextGameAt has
 * passed, the board stays exactly as it is, but retry, hints, mode switching,
 * and server analytics all stop. The open board can still be completed as
 * archive play.
 */
export function isRoadExpired(
  nextGameAt: string | null | undefined,
  nowMs: number,
): boolean {
  if (!nextGameAt) return false;
  const parsed = Date.parse(nextGameAt);
  return !Number.isNaN(parsed) && nowMs >= parsed;
}

type ScheduledRoad = { gameNo: number; nextGameAt?: string | null };

export function roadAvailability(
  current: Pick<ScheduledRoad, 'gameNo'> | null,
  fetched: ScheduledRoad | null,
  nowMs: number,
): 'waiting' | 'sameDay' | 'open' | 'ready' {
  if (!fetched) return 'waiting';
  if (fetched.gameNo === current?.gameNo) return 'sameDay';
  if (isRoadExpired(fetched.nextGameAt, nowMs)) return 'waiting';
  if (!current) return 'open';
  return fetched.gameNo > current.gameNo ? 'ready' : 'waiting';
}
