import type { Board, HintResult } from '#game/shared/types/game';

export type RoadMode = 'classic' | 'expedition';

/** The public part of a road. Gold routes never leave the server. */
export type PublicRoad = {
  day: string;
  roadNo: number;
  mode: RoadMode;
  board: Board;
  target: number;
};

/**
 * Data stored on the post itself. Reddit sends it to the client with no
 * server call, so the launch screen can paint the board at once. It is
 * shared by all viewers: never put a gold route here. Limit: 2 KB.
 */
export type RoadPostData = {
  day: string;
  roadNo: number;
  target: number;
  rows: number;
  cols: number;
  tiles: number[];
  start: number;
  end: number;
};

export type ErrorResponse = { error: string };

export type Medal = 'gold' | 'silver' | 'bronze';

/** One player's record for one road and mode. The server owns every field. */
export type PlayerRun = {
  /** Tries started. A try starts with the first step off the footprints. */
  attempts: number;
  hintsUsed: number;
  hintsLeft: number;
  /** The hint route revealed so far. Stays across tries, as on the website. */
  guidePath: number[];
  solved: boolean;
  solvedAttempt: number | null;
  medal: Medal | null;
  solveSeconds: number | null;
  /** True once the player has posted their result as a comment. */
  commented: boolean;
};

export type RoadResponse = {
  road: PublicRoad;
  username: string | null;
  /** Null when the player is logged out: nothing is saved for them. */
  run: PlayerRun | null;
  standing: Standing | null;
};

export type ModeRequest = { mode: RoadMode };
/** `guide` is read only for logged-out players, who have no saved record. */
export type RouteRequest = { mode: RoadMode; path: number[]; guide?: number[] };

export type StartResponse = { run: PlayerRun | null };

export type HintResponse = {
  hint: HintResult;
  run: PlayerRun | null;
};

export type FinishResponse = {
  outcome: 'solved' | 'wrong-exit' | 'dead-end';
  score: number;
  run: PlayerRun | null;
  standing: Standing | null;
};

/** One row of the daily leaderboard. */
export type LeaderRow = {
  rank: number;
  name: string;
  attempts: number;
  hints: number;
  seconds: number;
  me: boolean;
};

/** Where a solver stands. Only for logged-in players who solved. */
export type Standing = {
  /** False when the solve came after the post's day: a practice road. */
  counted: boolean;
  rank: number | null;
  players: number;
  /** Days in a row with a counted Classic solve. */
  streak: number;
  bestStreak: number;
  /** The top 10, then the player and the two around them if lower. */
  rows: LeaderRow[];
  /** Shown only to solvers: before a solve it is a spoiler. */
  trap: Trap | null;
};

/** The step where first tries most often left the gold road. */
export type Trap = {
  /** Players whose first try is counted. */
  walkers: number;
  /** Of them, how many found the gold road on that first try. */
  solvedFirst: number;
  /** First tries that took the trap step. */
  trapped: number;
  /** The tile where they went wrong, and the tile they stepped to. */
  from: number | null;
  wrongTo: number | null;
  /** The gold road's step from that same tile. */
  goldTo: number | null;
  /** One gold route, through the trap tile when it can. */
  goldRoute: number[];
};

export type CommentResponse = { commentId: string; run: PlayerRun };
