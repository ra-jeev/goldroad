<script setup lang="ts">
// TODO: Implement games archive composable
const games = ref([
  // Placeholder data
])

const loading = ref(false)
</script>

<template>
  <div class="shell">
    <div class="container">
      <header class="page-header">
        <h1>Past Games</h1>
        <p class="subtitle">Browse and replay previous puzzles</p>
      </header>

      <div v-if="loading" class="loading-state">
        <p>Loading games...</p>
      </div>

      <div v-else-if="games.length === 0" class="empty-state">
        <p>No past games available yet.</p>
        <p class="hint">Complete today's puzzle to start building your archive!</p>
      </div>

      <div v-else class="games-grid">
        <!-- Game cards will go here -->
        <div class="game-card">
          <div class="game-header">
            <h3>Road #1</h3>
            <span class="game-date">Jan 1, 2026</span>
          </div>
          <div class="game-stats">
            <div class="game-stat">
              <span class="label">Score</span>
              <span class="value">1250</span>
            </div>
            <div class="game-stat">
              <span class="label">Tier</span>
              <span class="value tier-gold">Gold</span>
            </div>
          </div>
          <button class="replay-btn">Replay</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shell {
  min-height: calc(100dvh - 60px);
  padding: 1.3rem;
}

.container {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
  text-align: center;
}

.page-header h1 {
  font-size: 2.5rem;
  color: var(--color-gold);
  margin: 0 0 0.5rem;
}

.subtitle {
  color: var(--color-gold-muted);
  font-size: 1.1rem;
  margin: 0;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-gold-muted);
}

.empty-state .hint {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  opacity: 0.7;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.game-card {
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  transition: all var(--transition-fast);
}

.game-card:hover {
  border-color: rgb(var(--color-gold-rgb) / 0.4);
  transform: translateY(-2px);
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 1rem;
}

.game-header h3 {
  color: var(--color-gold);
  margin: 0;
  font-size: 1.3rem;
}

.game-date {
  color: var(--color-gold-muted);
  font-size: 0.85rem;
}

.game-stats {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1rem;
}

.game-stat {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.game-stat .label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-gold-muted);
}

.game-stat .value {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-gold);
}

.tier-gold {
  color: var(--color-gold-bright);
}

.replay-btn {
  width: 100%;
  padding: 0.7rem;
  background: rgb(var(--color-gold-rgb) / 0.15);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.3);
  border-radius: var(--radius-md);
  color: var(--color-gold);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.replay-btn:hover {
  background: rgb(var(--color-gold-rgb) / 0.25);
  border-color: rgb(var(--color-gold-rgb) / 0.5);
}

@media (max-width: 768px) {
  .shell {
    padding: 0.9rem;
  }

  .page-header h1 {
    font-size: 2rem;
  }

  .games-grid {
    grid-template-columns: 1fr;
  }
}
</style>
