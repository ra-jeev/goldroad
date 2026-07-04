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
  attemptNumber,
  maxScore,
  totalCoins,
  celebration,
  clearRoadDay,
  applyRoadDay,
  selectMode,
  retryCurrentGame,
  moveTo,
  requestHint,
  dismissCelebration,
  shareCelebrationResult,
  shareCurrentResult,
} = useRoadDayGameplay({ entryType: 'archive' });

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
const difficultyLabel = computed(() => {
  if (!game.value) return '';
  return `${game.value.difficultyBand.charAt(0).toUpperCase()}${game.value.difficultyBand.slice(1)}`;
});

watchEffect(() => {
  currentRoadLabel.value = game.value
    ? `Road ${game.value.gameNo} · Archive`
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

onMounted(() => {
  void loadReplayGame();
});

onUnmounted(() => {
  currentRoadLabel.value = null;
});
</script>

<template>
  <div class="shell">
    <main class="layout">
      <section v-if="loading" class="state-card">
        <p>{{ status }}</p>
      </section>

      <section v-else-if="loadError" class="state-card state-card--error">
        <p>{{ loadError }}</p>
        <NuxtLink to="/games" class="back-link back-link--inline">
          Back to Past Games
        </NuxtLink>
      </section>

      <section v-else-if="game" class="board-column">
        <header class="archive-header">
          <div class="archive-header-top">
            <NuxtLink to="/games" class="back-link">
              Back to Past Games
            </NuxtLink>
          </div>

          <div class="archive-header-main">
            <div>
              <h1>Road {{ game.gameNo }}</h1>
              <p class="archive-subtitle">
                {{ formattedDate }} · {{ difficultyLabel }} difficulty ·
                Archived replay
              </p>
            </div>
          </div>

          <p class="archive-note">
            Replay any archived road day without affecting today's live board
            state.
          </p>
        </header>

        <GameBoardHeader
          :selected-mode="selectedMode"
          :has-expedition="Boolean(availableGames.expedition)"
          :is-expedition-unlocked="true"
          :classic-solved="false"
          :score="score"
          :max-score="maxScore"
          :total-coins="totalCoins"
          :medal="lastMedal"
          :solved="lastSolved"
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
        />

        <GameBoardFooter
          :status="status"
          :hint-message="hintMessage"
          :attempt-number="attemptNumber"
          :medal="lastMedal"
          :show-next-reset-countdown="false"
          :show-stats-link="false"
          secondary-link-to="/games"
          secondary-link-label="Back to Archive"
          :expedition-just-unlocked="false"
          :hints-used="hintsUsed"
          :ended="ended"
          :solved="lastSolved"
          :can-retry="ended || moves > 1 || lastSolved"
          :can-switch-to-expedition="false"
          :loading="loading"
          :submitting="submitting"
          :tracking-disabled="trackingDisabled"
          :show-share="lastSolved"
          :share-handler="shareCurrentResult"
          @retry="retryCurrentGame"
          @hint="requestHint"
        />
      </section>
    </main>

    <SolveCelebrationSheet
      :celebration="celebration"
      :share-handler="shareCelebrationResult"
      @dismiss="dismissCelebration"
    />
  </div>
</template>

<style scoped>
.shell {
  min-height: calc(100dvh - 60px);
  padding: clamp(0.85rem, 2.5vw, 1.45rem);
  display: grid;
  align-items: center;
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

.archive-header,
.state-card {
  display: grid;
  gap: 0.8rem;
  padding: 1rem 1.1rem;
  border-radius: 8px;
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.28);
  box-shadow: var(--shadow-border-dark), var(--shadow-lg);
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

.archive-header-top,
.archive-header-main {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 0.8rem;
}

.archive-header-main {
  align-items: end;
}

.archive-header h1 {
  margin: 0;
  color: var(--color-gold-bright);
}

.archive-subtitle,
.archive-note {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.72);
}

.archive-note {
  font-size: 0.92rem;
}

.back-link {
  color: var(--color-gold-bright);
  font-weight: 700;
  text-decoration: none;
}

.back-link--inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 180px;
  padding: 0.7rem 1rem;
  border-radius: var(--radius-sm);
  background: rgb(var(--color-gold-rgb) / 0.15);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.28);
}

.back-link:hover,
.back-link--inline:hover {
  text-decoration: underline;
}

@media (max-width: 760px) {
  .shell {
    padding: 0.75rem;
  }

  .archive-header-top,
  .archive-header-main {
    display: grid;
  }
}
</style>
