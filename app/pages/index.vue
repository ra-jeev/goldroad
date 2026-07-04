<script setup lang="ts">
import { onUnmounted, watch, watchEffect } from 'vue';

const {
  game,
  tiles,
  currentTileIndex,
  visited,
  activeSet,
  pathHistory,
  score,
  moves,
  hintMessage,
  hintedTiles,
  ended,
  loading,
  submitting,
  status,
  lastMedal,
  lastSolved,
  hintsUsed,
  trackingDisabled,
  expeditionJustUnlocked,
  maxScore,
  totalCoins,
  availableGames,
  selectedMode,
  isExpeditionUnlocked,
  classicSolvedToday,
  attemptNumber,
  nextResetCountdown,
  roadHeading,
  canSwitchToExpedition,
  celebration,
  selectMode,
  retryCurrentGame,
  switchToExpedition,
  moveTo,
  requestHint,
  dismissCelebration,
  continueToExpedition,
  shareCelebrationResult,
  shareCurrentResult,
} = useGoldroadGame();

const currentRoadLabel = useState<string | null>(
  'current-road-label',
  () => null,
);
const localState = useGoldroadLocalState();
const { isTutorialOpen, openTutorial } = useTutorialFlow();
const checkedFirstRunTutorial = ref(false);

const shouldShowFirstRunTutorial = computed(
  () =>
    Boolean(game.value) &&
    !loading.value &&
    !localState.tutorialState.value.completed &&
    !localState.tutorialState.value.lastSeenAt &&
    !localState.hasAnyLiveProgress.value,
);

watchEffect(() => {
  currentRoadLabel.value = game.value ? roadHeading.value : null;
});

watch(
  shouldShowFirstRunTutorial,
  (shouldShow) => {
    if (
      !import.meta.client ||
      checkedFirstRunTutorial.value ||
      !shouldShow ||
      isTutorialOpen.value
    ) {
      return;
    }

    checkedFirstRunTutorial.value = true;
    openTutorial();
  },
  { immediate: true },
);

onUnmounted(() => {
  currentRoadLabel.value = null;
});

const scorePulse = ref<{ type: 'toll' | 'bonus'; key: number } | null>(null);
function onScoringMove(payload: { type: 'toll' | 'bonus' }) {
  scorePulse.value = { type: payload.type, key: (scorePulse.value?.key ?? 0) + 1 };
}
</script>

<template>
  <div class="shell">
    <main class="layout">
      <section v-if="game" class="board-column">
        <GameBoardHeader
          :selected-mode="selectedMode"
          :has-expedition="Boolean(availableGames.expedition)"
          :is-expedition-unlocked="isExpeditionUnlocked"
          :classic-solved="classicSolvedToday"
          :score="score"
          :max-score="maxScore"
          :total-coins="totalCoins"
          :medal="lastMedal"
          :solved="lastSolved"
          :pulse="scorePulse"
          @select-mode="selectMode"
        />

        <GameBoard
          :board="game.board"
          :puzzle-type="game.puzzleType"
          :tiles="tiles"
          :current-tile-index="currentTileIndex"
          :active-set="activeSet"
          :visited-set="visited"
          :hinted-tiles="hintedTiles"
          :path-history="pathHistory"
          :disabled="ended || loading"
          @select="moveTo"
          @scoring-move="onScoringMove"
        />

        <GameBoardFooter
          :status="status"
          :hint-message="hintMessage"
          :attempt-number="attemptNumber"
          :medal="lastMedal"
          :next-reset-countdown="nextResetCountdown"
          :expedition-just-unlocked="expeditionJustUnlocked"
          :hints-used="hintsUsed"
          :ended="ended"
          :solved="lastSolved"
          :can-retry="ended || moves > 1 || lastSolved"
          :can-switch-to-expedition="
            canSwitchToExpedition && (ended || moves <= 1 || lastSolved)
          "
          :loading="loading"
          :submitting="submitting"
          :tracking-disabled="trackingDisabled"
          :show-share="lastSolved"
          :share-handler="shareCurrentResult"
          @retry="retryCurrentGame"
          @hint="requestHint"
          @switch-expedition="switchToExpedition"
        />
      </section>

      <section v-else class="loading-card">
        <p>{{ status }}</p>
      </section>
    </main>

    <SolveCelebrationSheet
      :celebration="celebration"
      :next-reset-countdown="nextResetCountdown"
      :share-handler="shareCelebrationResult"
      @dismiss="dismissCelebration"
      @continue-to-expedition="continueToExpedition"
    />
  </div>
</template>

<style scoped>
.shell {
  min-height: calc(100dvh - 60px);
  padding: clamp(0.85rem, 2.5vw, 1.45rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.layout {
  max-width: 1040px;
  width: 100%;
  margin: 0 auto;
}

.board-column {
  display: grid;
  justify-items: center;
  gap: clamp(0.7rem, 1.8vh, 1rem);
  max-width: 620px;
  margin: 0 auto;
  text-align: center;
}

.board-column > * {
  animation: rise-in var(--transition-slow) both;
}

.board-column > *:nth-child(2) {
  animation-delay: 60ms;
}

.board-column > *:nth-child(3) {
  animation-delay: 120ms;
}

.loading-card {
  max-width: 560px;
  margin: 4rem auto 0;
  padding: 1.4rem;
  border-radius: var(--radius-xl);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.28);
  box-shadow: var(--shadow-border-dark), var(--shadow-lg);
  color: var(--color-gold-bright);
  text-align: center;
}

@media (max-width: 980px) {
  .shell {
    padding: 0.75rem;
  }
}
</style>
