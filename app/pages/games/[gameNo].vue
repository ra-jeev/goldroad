<script setup lang="ts">
import { watch } from 'vue';
import { UI_COPY } from '../../content/uiCopy';

const route = useRoute();
const gamesApi = useGamesApi();
const currentRoadLabel = useState<string | null>(
  'current-road-label',
  () => null,
);

const {
  availableGames,
  selectedMode,
  isExpeditionUnlocked,
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
  lastSolved,
  hintsUsed,
  trackingDisabled,
  attemptNumber,
  maxScore,
  totalCoins,
  classicSolvedToday,
  classicMedalToday,
  expeditionSolvedToday,
  expeditionMedalToday,
  celebration,
  successfulMoveSignal,
  deniedMoveSignal,
  deadEndSignal,
  solveCelebrationSignal,
  clearRoadDay,
  applyRoadDay,
  selectMode,
  retryCurrentGame,
  moveTo,
  requestHint,
  dismissCelebration,
} = useRoadDayGameplay({ entryType: 'archive' });

const soundEffects = useSoundEffects();
const loadError = ref<string | null>(null);
const busy = computed(() => loading.value || submitting.value);
const formattedDate = computed(() => {
  if (!game.value) return '';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(game.value.playableAt));
});

watchEffect(() => {
  currentRoadLabel.value = game.value
    ? `Road ${game.value.gameNo} · ${formattedDate.value}`
    : null;
});

async function loadReplayGame() {
  const gameNo = Number.parseInt(String(route.params.gameNo ?? ''), 10);
  if (!Number.isInteger(gameNo) || gameNo <= 0) {
    loadError.value = 'Invalid road number.';
    loading.value = false;
    currentRoadLabel.value = null;
    clearRoadDay();
    return;
  }

  loading.value = true;
  loadError.value = null;
  status.value = UI_COPY.runtime.loadingGame;

  try {
    const roadDay = await gamesApi.getGameBoard(gameNo);
    applyRoadDay(roadDay, {
      preferredMode: selectedMode.value,
    });
  } catch {
    loadError.value = 'This archived road is unavailable right now.';
    currentRoadLabel.value = null;
    clearRoadDay();
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.params.gameNo,
  () => {
    if (import.meta.client) {
      void loadReplayGame();
    }
  },
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

watch(solveCelebrationSignal, () => {
  soundEffects.playSolve();
}, { flush: 'sync' });

onMounted(() => {
  void loadReplayGame();
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
      <section v-if="loading" class="state-card">
        <p>{{ status }}</p>
      </section>

      <section v-else-if="loadError" class="state-card state-card--error">
        <p>{{ loadError }}</p>
        <NuxtLink to="/games" class="btn btn--secondary">
          Back to Past Roads
        </NuxtLink>
      </section>

      <section v-else-if="game" class="board-column">
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
          :disabled="ended || busy"
          @select="moveTo"
          @scoring-move="onScoringMove"
        />

        <GameBoardFooter
          :status="status"
          :hint-message="hintMessage"
          :attempt-number="attemptNumber"
          :has-moved="moves > 1"
          :show-next-reset-countdown="false"
          :show-stats-link="false"
          secondary-link-to="/games"
          secondary-link-label="Back to Past Roads"
          :expedition-just-unlocked="false"
          :hints-used="hintsUsed"
          :ended="ended"
          :solved="lastSolved"
          :can-retry="ended || moves > 1"
          :can-switch-to-expedition="false"
          :loading="loading"
          :submitting="submitting"
          :tracking-disabled="trackingDisabled"
          @retry="retryCurrentGame"
          @hint="requestHint"
        />
      </section>
    </main>

    <SolveCelebrationSheet
      :celebration="celebration"
      @dismiss="dismissCelebration"
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

.state-card {
  display: grid;
  gap: 0.7rem;
  width: 100%;
  padding: clamp(1.1rem, 3vw, 1.4rem);
  border-radius: var(--radius-lg);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
  box-shadow: var(--shadow-lg);
}

.state-card {
  max-width: 560px;
  margin: 4rem auto 0;
  text-align: center;
  color: var(--color-gold-bright);
}

.state-card--error {
  justify-items: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: start;
  min-height: 2.35rem;
  padding: 0.6rem 1rem;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  font: inherit;
  font-weight: 800;
  font-size: var(--font-size-caption);
  text-decoration: none;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.btn--secondary {
  color: rgb(var(--color-gold-rgb) / 0.88);
  background: rgb(var(--color-gold-rgb) / 0.08);
  border-color: rgb(var(--color-gold-rgb) / 0.28);
}

.btn:hover,
:deep(.board-footer-card .link-button.secondary:hover) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

:deep(.board-footer-card .link-button.secondary) {
  width: auto;
  min-width: 2.35rem;
  height: 2.35rem;
  padding: 0 1rem;
  border-radius: var(--radius-full);
  color: rgb(var(--color-gold-rgb) / 0.88);
  background: rgb(var(--color-gold-rgb) / 0.08);
  border-color: rgb(var(--color-gold-rgb) / 0.28);
  font-size: var(--font-size-caption);
}

@media (max-width: 760px) {
  .shell {
    padding: 0.75rem;
  }
}
</style>
