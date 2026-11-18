import { redis } from '@devvit/web/server';
import type { Ballot, CommunityPick, CommunityOptionId } from '../../shared/api';
import { utcDay } from './day';
import { remember } from './userIndex';

/**
 * The weekly community road. All week, players vote on one property of
 * Sunday's road. On Sunday the road is made with the winner. One vote per
 * account per week; a player can change it until Sunday 00:00 UTC.
 */
export type RoadShape = { rows?: number; cols?: number; blockedEdges?: number; tileRange?: [number, number] };

export const COMMUNITY_OPTIONS: { id: CommunityOptionId; label: string; blurb: string; shape: RoadShape }[] = [
  { id: 'maze', label: 'Maze', blurb: 'More walls, fewer ways through', shape: { blockedEdges: 14 } },
  { id: 'coins', label: 'Big coins', blurb: 'Tiles worth up to 9', shape: { tileRange: [1, 9] } },
  // Extra walls keep a 7-wide board fast to solve (seconds at most).
  { id: 'wide', label: 'Wide road', blurb: 'Seven tiles across', shape: { cols: 7, blockedEdges: 16 } },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Votes from this user: user → option. */
const votesKey = (sunday: string) => `ballot:${sunday}`;
/** Running totals: option → count. */
const totalsKey = (sunday: string) => `ballot:${sunday}:totals`;
/** The option a Sunday road was made with. Fixed at road creation. */
const pickKey = (sunday: string) => `community:${sunday}`;
const NO_PICK = 'none';

export function isSunday(day: string): boolean {
  return new Date(`${day}T00:00:00Z`).getUTCDay() === 0;
}

/** The first Sunday after a day. On a Sunday, that is next week's. */
export function ballotSunday(day: string = utcDay()): string {
  const date = new Date(`${day}T00:00:00Z`);
  const ahead = 7 - date.getUTCDay();
  return utcDay(new Date(date.getTime() + ahead * DAY_MS));
}

async function totals(sunday: string): Promise<Record<CommunityOptionId, number>> {
  const stored = await redis.hGetAll(totalsKey(sunday));
  return Object.fromEntries(
    COMMUNITY_OPTIONS.map(({ id }) => [id, Math.max(0, Number(stored[id] ?? 0))]),
  ) as Record<CommunityOptionId, number>;
}

/** This week's ballot as one player sees it. */
export async function getBallot(userId: string | null, today: string = utcDay()): Promise<Ballot> {
  const sunday = ballotSunday(today);
  const [counts, mine] = await Promise.all([
    totals(sunday),
    userId ? redis.hGet(votesKey(sunday), userId) : Promise.resolve(undefined),
  ]);
  return {
    sunday,
    options: COMMUNITY_OPTIONS.map(({ id, label, blurb }) => ({ id, label, blurb, votes: counts[id] })),
    total: Object.values(counts).reduce((sum, n) => sum + n, 0),
    myVote: (mine as CommunityOptionId | undefined) ?? null,
  };
}

/** Cast or change a vote for the coming Sunday. */
export async function castVote(userId: string, option: CommunityOptionId, today: string = utcDay()): Promise<Ballot> {
  const sunday = ballotSunday(today);
  const previous = await redis.hGet(votesKey(sunday), userId);
  if (previous !== option) {
    await redis.hSet(votesKey(sunday), { [userId]: option });
    await remember(userId, votesKey(sunday), 'field');
    if (previous) await redis.hIncrBy(totalsKey(sunday), previous, -1);
    await redis.hIncrBy(totalsKey(sunday), option, 1);
  }
  return getBallot(userId, today);
}

/**
 * The winner for a Sunday, fixed the first time it is asked. Null when the
 * day is not a Sunday or nobody voted: the road is then a normal one. A tie
 * goes to the option listed first.
 */
export async function communityPick(day: string): Promise<CommunityPick | null> {
  if (!isSunday(day)) return null;
  const fixed = await redis.get(pickKey(day));
  if (fixed !== undefined) return fixed === NO_PICK ? null : JSON.parse(fixed);

  const counts = await totals(day);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  let pick: CommunityPick | null = null;
  for (const option of COMMUNITY_OPTIONS) {
    if (counts[option.id] > 0 && (!pick || counts[option.id] > pick.votes)) {
      pick = { id: option.id, label: option.label, votes: counts[option.id], total };
    }
  }
  await redis.set(pickKey(day), pick ? JSON.stringify(pick) : NO_PICK, { nx: true });
  const stored = await redis.get(pickKey(day));
  return !stored || stored === NO_PICK ? null : JSON.parse(stored);
}

export function shapeFor(pick: CommunityPick | null): RoadShape {
  return COMMUNITY_OPTIONS.find((option) => option.id === pick?.id)?.shape ?? {};
}
