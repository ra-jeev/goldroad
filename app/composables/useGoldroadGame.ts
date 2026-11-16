import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { CurrentGamesResponse, PuzzleType } from '#shared/types/game';
import { UI_COPY } from '../content/uiCopy';
import { getRoadDayKeyFromPlayableAt } from './useGoldroadLocalState';
import { useNextRoadCountdown } from './useNextRoadCountdown';
import { isRoadExpired } from './useRoadDayGameplay';

const PUBLICATION_CHECK_INTERVAL_MS = 5_000;
const PUBLICATION_CHECK_LIMIT = 6;

function mainRoad(day: CurrentGamesResponse | null | undefined) {
  return day?.classic ?? day?.expedition ?? null;
}

export async function useGoldroadGame() {
  const gamesApi = useGamesApi();
  const requestFetch = useRequestFetch();
  const localProgress = useLocalGameProgress();
  const gameplay = useRoadDayGameplay({ entryType: 'live' });
  // The schedule expires the old road. Only a server response can confirm
  // that its replacement is published.
  const {
    countdown: nextResetCountdown,
    cutoffReached,
  } = useNextRoadCountdown(
    () => gameplay.game.value?.nextGameAt,
  );
  const roadExpired = computed(() => Boolean(gameplay.game.value) && cutoffReached.value);
  const waitingForPublication = ref(false);
  const newRoadReady = ref(false);
  const newRoadCheckFeedback = ref<{ message: string } | null>(null);
  const checkingForNewRoad = ref(false);

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

  const initialRoadDayRequest = useAsyncData('current-road-day', async () => {
    try {
      const day = await requestFetch<CurrentGamesResponse>('/api/games/current');
      return { day, waiting: isRoadExpired(mainRoad(day)?.nextGameAt, Date.now()) };
    } catch (error) {
      // Rotation can briefly leave neither road marked current.
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        return { day: null, waiting: true };
      }
      throw error;
    }
  });

  function waitForPublication() {
    waitingForPublication.value = true;
    gameplay.status.value = UI_COPY.runtime.nextRoadPublishing;
  }

  let pendingFetch: Promise<CurrentGamesResponse | null> | null = null;
  function fetchCurrentRoad() {
    pendingFetch ??= gamesApi.getCurrentGames()
      .catch(() => null)
      .finally(() => { pendingFetch = null; });
    return pendingFetch;
  }

  function canOpenRoad(day: CurrentGamesResponse | null) {
    const next = mainRoad(day);
    return Boolean(next &&
      next.gameNo !== gameplay.game.value?.gameNo &&
      !isRoadExpired(next.nextGameAt, Date.now()));
  }

  let checkTimer: ReturnType<typeof setTimeout> | undefined;
  let remainingChecks = 0;
  let disposed = false;

  const awaitingNewRoad = computed(() => roadExpired.value || waitingForPublication.value);

  function stopChecking() {
    clearTimeout(checkTimer);
    checkTimer = undefined;
    remainingChecks = 0;
  }

  function markRoadReady() {
    newRoadReady.value = true;
    newRoadCheckFeedback.value = null;
    if (!gameplay.game.value) {
      gameplay.status.value = UI_COPY.boardFooter.newRoadReady;
    }
    stopChecking();
  }

  async function checkPublication() {
    if (!awaitingNewRoad.value || checkingForNewRoad.value || disposed ||
        newRoadReady.value || gameplay.loading.value || document.hidden) return;

    checkingForNewRoad.value = true;
    try {
      const day = await fetchCurrentRoad();
      if (disposed || !awaitingNewRoad.value || gameplay.loading.value) return;
      if (canOpenRoad(day)) {
        markRoadReady();
      } else if (--remainingChecks > 0 && !document.hidden) {
        checkTimer = setTimeout(checkPublication, PUBLICATION_CHECK_INTERVAL_MS);
      }
    } finally {
      checkingForNewRoad.value = false;
    }
  }

  function startChecking() {
    if (gameplay.loading.value) return;
    stopChecking();
    remainingChecks = PUBLICATION_CHECK_LIMIT;
    void checkPublication();
  }

  function onVisibilityChange() {
    if (document.hidden) stopChecking();
    else startChecking();
  }

  async function requestNewRoad(checkOnly: boolean) {
    if (gameplay.loading.value || disposed) return;
    gameplay.loading.value = true;
    if (!gameplay.game.value) {
      gameplay.status.value = UI_COPY.runtime.loadingGame;
    }

    try {
      const day = await fetchCurrentRoad();
      if (disposed) return;
      if (!day || !canOpenRoad(day)) {
        newRoadReady.value = false;
        if (!gameplay.game.value) {
          if (waitingForPublication.value || isRoadExpired(mainRoad(day)?.nextGameAt, Date.now())) {
            waitForPublication();
          } else {
            gameplay.status.value = UI_COPY.runtime.currentRoadUnavailable;
          }
        } else {
          newRoadCheckFeedback.value = { message: UI_COPY.runtime.nextRoadPublishing };
        }
        return;
      }

      if (checkOnly) {
        markRoadReady();
        return;
      }

      stopChecking();
      waitingForPublication.value = false;
      newRoadReady.value = false;
      newRoadCheckFeedback.value = null;
      gameplay.dismissCelebration();
      gameplay.applyRoadDay(day, { preferredMode: getPreferredMode(day) });
    } finally {
      gameplay.loading.value = false;
      if (!disposed && awaitingNewRoad.value && !newRoadReady.value) startChecking();
    }
  }

  // Register before awaiting async setup so Vue can associate the hooks.
  onMounted(() => {
    const initial = initialRoadDayRequest.data.value;
    if (initial && (initial.waiting || isRoadExpired(mainRoad(initial.day)?.nextGameAt, Date.now()))) {
      gameplay.clearRoadDay();
      waitForPublication();
    } else if (initial?.day && mainRoad(initial.day)) {
      localProgress.load();
      gameplay.applyRoadDay(initial.day, { preferredMode: getPreferredMode(initial.day) });
    }

    watch(awaitingNewRoad, (waiting) => {
      if (waiting) startChecking();
      else stopChecking();
    }, { immediate: true });
    window.addEventListener('focus', startChecking);
    document.addEventListener('visibilitychange', onVisibilityChange);
  });

  onUnmounted(() => {
    disposed = true;
    stopChecking();
    window.removeEventListener('focus', startChecking);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });

  const { data: initialRoadDay } = await initialRoadDayRequest;
  const initial = initialRoadDay.value;
  if (initial?.waiting) {
    waitForPublication();
  } else if (initial?.day && mainRoad(initial.day)) {
    gameplay.applyRoadDay(initial.day, {
      // SSR and hydration start from the same board before local progress loads.
      preferredMode: null,
      restoreLocalProgress: false,
    });
  } else {
    gameplay.status.value = UI_COPY.runtime.currentRoadUnavailable;
  }

  return {
    ...gameplay,
    nextResetCountdown,
    roadExpired,
    newRoadReady,
    newRoadCheckFeedback,
    checkForNewRoad: () => requestNewRoad(true),
    loadNewRoad: () => requestNewRoad(false),
    canSwitchToExpedition,
  };
}
