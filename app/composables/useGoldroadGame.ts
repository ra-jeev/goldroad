import { computed, onMounted } from 'vue';
import type { CurrentGamesResponse, PuzzleType } from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';
import { getRoadDayKeyFromPlayableAt } from './useGoldroadLocalState';
import { useNextRoadCountdown } from './useNextRoadCountdown';

export function useGoldroadGame() {
  const gamesApi = useGamesApi();
  const localProgress = useLocalGameProgress();
  const gameplay = useRoadDayGameplay({ entryType: 'live' });
  const { countdown: nextResetCountdown } = useNextRoadCountdown();

  const canSwitchToExpedition = computed(
    () =>
      gameplay.selectedMode.value === 'classic' &&
      gameplay.classicSolvedToday.value &&
      Boolean(gameplay.availableGames.value.expedition),
  );

  function getPreferredMode(response: CurrentGamesResponse): PuzzleType | null {
    const context = localProgress.currentRoadContext.value;
    const currentGameNo =
      response.classic?.gameNo ?? response.expedition?.gameNo ?? null;
    const currentDay = response.classic
      ? getRoadDayKeyFromPlayableAt(response.classic.playableAt)
      : response.expedition
        ? getRoadDayKeyFromPlayableAt(response.expedition.playableAt)
        : null;

    if (
      context.currentGameNo === currentGameNo &&
      context.currentDay === currentDay
    ) {
      return context.selectedMode;
    }

    return gameplay.selectedMode.value;
  }

  async function loadCurrentGame() {
    gameplay.loading.value = true;
    gameplay.status.value = UI_COPY.runtime.loadingTodaysRoad;
    try {
      const response = await gamesApi.getCurrentGames();
      gameplay.applyRoadDay(response, {
        preferredMode: getPreferredMode(response),
      });
    } finally {
      gameplay.loading.value = false;
    }
  }

  onMounted(async () => {
    await loadCurrentGame();
  });

  return {
    ...gameplay,
    nextResetCountdown,
    canSwitchToExpedition,
  };
}
