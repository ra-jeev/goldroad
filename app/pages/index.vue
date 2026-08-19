<script setup lang="ts">
import { onMounted, onUnmounted, watch, watchEffect } from 'vue';

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
  guidePath,
  hintPending,
  hintsRemaining,
  ended,
  loading,
  submitting,
  status,
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
  classicMedalToday,
  expeditionSolvedToday,
  expeditionMedalToday,
  attemptNumber,
  nextResetCountdown,
  newRoadReady,
  loadNewRoad,
  canSwitchToExpedition,
  celebration,
  successfulMoveSignal,
  deniedMoveSignal,
  deadEndSignal,
  undoSignal,
  hintNudgeSignal,
  solveCelebrationSignal,
  solveAcknowledgement,
  selectMode,
  retryCurrentGame,
  undoLastStep,
  canUndo,
  overTarget,
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
const soundEffects = useSoundEffects();
const { isTutorialOpen, openTutorial } = useTutorialFlow();
const {
  showNotice: showV1WelcomeNotice,
  ready: v1CheckReady,
  check: checkV1Notice,
  dismissNotice: dismissV1Notice,
} = useV1ReturningPlayerNotice();
const { acknowledgeLatestUpdate } = useUpdatesNotice();
const checkedFirstRunTutorial = ref(false);

// A detected v1 player also has no v2 local progress yet, so the ordinary
// first-run-tutorial trigger below would otherwise fire independently of —
// and possibly race with — the welcome sheet. Hold off until we know
// definitively whether this is a returning v1 player, and never auto-open
// behind their back: the welcome sheet's own CTA is what opens the tutorial
// for them instead (see onV1ShowWhatsNew/onV1DismissWelcome).
const shouldShowFirstRunTutorial = computed(
  () =>
    Boolean(game.value) &&
    !loading.value &&
    !localState.tutorialState.value.completed &&
    !localState.tutorialState.value.lastSeenAt &&
    !localState.hasAnyLiveProgress.value &&
    v1CheckReady.value &&
    !showV1WelcomeNotice.value,
);

function onV1ShowWhatsNew() {
  checkedFirstRunTutorial.value = true;
  dismissV1Notice();
  acknowledgeLatestUpdate();
  openTutorial();
}

function onV1DismissWelcome() {
  checkedFirstRunTutorial.value = true;
  dismissV1Notice();
  acknowledgeLatestUpdate();
}

watchEffect(() => {
  currentRoadLabel.value = game.value
    ? `Day #${game.value.gameNo}`
    : null;
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

watch(successfulMoveSignal, () => {
  soundEffects.playMove();
}, { flush: 'sync' });

watch(deniedMoveSignal, () => {
  soundEffects.playDeniedMove();
}, { flush: 'sync' });

watch(deadEndSignal, () => {
  soundEffects.playDeadEnd();
}, { flush: 'sync' });

watch(undoSignal, () => {
  soundEffects.playUndo();
}, { flush: 'sync' });

watch(solveCelebrationSignal, () => {
  soundEffects.playSolve();
}, { flush: 'sync' });

onMounted(() => {
  void checkV1Notice();
});

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
          :classic-medal="classicMedalToday"
          :expedition-solved="expeditionSolvedToday"
          :expedition-medal="expeditionMedalToday"
          :score="score"
          :max-score="maxScore"
          :total-coins="totalCoins"
          :pulse="scorePulse"
          :over-target="overTarget"
          :mode-switch-locked="newRoadReady"
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
          :guide-path="guidePath"
          :path-history="pathHistory"
          :disabled="ended || loading"
          :fail-signal="deadEndSignal"
          @select="moveTo"
          @scoring-move="onScoringMove"
        />

        <GameBoardFooter
          :status="status"
          :hint-message="hintMessage"
          :solve-acknowledgement="solveAcknowledgement"
          :attempt-number="attemptNumber"
          :has-moved="moves > 1"
          :next-reset-countdown="nextResetCountdown"
          :hint-nudge-signal="hintNudgeSignal"
          :new-road-ready="newRoadReady"
          :expedition-just-unlocked="expeditionJustUnlocked"
          :hints-used="hintsUsed"
          :hints-remaining="hintsRemaining"
          :hint-pending="hintPending"
          :has-guide-path="guidePath.length > 0"
          :ended="ended"
          :solved="lastSolved"
          :can-retry="ended || moves > 1"
          :can-undo="canUndo"
          :can-switch-to-expedition="
            canSwitchToExpedition &&
            (ended || moves <= 1 || lastSolved) &&
            !newRoadReady
          "
          :loading="loading"
          :submitting="submitting"
          :tracking-disabled="trackingDisabled"
          :show-share="lastSolved"
          :share-handler="shareCurrentResult"
          @retry="retryCurrentGame"
          @undo="undoLastStep"
          @hint="requestHint"
          @switch-expedition="switchToExpedition"
          @load-new-road="loadNewRoad"
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

    <V1WelcomeSheet
      :visible="showV1WelcomeNotice"
      @show-whats-new="onV1ShowWhatsNew"
      @dismiss="onV1DismissWelcome"
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
  /* Shares the token --tile-size derives from, so the board's computed width
     always matches the space this padding actually leaves. */
  .shell {
    padding: var(--board-margin);
  }
}
</style>
