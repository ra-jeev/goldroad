import type { Medal, OutcomeTier } from '../../shared/types/game';

export const UI_COPY = {
  modeSelector: {
    heading: 'Choose Your Daily Puzzle',
    classicTitle: 'Classic',
    expeditionTitle: 'Expedition',
    classicBadge: 'Classic Mode',
    expeditionBadge: 'Expedition Mode',
    playButton: 'Play',
    replayButton: 'Replay',
    lockedLabel: 'Locked',
    unlockHint: 'Solve Classic exactly to unlock Expedition!',
    unlockedLabel: '✨ Unlocked',
    completedLabel: 'Completed',
  },
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
    unlockHint: 'Solve Classic exactly to unlock Expedition.',
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
    hintTitle: 'Hint',
    helpTitle: 'How To Play',
    hintUsedLabel: (count: number) => `Used ${count}`,
  },
  helpSheet: {
    sections: {
      howToPlay: {
        title: 'How to Play',
        items: [
          'Reach the end tile with the exact target score.',
          'You cannot revisit a tile during the same run.',
          'Only up, down, left, and right moves are legal.',
          'Some roads are missing. Muted roads are currently unavailable from your committed path.',
          'Retry restarts the same road and increases your try count.',
          'Hints highlight the board and do not reduce your score or medal.',
          'Solving Classic exactly unlocks Expedition for the day.',
        ],
      },
      about: {
        title: 'About GoldRoad',
        body: 'GoldRoad is a daily route puzzle about finding the best legal path, not collecting every coin on the board.',
      },
      updates: {
        title: 'Milestone 1',
        items: [
          'Exact-score solves are back at the center of the game.',
          'Gold, silver, and bronze are based on solve attempts 1, 2, and 3.',
          'Hints now act as recovery tools instead of score penalties.',
        ],
      },
    },
  },
  sidebar: {
    eyebrow: 'Daily Challenge',
    heroCopy:
      'The goal is not to collect everything. The goal is to discover the best legal route.',
    reloadToday: 'Reload Today',
    retryRoad: 'Retry Road',
    legend: 'Legend',
    hints: 'Hints',
    metrics: {
      score: 'Score',
      boardCoins: 'Board Coins',
      moves: 'Moves',
      progress: 'Progress',
    },
    runStatusEyebrow: 'Run Status',
    routeActive: 'Route Active',
    routeComplete: 'Route Complete',
    defaultHintInline:
      'Use hints only when you need help. They stay tucked away until you ask for them.',
    openHints: 'Open Hints',
    openLegend: 'Open Legend',
    overlayHelpEyebrow: 'Help',
    close: 'Close',
    hintsTitle: 'Hints',
    legendTitle: 'Legend',
    hintRows: {
      level1Title: 'Hint',
      level1Desc: 'Highlights the next correct move',
      level2Title: 'Hint',
      level2Desc: 'Extends the highlighted guide path',
      level3Title: 'Hint',
      level3Desc: 'Extends the highlighted guide path',
    },
    hintFallback: 'Hints appear here after you request one.',
    legendRows: {
      legalMove: 'Legal next move',
      visitedTile: 'Visited tile',
      blockedRoad: 'Missing road',
      tollRoad: 'Toll road',
      bonusRoad: 'Bonus road',
      start: 'Start',
      end: 'End',
    },
  },
  completion: {
    eyebrow: 'Run Complete',
    headingFallback: 'Road complete',
    labels: {
      finalScore: 'Final score',
      goldTarget: 'Gold target',
      moves: 'Moves',
      outcome: 'Outcome',
      playAnother: 'Play Another',
      retryRoad: 'Retry Road',
    },
    tiers: {
      gold: 'Perfect route',
      silver: 'Excellent route',
      bronze: 'Strong route',
      finished: 'Finished route',
      unfinished: 'Unfinished route',
    } as Record<OutcomeTier, string>,
  },
  runtime: {
    loadingGame: 'Loading game...',
    loadingTodaysRoad: "Loading today's road...",
    findingAnotherRoad: 'Finding another road...',
    preRun: (maxScore: number) =>
      `Target ${maxScore}. Start from the marked tile.`,
    needMore: (delta: number) => `Need ${delta} more before the exit.`,
    exactNowFinish: 'Exact score reached. Reach the exit.',
    overBy: (delta: number) => `Over by ${delta}.`,
    destinationSolved: 'Exact solve. You reached the exit on target.',
    destinationShort: (delta: number) =>
      `You reached the exit ${delta} short of the target.`,
    destinationOver: (delta: number) =>
      `You reached the exit ${delta} over the target.`,
    alreadySolved: 'Already solved today. You can replay or switch modes.',
    alreadySolvedWithMedal: (medal: string) =>
      `Already solved today with ${medal.toLowerCase()}. You can replay or switch modes.`,
    deadEnd: 'Dead end before the exit. Retry this road.',
    hintNextStep:
      'Hint applied. The highlighted guide shows the next correct move.',
    hintDiverged:
      'Hint applied. The exact route broke at the highlighted turn. Retry and follow the highlighted branch.',
  },
} as const;
