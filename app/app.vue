<script setup lang="ts">
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
  lastTier,
  hintUsage,
  maxScore,
  totalCoins,
  completionPercent,
  loadCurrentGame,
  playAnother,
  moveTo,
  requestHint,
} = useGoldroadGame()
</script>

<template>
  <div class="shell">
    <NuxtRouteAnnouncer />

    <main class="layout">
      <GameSidebar
        :game-no="game?.gameNo ?? null"
        :score="score"
        :max-score="maxScore"
        :total-coins="totalCoins"
        :moves="moves"
        :completion-percent="completionPercent"
        :status="status"
        :hint-message="hintMessage"
        :difficulty-band="game?.difficultyBand ?? null"
        :hint-usage="hintUsage"
        :ended="ended"
        :loading="loading"
        @current="loadCurrentGame"
        @hint="requestHint"
      />

      <section class="main-stage">
        <GameBoard
          v-if="game"
          :board="game.board"
          :tiles="tiles"
          :current-tile-index="currentTileIndex"
          :active-set="activeSet"
          :visited-set="visited"
          :hinted-tiles="hintedTiles"
          :path-history="pathHistory"
          :disabled="ended || loading"
          @select="moveTo"
        />

        <CompletionPanel
          :visible="ended"
          :tier="lastTier"
          :score="score"
          :max-score="maxScore"
          :moves="moves"
          :status="status"
          :submitting="submitting || loading"
          @another="playAnother"
          @today="loadCurrentGame"
        />
      </section>
    </main>
  </div>
</template>

<style scoped>
:global(#__nuxt) {
  min-height: 100dvh;
}

.shell {
  min-height: 100dvh;
  padding: 1.3rem;
  background: var(--gradient-bg-main);
}

.layout {
  max-width: 1320px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 1.1rem;
}

.main-stage {
  display: grid;
  gap: 1.1rem;
  align-content: start;
}

.layout > * {
  animation: rise-in var(--transition-slow) both;
}

.layout > *:nth-child(2) {
  animation-delay: 80ms;
}

@media (max-width: 980px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .shell {
    padding: 0.9rem;
  }
}
</style>
