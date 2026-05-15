import type { Medal } from '../../shared/types/game';

export const UI_COPY = {
  board: {
    keyboardHint: 'Click tiles or use arrow keys',
    info: {
      toll: 'Toll',
      bonus: 'Bonus',
    },
  },
  boardHeader: {
    classic: 'Classic',
    expedition: 'Expedition',
    solvedBadge: 'Solved',
    lockedBadge: 'Locked',
    unlockHint: 'Solve Classic to unlock Expedition.',
    metrics: {
      score: 'Score',
      boardCoins: 'Board Coins',
      medal: 'Medal',
    },
    medals: {
      gold: 'Gold',
      silver: 'Silver',
      bronze: 'Bronze',
    } as Record<Medal, string>,
  },
  boardFooter: {
    retryRoad: 'Retry Road',
    openHint: 'Hint',
    openHelp: 'How to Play',
    switchToExpedition: 'Play Expedition',
    viewStats: 'View Stats',
    attemptLabel: 'Attempt',
    expeditionUnlocked: 'Expedition unlocked',
    medalAwarded: (medal: string) => `${medal} medal`,
    nextRoadCountdown: (countdown: string) =>
      `Next road in ${countdown} · 00:00 UTC`,
    nextRoadShort: (countdown: string) => `Next road in ${countdown}`,
    hintTitle: 'Hint',
    helpTitle: 'How To Play',
    hintUsedLabel: (count: number) => `Used ${count}`,
  },
  helpSheet: {
    close: 'Close',
    sections: {
      howToPlay: {
        title: 'How to Play',
        items: [
          'Reach the end tile with the target score.',
          'You cannot revisit a tile during the same run.',
          'Only up, down, left, and right moves are legal.',
          'Some roads are missing. Muted roads are currently unavailable from your committed path.',
          'Retry restarts the same road and increases your try count.',
          'Hints highlight the board and do not reduce your score or medal.',
          'Solving Classic unlocks Expedition for the day.',
        ],
      },
      about: {
        title: 'About GoldRoad',
        body: 'GoldRoad is a daily route puzzle about finding the best legal path, not collecting every coin on the board.',
      },
      updates: {
        title: 'Milestone 1',
        items: [
          'Target-score solving is back at the center of the game.',
          'Gold, silver, and bronze are based on solve attempts 1, 2, and 3.',
          'Hints now act as recovery tools instead of score penalties.',
        ],
      },
    },
  },

  runtime: {
    loadingGame: 'Loading game...',
    loadingTodaysRoad: "Loading today's road...",
    findingAnotherRoad: 'Finding another road...',
    preRun: (maxScore: number) =>
      `Target ${maxScore}. Start from the marked tile.`,
    needMore: (delta: number) => `Need ${delta} more before the exit.`,
    exactNowFinish: 'Target reached. Reach the exit.',
    overBy: (delta: number) => `Over by ${delta}.`,
    destinationSolved: 'Solved on target.',
    destinationShort: (delta: number) => `Not solved. You were ${delta} short.`,
    destinationOver: (delta: number) => `Not solved. You were ${delta} over.`,
    alreadySolved: 'Already solved. You can replay or switch modes.',
    alreadySolvedWithMedal: (medal: string) =>
      `Already solved with ${medal.toLowerCase()}. You can replay or switch modes.`,
    deadEnd: 'Dead end before the exit. Retry this road.',
    hintNextStep:
      'Hint applied. The highlighted guide shows the next correct move.',
    hintDiverged:
      'Hint applied. The target route broke at the highlighted turn. Retry and follow the highlighted branch.',
  },
} as const;
