import type { Board, EdgeType } from '#shared/types/game';

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
    /** Render the footer's Undo control instead of a mini board. */
    showUndoButton?: boolean;
    /** Render the keyboard controls instead of a mini board. */
    showKeyboardKeys?: boolean;
    /** Render the footer's Try again control instead of a mini board. */
    showRetryButton?: boolean;
    /** Render the footer's Hint control instead of a mini board. */
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
    body: 'You start on the footprints. Glowing tiles are legal moves. Reach the finish flag with your score on target.',
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
    title: 'Open lanes',
    body: 'You can move up, down, left, or right when there is a lane between neighboring tiles.',
    visual: {
      fromValue: 3,
      toValue: 4,
      edgeType: 'open',
    },
  },
  {
    id: 'missing-road',
    title: 'Missing lanes',
    body: 'An empty gap means there is no lane. You cannot move between those tiles.',
    visual: {
      fromValue: 2,
      toValue: 5,
      edgeType: 'missing',
    },
  },
  {
    id: 'toll-road',
    title: 'Toll lanes',
    body: 'Two dashed rails mark a toll lane. If you cross it, you pay the toll shown above the board.',
    visual: {
      fromValue: 6,
      toValue: 4,
      edgeType: 'toll',
    },
  },
  {
    id: 'bonus-road',
    title: 'Bonus lanes',
    body: 'Two solid rails mark a bonus lane. If you cross it, you get the bonus shown above the board.',
    visual: {
      fromValue: 1,
      toValue: 3,
      edgeType: 'bonus',
    },
  },
  {
    // Undo stands alone rather than joining Retry and Hint. Those two answer
    // "this road has not worked out"; Undo answers "I just tapped the wrong
    // tile" — a different moment, and the only control here with a gesture
    // nobody would guess, so it needs the room.
    id: 'undo',
    title: 'Take back a wrong step',
    body: 'Tapped the wrong tile? Use the button, or the tile you came from, to undo your last step. You can undo only one step at a time.',
    visual: {
      fromValue: 4,
      toValue: 2,
      edgeType: 'open',
      showUndoButton: true,
    },
  },
  {
    // Retry and Hint are one lesson because they answer the same question:
    // what to do when a road has not worked out. Splitting them made the
    // guide longer without teaching anything extra.
    id: 'retry-hint',
    title: 'Walk it again, or take a hint',
    body: 'A road never locks you out. Try again walks it from the start, as often as you like. Hint shows your next useful move.',
    visual: {
      fromValue: 5,
      toValue: 3,
      edgeType: 'open',
      showRetryButton: true,
      showHintButton: true,
    },
  },
  {
    // Last, because it is a second way to do what the board already does
    // rather than a rule of the road. Nothing on screen hints that the keys
    // work, so the guide is the only place a player can find out.
    id: 'keyboard',
    title: 'Play with the keyboard',
    body: 'Arrow keys or W, A, S, D move you one tile. Backspace takes back your last step.',
    visual: {
      fromValue: 4,
      toValue: 2,
      edgeType: 'open',
      showKeyboardKeys: true,
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
