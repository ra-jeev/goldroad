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
  TOP = 1,
  RIGHT = 2,
  BOTTOM = 3,
  LEFT = 4,
}

export type Coin = {
  id: string;
  value: number;
  wall: CoinWall;
};

export type Game = {
  _id: string;
  coins: Coin[][];
  start: string;
  end: string;
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
