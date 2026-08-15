import { computed, type Ref } from 'vue';
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
  entries: Array<{ day: string; gameNo: number }>,
  todayKey = getTodayKey(),
  currentGameNo: number | null = null,
): {
  currentStreak: number;
  bestStreak: number;
} {
  // A streak follows consecutive roads, not consecutive calendar dates. That
  // distinction matters whenever a road remains live for longer than one UTC
  // day, as Road 1 did at launch.
  const solvedEntries = [
    ...new Map(entries.map((entry) => [entry.gameNo, entry])).values(),
  ].sort((left, right) => left.gameNo - right.gameNo);

  let bestStreak = 0;
  let runningStreak = 0;
  let previousGameNo: number | null = null;

  for (const entry of solvedEntries) {
    if (previousGameNo === null) {
      runningStreak = 1;
    } else {
      runningStreak =
        entry.gameNo - previousGameNo === 1 ? runningStreak + 1 : 1;
    }

    bestStreak = Math.max(bestStreak, runningStreak);
    previousGameNo = entry.gameNo;
  }

  const latest = solvedEntries.at(-1);
  if (!latest) return { currentStreak: 0, bestStreak };

  // Before today's road is solved, yesterday's road still keeps the streak
  // alive. Prefer the current road number because it also handles extended
  // roads. The date fallback is only a floor for callers without road context;
  // it cannot distinguish an intentionally extended road from a missed day.
  const todayStamp = getUtcDayStamp(todayKey);
  const latestStamp = getUtcDayStamp(latest.day);
  const latestIsCurrent =
    currentGameNo === null
      ? latestStamp === todayStamp || latestStamp === todayStamp - 86400000
      : latest.gameNo === currentGameNo || latest.gameNo === currentGameNo - 1;

  if (!latestIsCurrent) return { currentStreak: 0, bestStreak };

  let currentStreak = 1;
  let expectedGameNo = latest.gameNo - 1;
  for (let index = solvedEntries.length - 2; index >= 0; index -= 1) {
    if (solvedEntries[index]!.gameNo !== expectedGameNo) break;
    currentStreak += 1;
    expectedGameNo -= 1;
  }

  return {
    currentStreak,
    bestStreak,
  };
}

function buildModeSummary(
  modeEntries: StatsModeEntry[],
  puzzleType: PuzzleType,
  currentGameNo: number | null,
): StatsModeSummary {
  const activeEntries = modeEntries.filter(
    (entry) => entry.puzzleType === puzzleType && hasActivity(entry),
  );
  const solvedEntries = activeEntries.filter((entry) => entry.solved);
  const solvedDurations = getSolvedDurations(solvedEntries);
  const streaks = buildStreakSummary(solvedEntries, getTodayKey(), currentGameNo);

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

export function useLocalPlayerStats(
  currentGameNo?: Readonly<Ref<number | null>>,
) {
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
    const resolvedCurrentGameNo =
      currentGameNo?.value ?? localState.currentRoadContext.value.currentGameNo;
    const classicSummary = buildModeSummary(
      modeEntries,
      'classic',
      resolvedCurrentGameNo,
    );
    const expeditionSummary = buildModeSummary(
      modeEntries,
      'expedition',
      resolvedCurrentGameNo,
    );

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
