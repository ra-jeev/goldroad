import type { Board, EdgeType } from '../../shared/types/game';

export type TutorialLesson = {
  id: string;
  title: string;
  body: string;
  visual: {
    fromValue: number;
    toValue: number;
    middleValue?: number;
    edgeType: EdgeType | 'open';
    isStart?: boolean;
    isEnd?: boolean;
    isHinted?: boolean;
    showHintButton?: boolean;
    /**
     * Render the real pre-run state: the start tile already occupied
     * (current) and its neighbor glowing (a legal move) — exactly how a
     * road actually begins.
     */
    showStartState?: boolean;
  };
};

export type TutorialPracticeGame = {
  board: Board;
  maxScore: number;
  totalCoins: number;
  optimalPaths: number[][];
};

export const TUTORIAL_LESSONS: TutorialLesson[] = [
  {
    id: 'icons',
    title: 'From the footprints to the flag',
    body: 'Every road begins with you already standing on the footprints. Glowing tiles are the moves you can take. Reach the finish flag with a score matching the target.',
    visual: {
      fromValue: 5,
      toValue: 6,
      middleValue: 3,
      edgeType: 'open',
      isStart: true,
      isEnd: true,
      showStartState: true,
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
    body: 'An empty gap means there is no road. You cannot move between those tiles.',
    visual: {
      fromValue: 2,
      toValue: 5,
      edgeType: 'missing',
    },
  },
  {
    id: 'toll-road',
    title: 'Toll roads',
    body: 'Two dashed rails mark a toll road. If you cross it, you pay the toll shown above the board.',
    visual: {
      fromValue: 6,
      toValue: 4,
      edgeType: 'toll',
    },
  },
  {
    id: 'bonus-road',
    title: 'Bonus roads',
    body: 'Two solid rails mark a bonus road. If you cross it, you get the bonus shown above the board.',
    visual: {
      fromValue: 1,
      toValue: 3,
      edgeType: 'bonus',
    },
  },
  {
    id: 'hint',
    title: 'Use a hint',
    body: 'If you get stuck, Hint highlights your next useful move.',
    visual: {
      fromValue: 2,
      toValue: 5,
      edgeType: 'open',
      showHintButton: true,
    },
  },
];

export const TUTORIAL_PRACTICE_GAME: TutorialPracticeGame = {
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
