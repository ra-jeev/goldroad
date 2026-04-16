<script setup lang="ts">
import { UI_COPY } from '../content/uiCopy'

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
  hintUsage,
  maxScore,
  totalCoins,
  availableGames,
  selectedMode,
  isExpeditionUnlocked,
  classicSolvedToday,
  attemptNumber,
  roadHeading,
  canSwitchToExpedition,
  selectMode,
  retryCurrentGame,
  switchToExpedition,
  moveTo,
  requestHint,
} = useGoldroadGame()
</script>

<template>
  <div class="shell">
    <main class="layout">
      <section v-if="game" class="board-column">
        <section class="page-toolbar">
          <div>
            <p class="toolbar-eyebrow">{{ UI_COPY.sidebar.eyebrow }}</p>
            <h1 class="toolbar-heading">{{ roadHeading }}</h1>
          </div>
        </section>

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
        />

        <GameBoardFooter
          :status="status"
          :hint-message="hintMessage"
          :attempt-number="attemptNumber"
          :hint-usage="hintUsage"
          :ended="ended"
          :solved="lastSolved"
          :can-retry="ended || moves > 1"
          :can-switch-to-expedition="canSwitchToExpedition"
          :loading="loading"
          :submitting="submitting"
          @retry="retryCurrentGame"
          @hint="requestHint"
          @switch-expedition="switchToExpedition"
        />
      </section>

      <section v-else class="loading-card">
        <p>{{ status }}</p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: calc(100dvh - 60px);
  padding: 1.3rem;
}

.layout {
  max-width: 960px;
  margin: 0 auto;
}

.board-column {
  display: grid;
  gap: 0.9rem;
  max-width: 760px;
  margin: 0 auto;
}

.page-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.toolbar-eyebrow,
.toolbar-heading {
  margin: 0;
}

.toolbar-eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgb(var(--color-gold-rgb) / 0.7);
}

.toolbar-heading {
  color: var(--color-gold);
  font-size: clamp(1.5rem, 4vw, 2rem);
  line-height: 1.05;
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
    padding: 0.9rem;
  }
}
</style>
