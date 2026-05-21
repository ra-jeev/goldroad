import type { Board, EdgeType } from '../../shared/types/game';

export type TutorialLesson = {
  id: string;
  title: string;
  body: string;
  visual: {
    fromValue: number;
    toValue: number;
    edgeType: EdgeType | 'open';
    isStart?: boolean;
    isEnd?: boolean;
    modifierLabel?: string;
  };
};

export type TutorialPracticeGame = {
  title: string;
  intro: string;
  board: Board;
  maxScore: number;
  totalCoins: number;
  optimalPaths: number[][];
};

export const TUTORIAL_LESSONS: TutorialLesson[] = [
  {
    id: 'icons',
    title: 'Start and exit',
    body: 'Begin on the tile with the start icon. Solve the road by reaching the tile with the exit icon on the exact target score.',
    visual: {
      fromValue: 5,
      toValue: 6,
      edgeType: 'open',
      isStart: true,
      isEnd: true,
    },
  },
  {
    id: 'open-road',
    title: 'Open roads',
    body: 'You can move up, down, left, or right when there is a road between neighboring tiles.',
    visual: {
      fromValue: 3,
      toValue: 4,
      edgeType: 'open',
    },
  },
  {
    id: 'missing-road',
    title: 'Missing roads',
    body: 'Neighboring tiles are not always connected. If there is no road, that move is unavailable.',
    visual: {
      fromValue: 2,
      toValue: 5,
      edgeType: 'missing',
    },
  },
  {
    id: 'toll-road',
    title: 'Toll roads',
    body: 'A toll road is playable, but it subtracts from your route score when you cross it.',
    visual: {
      fromValue: 6,
      toValue: 4,
      edgeType: 'toll',
      modifierLabel: '-1',
    },
  },
  {
    id: 'bonus-road',
    title: 'Bonus roads',
    body: 'A bonus road is playable and adds extra value to your route score when you cross it.',
    visual: {
      fromValue: 1,
      toValue: 3,
      edgeType: 'bonus',
      modifierLabel: '+4',
    },
  },
];

export const TUTORIAL_PRACTICE_GAME: TutorialPracticeGame = {
  title: 'Practice road',
  intro:
    'Now try a small Expedition road. Retry as much as you like, and use Hint just like you would on the daily puzzle.',
  maxScore: 79,
  totalCoins: 78,
  optimalPaths: [
    [
      11, 6, 7, 2, 1, 0, 5, 10, 15, 20, 21, 16, 17, 12, 13, 18, 23, 24, 19,
      14, 9, 8, 3,
    ],
  ],
  board: {
    rows: 5,
    cols: 5,
    tiles: [
      5, 4, 1, 3, 1, 3, 5, 3, 3, 4, 3, 1, 3, 5, 4, 5, 3, 6, 3, 1, 3, 4, 1,
      3, 1,
    ],
    missingEdges: [
      { from: 17, to: 18 },
      { from: 3, to: 4 },
      { from: 21, to: 22 },
    ],
    tollEdges: [
      { from: 1, to: 6 },
      { from: 0, to: 5 },
    ],
    bonusEdges: [{ from: 1, to: 2 }],
    tollValue: 1,
    bonusValue: 4,
    start: 11,
    end: 3,
  },
};
