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

export type Coin = {
  index: number;
  value: number;
  state: 'none' | 'active' | 'done';
  isStart: boolean;
  isEnd: boolean;
  wall: CoinWall;
  tabIndex: number;
  focus: boolean;
};

export type Game = {
  _id: string;
  coins: number[];
  walls: { [key: number]: number };
  start: number;
  end: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  maxScore: number;
  playableAt: string;
  gameNo: number;
  current: boolean;
  nextGameAt: string;
  playedAt: string;
  prevGameStats: GameStats;
};
