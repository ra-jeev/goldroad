import { Game } from '@/app/lib/types';

export const gameData: Game = {
  _id: '6670ce218d3626183886178e',
  coins: [
    6, 6, 2, 2, 2, 6, 6, 1, 5, 3, 3, 4, 6, 5, 4, 5, 2, 5, 5, 5, 2, 3, 3, 4, 3,
    6, 1, 2, 1, 6, 6, 2, 4, 1, 1, 3,
  ],
  walls: {
    0: 4,
    5: 3,
    8: 1,
    11: 2,
    16: 2,
    17: 3,
    18: 1,
    19: 3,
    28: 1,
    29: 2,
    32: 2,
    34: 4,
  },
  start: 21,
  end: 0,
  active: true,
  createdAt: '2024-06-18T00:00:01.059Z',
  updatedAt: '2024-06-22T00:00:00.09Z',
  maxScore: 111,
  playableAt: '2024-06-22T00:00:00Z',
  gameNo: 527,
  current: true,
  nextGameAt: '2024-06-23T00:00:00Z',
  playedAt: '2024-06-22T00:00:00.09Z',
  prevGameStats: {
    gameNo: 526,
    stats: {
      played: 3,
      solved: 3,
      tries: {
        '1': 1,
        '14': 1,
        '54': 1,
      },
    },
  },
};
