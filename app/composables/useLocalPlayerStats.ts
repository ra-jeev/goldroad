import { computed } from 'vue';
import { calcMedalForAttempt } from '../../lib/gameTiers';
import type { PuzzleType } from '#shared/types/game';
import { useGoldroadLocalState } from './useGoldroadLocalState';

type StatsModeRecord = {
  attempts: number;
  solved: boolean;
  hintsUsed: number;
  solveTimeMs: number | null;
  updatedAt: string;
};

type StatsModeEntry = StatsModeRecord & {
  day: string;
  gameNo: number;
  puzzleType: PuzzleType;
};

type MedalCounts = {
  gold: number;
  silver: number;
  bronze: number;
};

type StatsModeSummary = {
  puzzleType: PuzzleType;
  sessionsPlayed: number;
  exactSolves: number;
  solveRate: number;
  totalHints: number;
  averageSolvedAttempts: string;
  averageSolveTimeMs: number | null;
  bestSolveTimeMs: number | null;
  currentStreak: number;
  bestStreak: number;
  medalCounts: MedalCounts;
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

function hasActivity(entry: { attempts: number; hintsUsed: number }): boolean {
  return entry.attempts > 0 || entry.hintsUsed > 0;
}

function formatAverageSolvedAttempts(
  entries: Array<{ attempts: number }>,
): string {
  return entries.length
    ? (entries.reduce((sum, entry) => sum + entry.attempts, 0) / entries.length)
        .toFixed(1)
        .replace(/\.0$/, '')
    : '–';
}

function getSolvedDurations(
  entries: Array<{ solveTimeMs: number | null }>,
): number[] {
  return entries
    .map((entry) => entry.solveTimeMs)
    .filter((value): value is number => value !== null);
}

function createEmptyMedalCounts(): MedalCounts {
  return {
    gold: 0,
    silver: 0,
    bronze: 0,
  };
}

function buildMedalCounts(
  entries: Array<{ attempts: number; solved: boolean }>,
): MedalCounts {
  const medalCounts = createEmptyMedalCounts();

  for (const entry of entries) {
    const medal = calcMedalForAttempt(entry.attempts, entry.solved);
    if (medal === 'gold' || medal === 'silver' || medal === 'bronze') {
      medalCounts[medal] += 1;
    }
  }

  return medalCounts;
}

export function buildStreakSummary(
  days: string[],
  todayKey = getTodayKey(),
): {
  currentStreak: number;
  bestStreak: number;
} {
  const solvedDaySet = new Set(days);
  const dayKeysAsc = [...solvedDaySet].sort();

  let bestStreak = 0;
  let runningStreak = 0;
  let previousSolvedDay: string | null = null;

  for (const day of dayKeysAsc) {
    if (!previousSolvedDay) {
      runningStreak = 1;
    } else {
      const previousStamp = getUtcDayStamp(previousSolvedDay);
      const currentStamp = getUtcDayStamp(day);
      runningStreak =
        currentStamp - previousStamp === 86400000 ? runningStreak + 1 : 1;
    }

    bestStreak = Math.max(bestStreak, runningStreak);
    previousSolvedDay = day;
  }

  let currentStreak = 0;
  const todayStamp = getUtcDayStamp(todayKey);
  let cursor = solvedDaySet.has(todayKey) ? todayStamp : todayStamp - 86400000;

  while (solvedDaySet.has(new Date(cursor).toISOString().split('T')[0]!)) {
    currentStreak += 1;
    cursor -= 86400000;
  }

  return {
    currentStreak,
    bestStreak,
  };
}

function buildModeSummary(
  modeEntries: StatsModeEntry[],
  puzzleType: PuzzleType,
): StatsModeSummary {
  const activeEntries = modeEntries.filter(
    (entry) => entry.puzzleType === puzzleType && hasActivity(entry),
  );
  const solvedEntries = activeEntries.filter((entry) => entry.solved);
  const solvedDurations = getSolvedDurations(solvedEntries);
  const streaks = buildStreakSummary(solvedEntries.map((entry) => entry.day));

  return {
    puzzleType,
    sessionsPlayed: activeEntries.length,
    exactSolves: solvedEntries.length,
    solveRate: activeEntries.length
      ? Math.round((solvedEntries.length / activeEntries.length) * 100)
      : 0,
    totalHints: activeEntries.reduce((sum, entry) => sum + entry.hintsUsed, 0),
    averageSolvedAttempts: formatAverageSolvedAttempts(solvedEntries),
    averageSolveTimeMs: solvedDurations.length
      ? Math.round(
          solvedDurations.reduce((sum, value) => sum + value, 0) /
            solvedDurations.length,
        )
      : null,
    bestSolveTimeMs: solvedDurations.length
      ? Math.min(...solvedDurations)
      : null,
    currentStreak: streaks.currentStreak,
    bestStreak: streaks.bestStreak,
    medalCounts: buildMedalCounts(solvedEntries),
  };
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
      const records: StatsModeEntry[] = [];

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

    const activeModes = modeEntries.filter((entry) => hasActivity(entry));
    const solvedModes = activeModes.filter((entry) => entry.solved);
    const solvedDurations = getSolvedDurations(solvedModes);
    const classicSummary = buildModeSummary(modeEntries, 'classic');
    const expeditionSummary = buildModeSummary(modeEntries, 'expedition');

    return {
      roadDaysPlayed: days.filter((entry) =>
        Object.values(entry.modes).some((mode) => mode && hasActivity(mode)),
      ).length,
      modeSessionsPlayed: activeModes.length,
      exactSolves: solvedModes.length,
      solveRate: activeModes.length
        ? Math.round((solvedModes.length / activeModes.length) * 100)
        : 0,
      currentClassicStreak: classicSummary.currentStreak,
      bestClassicStreak: classicSummary.bestStreak,
      currentExpeditionStreak: expeditionSummary.currentStreak,
      bestExpeditionStreak: expeditionSummary.bestStreak,
      totalHints: activeModes.reduce((sum, entry) => sum + entry.hintsUsed, 0),
      averageSolvedAttempts: formatAverageSolvedAttempts(solvedModes),
      averageSolveTimeMs: solvedDurations.length
        ? Math.round(
            solvedDurations.reduce((sum, value) => sum + value, 0) /
              solvedDurations.length,
          )
        : null,
      bestSolveTimeMs: solvedDurations.length
        ? Math.min(...solvedDurations)
        : null,
      medalCounts: buildMedalCounts(solvedModes),
      modeBreakdown: {
        classic: classicSummary,
        expedition: expeditionSummary,
      },
    };
  });

  return {
    state: computed(() => localState.state.value?.historyByDay ?? {}),
    load,
    recentDays,
    summary,
  };
}
