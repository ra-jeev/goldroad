import { computed, onMounted } from 'vue';
import type { CurrentGamesResponse, PuzzleType } from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';
import { getRoadDayKeyFromPlayableAt } from './useGoldroadLocalState';
import { useNextRoadCountdown } from './useNextRoadCountdown';

export function useGoldroadGame() {
  const gamesApi = useGamesApi();
  const localProgress = useLocalGameProgress();
  const gameplay = useRoadDayGameplay({ entryType: 'live' });
  // Anchored to the loaded road's own schedule: a tab open at rotation (or a
  // page first opened while the cron lags) flips ready as soon as this road's
  // nextGameAt passes, and clears once a newer road is applied.
  const {
    countdown: nextResetCountdown,
    newRoadReady,
  } = useNextRoadCountdown(
    () =>
      gameplay.availableGames.value.classic?.nextGameAt ??
      gameplay.availableGames.value.expedition?.nextGameAt ??
      null,
  );

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

  // The rotation cron can lag UTC midnight by a moment, so the server may
  // still answer with the old road (or briefly with none mid-flip). Fetch
  // first and apply only a genuinely new road: re-applying the same road
  // would rebuild the board and hand out a fresh attempt on an expired day.
  // On a no-op the board is untouched and the affordance stays for the next
  // tap.
  let loadNewRoadInFlight = false;

  async function loadNewRoad() {
    if (loadNewRoadInFlight) return;
    loadNewRoadInFlight = true;

    try {
      let response: CurrentGamesResponse;
      try {
        response = await gamesApi.getCurrentGames();
      } catch {
        return;
      }

      // Compare against the state at apply time, not at tap time: a slower
      // concurrent tap must not re-apply the road a faster one just loaded.
      const currentGameNo =
        gameplay.availableGames.value.classic?.gameNo ??
        gameplay.availableGames.value.expedition?.gameNo ??
        null;
      const nextGameNo =
        response.classic?.gameNo ?? response.expedition?.gameNo ?? null;
      if (nextGameNo === null || nextGameNo === currentGameNo) return;

      gameplay.applyRoadDay(response, {
        preferredMode: getPreferredMode(response),
      });
    } finally {
      loadNewRoadInFlight = false;
    }
  }

  onMounted(async () => {
    await loadCurrentGame();
  });

  return {
    ...gameplay,
    nextResetCountdown,
    newRoadReady,
    loadNewRoad,
    canSwitchToExpedition,
  };
}
