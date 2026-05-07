import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { CurrentGamesResponse, PuzzleType } from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';
import { getRoadDayKeyFromPlayableAt } from './useGoldroadLocalState';

export function useGoldroadGame() {
  const gamesApi = useGamesApi();
  const localProgress = useLocalGameProgress();
  const gameplay = useRoadDayGameplay({ entryType: 'live' });
  const nextResetCountdown = ref('00:00:00');

  let countdownTimer: ReturnType<typeof setInterval> | null = null;

  const canSwitchToExpedition = computed(
    () =>
      gameplay.selectedMode.value === 'classic' &&
      gameplay.lastSolved.value &&
      Boolean(gameplay.availableGames.value.expedition),
  );
  const uiLabels = computed(() => ({
    roadHeading: gameplay.roadHeading.value,
    modeLabel:
      gameplay.selectedMode.value === 'expedition'
        ? UI_COPY.modeSelector.expeditionBadge
        : UI_COPY.modeSelector.classicBadge,
    runStateHeading: gameplay.ended.value
      ? UI_COPY.sidebar.routeComplete
      : UI_COPY.sidebar.routeActive,
    difficultyLabel: gameplay.game.value?.difficultyBand ?? '—',
    hintDisplayMessage:
      gameplay.hintMessage.value ?? UI_COPY.sidebar.defaultHintInline,
    hasHintMessage: Boolean(gameplay.hintMessage.value),
    progressText: `${gameplay.completionPercent.value}%`,
    completionHeading: gameplay.lastTier.value
      ? UI_COPY.completion.tiers[gameplay.lastTier.value]
      : UI_COPY.completion.headingFallback,
    completionOutcome: gameplay.lastTier.value ?? '—',
  }));

  function getNextUtcMidnight(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
      ),
    );
  }

  function updateNextResetCountdown() {
    const diff = Math.max(0, getNextUtcMidnight().getTime() - Date.now());
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    nextResetCountdown.value = [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, '0'))
      .join(':');
  }

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

  async function playAnother() {
    if (!gameplay.playerUUID.value) return;

    gameplay.loading.value = true;
    gameplay.status.value = UI_COPY.runtime.findingAnotherRoad;
    try {
      const payload = await gamesApi.getAnotherGame(gameplay.playerUUID.value);
      await navigateTo(`/games/${payload.gameNo}`);
    } finally {
      gameplay.loading.value = false;
    }
  }

  async function handlePlayAnother() {
    if (canSwitchToExpedition.value) {
      gameplay.switchToExpedition();
      return;
    }

    await playAnother();
  }

  onMounted(async () => {
    updateNextResetCountdown();
    countdownTimer = setInterval(updateNextResetCountdown, 1000);
    await loadCurrentGame();
  });

  onUnmounted(() => {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  });

  return {
    ...gameplay,
    uiLabels,
    nextResetCountdown,
    canSwitchToExpedition,
    loadCurrentGame,
    playAnother: handlePlayAnother,
  };
}
