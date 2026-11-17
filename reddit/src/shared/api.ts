import type { Board } from '#game/shared/types/game';

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

export type RoadResponse = {
  road: PublicRoad;
  username: string | null;
};

export type ErrorResponse = { error: string };
