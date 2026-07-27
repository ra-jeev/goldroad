import type { Medal } from '../../shared/types/game';

export const UI_COPY = {
  board: {
    keyboardHint: 'Click tiles or use arrow keys',
    tileLabels: {
      start: 'Start: footprints',
      exit: 'Finish: flag',
    },
    info: {
      openRoad: 'Open road',
      missingRoad: 'Missing road',
      tollCost: 'Toll cost',
      roadBonus: 'Road bonus',
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
      target: 'Target',
      boardTotal: 'Board total',
      boardTotalDescription:
        'The sum of every tile on the board. Your route may leave some tiles out.',
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
    retryRoad: 'Try again',
    openHint: 'Hint',
    openHelp: 'How to Play',
    switchToExpedition: 'Play Expedition',
    shareResult: 'Share',
    viewStats: 'View stats',
    attemptResting: (attempt: number) => {
      const ordinal =
        ['st', 'nd', 'rd'][((((attempt + 90) % 100) - 10) % 10) - 1] || 'th';
      return `${attempt}${ordinal} Try`;
    },
    expeditionUnlocked: 'Expedition unlocked',
    medalAwarded: (medal: string) => `${medal} medal`,
    nextRoadCountdown: (countdown: string) => `Next road in ${countdown}`,
    nextRoadShort: (countdown: string) => `Next road in ${countdown}`,
    newRoadReady: 'A new road just opened.',
    playNewRoad: 'Play the new road',
    hintTitle: 'Hint',
    helpTitle: 'How to play',
    /** Tooltip on the hint button: what is left, not what is spent. */
    hintUsedLabel: (remaining: number) =>
      remaining === 1 ? '1 hint left' : `${remaining} hints left`,
    hintLoading: 'Reading the map…',
    hintsExhausted: 'No hints left on this road',
    /**
     * Shown while a hint route is lit but unwalked. The guide survives a
     * retry, and without this the board just shows a lit road with nothing
     * saying it is there to be followed.
     */
    followGuide: 'Follow the highlighted road.',
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
          'You begin on the footprints. Reach the finish flag with your score matching the target.',
          'Your score changes as you move from tile to tile.',
          'You cannot revisit a tile during the same try.',
          'Only up, down, left, and right moves are legal.',
          "Some roads simply aren't there. Where there's no road, there's no way through.",
          'You may need to leave some tiles out. Board total shows the value of every tile, not the route you must take.',
        ],
      },
      tools: {
        title: 'Tools',
        items: [
          'Try again restarts the same road. There is no limit on tries, but each one adds to your try count.',
          'Classic and Expedition get 5 hints each, every day. A hint lights up the next stretch of a guide route to follow.',
          'Hints never reduce your score or medal.',
          'Solving Classic unlocks Expedition for the day when one is available.',
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
    attemptLabel: (count: number) =>
      `${count} ${count === 1 ? 'try' : 'tries'}`,
    medalLine: (medal: string) => `${medal} medal`,
    solveTimeLine: (time: string) => `Solve time ${time}`,
    classic: {
      gold: {
        eyebrow: 'Classic solved',
        title: 'Gold. First try.',
        body: 'A flawless start. Carry that momentum straight into Expedition.',
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
      title: 'Both roads conquered.',
      body: 'See you tomorrow.',
      bothSolved: 'Both roads solved',
      classicLabel: 'Classic',
      expeditionLabel: 'Expedition',
      notPlayed: 'Not played',
      nextRoad: (countdown: string) => `Next road in ${countdown}`,
    },
    replay: {
      eyebrow: 'Archive replay',
      title: 'Solved.',
      body: 'Nicely walked. Archive roads keep your streak and stats untouched.',
      wouldHaveLine: (medal: string) => `Live, that would have been ${medal}.`,
    },
    shareCopied: 'Result copied to your clipboard.',
    shareUnavailable: 'Unable to share this result right now.',
  },

  tutorial: {
    ariaLabel: 'GoldRoad tutorial',
    eyebrow: 'Tutorial',
    title: 'Learn the road',
    description: 'Learn the basics, then try a practice road.',
    close: 'Close',
    stepsAriaLabel: 'Tutorial steps',
    guideTab: '1. Guide',
    practiceTab: '2. Practice Road',
    lessonsAriaLabel: 'Tutorial lessons',
    continueToPractice: 'Try a practice road',
    practiceAriaLabel: 'Practice road puzzle',
    roadLegendAriaLabel: 'Road legend',
    playToday: 'Play today',
  },

  v1Welcome: {
    close: 'Close',
    eyebrow: 'GoldRoad is back',
    title: 'Welcome back.',
    body: [
      "GoldRoad got a full rewrite. Road numbering restarted, and old accounts and history didn't carry over. That's a clean break, not a bug.",
      "There's also something new: a whole second mode called Expedition, with toll and bonus roads that change how you score.",
    ],
    primaryCta: "Show me what's new",
    secondaryCta: "Skip to today's road",
  },

  runtime: {
    loadingGame: 'Loading the road...',
    loadingTodaysRoad: "Loading today's road...",
    findingAnotherRoad: 'Finding another road...',
    preRun: 'You’re on the footprints. Step onto any glowing tile to begin.',
    destinationSolved: 'Solved.',
    solvedAgain: 'Solved again.',
    destinationShort: (delta: number) =>
      `You reached the finish ${delta} short of the target.`,
    destinationOver: (delta: number) =>
      `You reached the finish ${delta} over the target.`,
    deadEnd: 'Dead end. Walk it again to find the way through.',
    classicOverTarget: 'This route may not lead to an exact finish.',
    // The board lights up the moment a hint lands, so the copy does not need
    // to announce that a hint was applied — only what to do with it.
    hintNextStep: 'The highlighted tile is your next move.',
    hintDiverged: 'Paths diverged. Try again and follow the highlighted path.',
    hintAlreadySolved: 'You already found the best route.',
  },
} as const;
