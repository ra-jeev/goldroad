import { computed } from 'vue';
import { calcMedalForAttempt } from '../../lib/gameTiers';
import type { PuzzleType } from '../../shared/types/game';
import { useGoldroadLocalState } from './useGoldroadLocalState';

type StatsModeRecord = {
  attempts: number;
  solved: boolean;
  hintsUsed: number;
  solveTimeMs: number | null;
  updatedAt: string;
};

type StatsDayRecord = {
  day: string;
  gameNo: number;
  modes: Partial<Record<PuzzleType, StatsModeRecord>>;
};

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]!;
}

function getUtcDayStamp(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`);
}

export function useLocalPlayerStats() {
  const localState = useGoldroadLocalState();

  function load() {
    localState.load();
  }

  const recentDays = computed(() => {
    const historyByDay = localState.state.value?.historyByDay ?? {};

    return Object.values(historyByDay).sort((left, right) =>
      right.day.localeCompare(left.day),
    ) as StatsDayRecord[];
  });

  const summary = computed(() => {
    const days = recentDays.value;
    const modeEntries = days.flatMap((entry) => {
      const records: Array<
        StatsModeRecord & {
          day: string;
          gameNo: number;
          puzzleType: PuzzleType;
        }
      > = [];

      if (entry.modes.classic) {
        records.push({
          ...entry.modes.classic,
          day: entry.day,
          gameNo: entry.gameNo,
          puzzleType: 'classic',
        });
      }

      if (entry.modes.expedition) {
        records.push({
          ...entry.modes.expedition,
          day: entry.day,
          gameNo: entry.gameNo,
          puzzleType: 'expedition',
        });
      }

      return records;
    });

    const activeModes = modeEntries.filter(
      (entry) => entry.attempts > 0 || entry.hintsUsed > 0,
    );
    const solvedModes = activeModes.filter((entry) => entry.solved);
    const medalCounts = {
      gold: solvedModes.filter(
        (entry) => calcMedalForAttempt(entry.attempts, entry.solved) === 'gold',
      ).length,
      silver: solvedModes.filter(
        (entry) =>
          calcMedalForAttempt(entry.attempts, entry.solved) === 'silver',
      ).length,
      bronze: solvedModes.filter(
        (entry) =>
          calcMedalForAttempt(entry.attempts, entry.solved) === 'bronze',
      ).length,
    };

    const classicSolvedDays = new Set(
      days
        .filter((entry) => entry.modes.classic?.solved)
        .map((entry) => entry.day),
    );

    const dayKeysAsc = [...classicSolvedDays].sort();
    let bestClassicStreak = 0;
    let runningClassicStreak = 0;
    let previousSolvedDay: string | null = null;

    for (const day of dayKeysAsc) {
      if (!previousSolvedDay) {
        runningClassicStreak = 1;
      } else {
        const previousStamp = getUtcDayStamp(previousSolvedDay);
        const currentStamp = getUtcDayStamp(day);
        runningClassicStreak =
          currentStamp - previousStamp === 86400000
            ? runningClassicStreak + 1
            : 1;
      }

      bestClassicStreak = Math.max(bestClassicStreak, runningClassicStreak);
      previousSolvedDay = day;
    }

    let currentClassicStreak = 0;
    let cursor = getUtcDayStamp(getTodayKey());
    while (
      classicSolvedDays.has(new Date(cursor).toISOString().split('T')[0]!)
    ) {
      currentClassicStreak += 1;
      cursor -= 86400000;
    }

    const totalHints = activeModes.reduce(
      (sum, entry) => sum + entry.hintsUsed,
      0,
    );
    const averageSolvedAttempts = solvedModes.length
      ? (
          solvedModes.reduce((sum, entry) => sum + entry.attempts, 0) /
          solvedModes.length
        ).toFixed(1)
      : '—';

    return {
      roadDaysPlayed: days.filter((entry) =>
        Object.values(entry.modes).some(
          (mode) => mode && (mode.attempts > 0 || mode.hintsUsed > 0),
        ),
      ).length,
      modeSessionsPlayed: activeModes.length,
      exactSolves: solvedModes.length,
      solveRate: activeModes.length
        ? Math.round((solvedModes.length / activeModes.length) * 100)
        : 0,
      currentClassicStreak,
      bestClassicStreak,
      totalHints,
      averageSolvedAttempts,
      medalCounts,
    };
  });

  return {
    state: computed(() => localState.state.value?.historyByDay ?? {}),
    load,
    recentDays,
    summary,
  };
}
