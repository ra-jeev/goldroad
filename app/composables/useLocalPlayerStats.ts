import { computed, type Ref } from 'vue';
import type { PuzzleType } from '#shared/types/game';
import { useGoldroadLocalState } from './useGoldroadLocalState';

import {
  buildMedalCounts,
  buildModeSummary,
  formatAverageSolvedAttempts,
  getSolvedDurations,
  hasActivity,
  type StatsModeEntry,
  type StatsModeRecord,
} from '../utils/pure/playerStats';

export { buildStreakSummary } from '../utils/pure/playerStats';

type StatsDayRecord = {
  day: string;
  gameNo: number;
  modes: Partial<Record<PuzzleType, StatsModeRecord>>;
};

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
      currentStreak: classicSummary.currentStreak,
      bestStreak: classicSummary.bestStreak,
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
