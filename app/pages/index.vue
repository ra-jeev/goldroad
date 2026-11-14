<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';

import { UI_COPY } from '../content/uiCopy';
import { getRoadDayKeyFromPlayableAt } from '../composables/useGoldroadLocalState';

// The How to Play sheet is this page's child route, /how-to-play. The pinned
// key keeps the board mounted when the sheet opens and closes, so a road in
// progress is never reloaded by it.
definePageMeta({ key: 'home' });

const { isHowToPlayOpen } = useHowToPlaySheet();
const siteUrl = useRuntimeConfig().public.siteUrl as string;
const siteDescription =
  'Play GoldRoad, a free daily number path puzzle. Build a route from Start to Finish and land exactly on the target score.';

// Tells search this is a free game. On the board's own address only.
// No `author`: the site publishes no person or studio name, only X handles.
useHead(() => ({
  script: isHowToPlayOpen.value
    ? []
    : [
        {
          type: 'application/ld+json',
          key: 'ld-home',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': ['VideoGame', 'WebApplication'],
            name: 'GoldRoad',
            url: siteUrl,
            description: siteDescription,
            genre: 'Puzzle',
            applicationCategory: 'GameApplication',
            operatingSystem: 'Any',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          }).replace(/</g, '\\u003c'),
        },
      ],
}));

const {
  game,
  tiles,
  currentTileIndex,
  tileFocusSignal,
  progressSyncSignal,
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
  deniedTileIndex,
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
} = await useGoldroadGame();

const currentRoadLabel = useState<string | null>(
  'current-road-label',
  () => null,
);
const localState = useGoldroadLocalState();
const { isBoardOverlayOpen } = useBoardOverlayGate();
const startInstructionDay = ref<string | null>(null);
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
    // A visitor who landed on the rules reads them first; the tutorial waits
    // until that sheet is closed.
    !isHowToPlayOpen.value &&
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
  watch(
    () => {
      if (
        !game.value || loading.value || newRoadReady.value || ended.value ||
        moves.value !== 1 || attemptNumber.value !== 1 || lastSolved.value ||
        guidePath.value.length > 0 || !v1CheckReady.value || isBoardOverlayOpen.value
      ) {
        return null;
      }
      return getRoadDayKeyFromPlayableAt(game.value.playableAt);
    },
    (day) => {
      if (day && localState.claimStartInstruction(day)) {
        startInstructionDay.value = day;
      }
    },
    { immediate: true, flush: 'post' },
  );

  watch(
    game,
    (currentGame) => {
      currentRoadLabel.value = currentGame
        ? `Day #${currentGame.gameNo}`
        : null;
    },
    { immediate: true },
  );
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
      <h1 v-if="!isHowToPlayOpen" class="sr-only">{{ UI_COPY.home.title }}</h1>
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
          :focus-signal="tileFocusSignal"
          :active-set="activeSet"
          :visited-set="visited"
          :hinted-tiles="hintedTiles"
          :guide-path="guidePath"
          :path-history="pathHistory"
          :disabled="ended || loading"
          :fail-signal="deadEndSignal"
          :denied-move-signal="deniedMoveSignal"
          :denied-tile-index="deniedTileIndex"
          @select="moveTo"
          @scoring-move="onScoringMove"
        />

        <GameBoardFooter
          :status="status"
          :start-instruction-day="startInstructionDay"
          :hint-message="hintMessage"
          :progress-sync-signal="progressSyncSignal"
          :solve-acknowledgement="solveAcknowledgement"
          :attempt-number="attemptNumber"
          :has-moved="moves > 1"
          :next-reset-countdown="nextResetCountdown"
          :hint-nudge-signal="hintNudgeSignal"
          :new-road-ready="newRoadReady"
          :expedition-just-unlocked="expeditionJustUnlocked"
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
        <p role="status">{{ status }}</p>
        <button
          type="button"
          class="loading-retry"
          :disabled="loading"
          @click="loadNewRoad"
        >
          {{ UI_COPY.runtime.retryLoadRoad }}
        </button>
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

    <!-- The How to Play sheet, when the route is /how-to-play. -->
    <NuxtPage />
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

.loading-retry {
  min-height: 2.75rem;
  padding: 0 1.1rem;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--gradient-button-primary);
  color: var(--color-text-on-gold);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.loading-retry:disabled {
  opacity: 0.5;
  cursor: progress;
}

@media (max-width: 980px) {
  /* Shares the token --tile-size derives from, so the board's computed width
     always matches the space this padding actually leaves. */
  .shell {
    padding: var(--board-margin);
  }
}
</style>
