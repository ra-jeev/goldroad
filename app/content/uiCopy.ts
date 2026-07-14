import type { Medal } from '../../shared/types/game';

export const UI_COPY = {
  board: {
    keyboardHint: 'Click tiles or use arrow keys',
    tileLabels: {
      start: 'Start tile',
      exit: 'Exit tile',
    },
    info: {
      openRoad: 'Open road',
      missingRoad: 'Missing road',
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
      boardCoins: 'Road Coins',
      medal: 'Medal',
    },
    medals: {
      gold: 'Gold',
      silver: 'Silver',
      bronze: 'Bronze',
    } as Record<Medal, string>,
    ariaLabels: {
      controls: 'Road controls',
      puzzleMode: 'Puzzle mode',
      roadScore: 'Road score',
    },
  },
  boardFooter: {
    retryRoad: 'Walk It Again',
    openHint: 'Hint',
    openHelp: 'How to Play',
    switchToExpedition: 'Play Expedition',
    shareResult: 'Share',
    viewStats: 'View Stats',
    attemptLabel: 'Run',
    expeditionUnlocked: 'Expedition unlocked',
    medalAwarded: (medal: string) => `${medal} medal`,
    nextRoadCountdown: (countdown: string) =>
      `Next road in ${countdown} · 00:00 UTC`,
    nextRoadShort: (countdown: string) => `Next road in ${countdown}`,
    hintTitle: 'Hint',
    helpTitle: 'How To Play',
    hintUsedLabel: (count: number) => `Used ${count}`,
  },
  statsHistogram: {
    distributionLabel: 'Distribution of how many tries roadgoers took',
    barAriaLabel: (input: {
      caption: string;
      count: number;
      share: number;
      isPlayer: boolean;
    }) =>
      `${input.caption}: ${input.count} run${input.count === 1 ? '' : 's'}, ${input.share}%${input.isPlayer ? ' — your run' : ''}`,
  },
  helpSheet: {
    ariaLabel: 'How to play',
    close: 'Close',
    startTutorial: 'Play Tutorial',
    intro:
      'Learn GoldRoad with a short playable tutorial, or use this quick reference when you need a reminder.',
    sections: {
      howToPlay: {
        title: 'The road',
        items: [
          'Start on the tile with the start icon and reach the tile with the exit icon.',
          'Your running score must match the target when you reach the exit.',
          'You cannot revisit a tile during the same run.',
          'Only up, down, left, and right moves are legal.',
          "Some roads simply aren't there — where there's no road, there's no way through.",
          'It may not be possible to collect every coin on the board.',
        ],
      },
      tools: {
        title: 'Tools',
        items: [
          'Retry restarts the same road and increases your attempt count.',
          'Hints highlight a guide route and do not reduce your score or medal.',
          'Solving Classic unlocks Expedition for the day when one is available.',
          'How to Play is always available from the question button in the toolbar.',
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

  celebration: {
    close: 'Close',
    dismiss: 'Dismiss celebration',
    share: 'Share result',
    shareDay: 'Share the day',
    continueToExpedition: 'Continue to Expedition',
    viewStats: 'View stats',
    keepGoing: 'Done for now',
    solveIncrement: '+1',
    solved: 'Solved',
    attemptLabel: (count: number) => `${count} run${count === 1 ? '' : 's'}`,
    medalLine: (medal: string) => `${medal} medal`,
    solveTimeLine: (time: string) => `Solve time ${time}`,
    classic: {
      gold: {
        eyebrow: 'Classic solved',
        title: 'Gold. First try.',
        body: 'A flawless run. Carry that momentum straight into Expedition.',
      },
      medal: {
        eyebrow: 'Classic solved',
        title: 'Clean solve.',
        body: 'Medal secured. There is more road waiting in Expedition.',
      },
      relief: {
        eyebrow: 'Classic solved',
        title: 'You made it.',
        body: 'That road put up a fight and you got through it.',
      },
    },
    noExpeditionBody: 'That wraps the Classic road for today.',
    dayComplete: {
      eyebrow: 'Day complete',
      title: "That's the day.",
      body: 'Classic and Expedition are both done. See you tomorrow.',
      bothSolved: 'Both roads solved',
      classicLabel: 'Classic',
      expeditionLabel: 'Expedition',
      notPlayed: 'Not played',
      nextRoad: (countdown: string) => `Next road in ${countdown} · 00:00 UTC`,
    },
    replay: {
      eyebrow: 'Replay',
      title: 'Solved.',
      body: "Nice run on this archived road. It won't touch today's streak.",
    },
    shareCopied: 'Result copied to your clipboard.',
    shareUnavailable: 'Unable to share this result right now.',
  },

  tutorial: {
    ariaLabel: 'GoldRoad tutorial',
    eyebrow: 'Tutorial',
    title: 'Learn the road',
    close: 'Close',
    stepsAriaLabel: 'Tutorial steps',
    guideTab: '1. Guide',
    practiceTab: '2. Practice',
    lessonsAriaLabel: 'Tutorial lessons',
    continueToPractice: 'Try a practice road',
    practiceEyebrow: 'Practice',
    practiceAriaLabel: 'Practice puzzle',
    roadLegendAriaLabel: 'Road legend',
    playToday: 'Play today',
  },

  v1Welcome: {
    close: 'Close',
    eyebrow: 'GoldRoad is back',
    title: 'Welcome back.',
    body: [
      "GoldRoad got a full rewrite. Road numbering restarted, and old accounts and history didn't carry over — a clean break, not a bug.",
      "There's also something new: a whole second mode called Expedition, with toll and bonus roads that change how you score.",
    ],
    primaryCta: "Show me what's new",
    secondaryCta: "Skip to today's road",
  },

  runtime: {
    loadingGame: 'Loading game...',
    loadingTodaysRoad: "Loading today's road...",
    findingAnotherRoad: 'Finding another road...',
    preRun: (maxScore: number) =>
      `Target ${maxScore}. Start from the marked tile.`,
    needMore: (delta: number) => `${delta} more before the exit — keep walking.`,
    exactNowFinish: 'Target reached. Reach the exit.',
    overBy: (delta: number) => `Over by ${delta}.`,
    destinationSolved: 'Solved on target.',
    destinationShort: (delta: number) =>
      `So close — ${delta} short of the target.`,
    destinationOver: (delta: number) =>
      `${delta} over the target. Retry to land it exact.`,
    alreadySolved: 'Already solved. You can replay or switch modes.',
    alreadySolvedWithMedal: (medal: string) =>
      `Already solved with ${medal.toLowerCase()}. You can replay or switch modes.`,
    deadEnd: 'Dead end. Walk it again to find the way through.',
    hintNextStep:
      'Hint applied. The highlighted guide shows the next correct move.',
    hintDiverged:
      'Hint applied. The target route broke at the highlighted turn. Retry and follow the highlighted branch.',
    hintAlreadySolved:
      'Hint applied. You already found the best route; follow the highlighted road.',
  },
} as const;
