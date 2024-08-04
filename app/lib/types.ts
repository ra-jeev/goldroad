export type GameStats = {
  gameNo: number;
  stats: {
    played: number;
    solved: number;
    tries: { [key: string]: number };
  };
};

export enum CoinWall {
  None = 0,
  Top = 1,
  Right = 2,
  Bottom = 3,
  Left = 4,
}

export type CoinState = 'none' | 'active' | 'done';
export type ConnectionDir = 'none' | 'left' | 'right' | 'up' | 'down';
export type PlayStatus =
  | 'initial'
  | 'playing'
  | 'no-moves'
  | 'wrong-path'
  | 'lost'
  | 'win';

export type Coin = {
  index: number;
  value: number;
  state: CoinState;
  isStart: boolean;
  isEnd: boolean;
  wall: CoinWall;
  tabIndex: number;
  focus: boolean;
  connection: ConnectionDir;
};

export type Game = {
  _id: string;
  coins: number[];
  walls: { [key: number]: number };
  hints: number[];
  start: number;
  end: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  maxScore: number;
  maxScoreMoves: number;
  boardScore: number;
  rows: number;
  cols: number;
  playableAt: string;
  gameNo: number;
  current: boolean;
  nextGameAt: string;
  playedAt: string;
  prevGameStats?: GameStats;
};
