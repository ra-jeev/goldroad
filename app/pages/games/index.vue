<script setup lang="ts">
const gamesApi = useGamesApi();
const games = ref<
  Array<Awaited<ReturnType<typeof gamesApi.getPastGames>>['games'][number]>
>([]);
const loading = ref(true);
const error = ref<string | null>(null);

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatDifficulty(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

onMounted(async () => {
  try {
    const response = await gamesApi.getPastGames(60);
    games.value = response.games;
  } catch {
    error.value = 'Past games are unavailable right now.';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="shell">
    <div class="container">
      <header class="page-header">
        <h1>Past Games</h1>
        <p class="subtitle">Browse and replay previous road days</p>
      </header>

      <div v-if="loading" class="loading-state">
        <p>Loading games...</p>
      </div>

      <div v-else-if="error" class="empty-state">
        <p>{{ error }}</p>
      </div>

      <div v-else-if="games.length === 0" class="empty-state">
        <p>No past games available yet.</p>
        <p class="hint">
          Older roads will appear here once the archive data is available.
        </p>
      </div>

      <div v-else class="games-grid">
        <article v-for="game in games" :key="game.gameNo" class="game-card">
          <div class="game-header">
            <div>
              <h3>Road {{ game.gameNo }}</h3>
              <span class="game-date">{{ formatDate(game.playableAt) }}</span>
            </div>

            <span class="day-pill">{{
              game.expedition ? 'Classic + Expedition' : 'Classic'
            }}</span>
          </div>

          <div class="mode-list">
            <section v-if="game.classic" class="mode-card">
              <div class="mode-head">
                <strong>Classic</strong>
                <span class="difficulty-pill">{{
                  formatDifficulty(game.classic.difficultyBand)
                }}</span>
              </div>
              <div class="mode-stats">
                <div class="game-stat">
                  <span class="label">Target</span>
                  <span class="value">{{ game.classic.maxScore }}</span>
                </div>
                <div class="game-stat">
                  <span class="label">Board Coins</span>
                  <span class="value">{{ game.classic.totalCoins }}</span>
                </div>
              </div>
            </section>

            <section
              v-if="game.expedition"
              class="mode-card mode-card--expedition"
            >
              <div class="mode-head">
                <strong>Expedition</strong>
                <span class="difficulty-pill">{{
                  formatDifficulty(game.expedition.difficultyBand)
                }}</span>
              </div>
              <div class="mode-stats">
                <div class="game-stat">
                  <span class="label">Target</span>
                  <span class="value">{{ game.expedition.maxScore }}</span>
                </div>
                <div class="game-stat">
                  <span class="label">Board Coins</span>
                  <span class="value">{{ game.expedition.totalCoins }}</span>
                </div>
              </div>
            </section>
          </div>

          <NuxtLink :to="`/games/${game.gameNo}`" class="replay-btn">
            Replay Road Day
          </NuxtLink>
        </article>
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
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.game-card {
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: grid;
  gap: 1rem;
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
  gap: 1rem;
}

.game-header h3 {
  color: var(--color-gold);
  margin: 0;
  font-size: 1.3rem;
}

.game-date {
  display: block;
  margin-top: 0.35rem;
  color: var(--color-gold-muted);
  font-size: 0.85rem;
}

.day-pill,
.difficulty-pill {
  align-self: start;
  padding: 0.28rem 0.65rem;
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.12);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.24);
  color: rgb(var(--color-gold-rgb) / 0.88);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.mode-list {
  display: grid;
  gap: 0.8rem;
}

.mode-card {
  display: grid;
  gap: 0.7rem;
  padding: 0.9rem 1rem;
  border-radius: var(--radius-md);
  background: rgb(var(--color-gold-rgb) / 0.06);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.14);
}

.mode-card--expedition {
  border-color: rgb(var(--color-active-rgb) / 0.2);
  background: rgb(var(--color-active-rgb) / 0.08);
}

.mode-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.mode-head strong {
  color: var(--color-gold);
}

.mode-stats {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
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

.replay-btn {
  width: 100%;
  padding: 0.7rem;
  background: rgb(var(--color-gold-rgb) / 0.15);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.3);
  border-radius: var(--radius-md);
  color: var(--color-gold);
  font-weight: 600;
  text-align: center;
  text-decoration: none;
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

  .game-header,
  .mode-head {
    display: grid;
  }
}
</style>
