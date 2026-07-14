<script setup lang="ts">
import { UI_COPY } from '../../content/uiCopy';
import { RECENT_ARCHIVE_DAY_LIMIT } from '../../../shared/utils/archive';

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
    const response = await gamesApi.getPastGames();
    games.value = response.games;
  } catch {
    error.value = 'Past roads are unavailable right now.';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="shell">
    <div class="container">
      <header class="page-header">
        <p class="eyebrow">Every road you can revisit</p>
        <h1>Past roads</h1>
        <p class="subtitle">
          Replay any of the latest {{ RECENT_ARCHIVE_DAY_LIMIT }} road days,
          Classic and Expedition alike.
        </p>
      </header>

      <section v-if="loading" class="panel panel--state">
        <p>Gathering the archive…</p>
      </section>

      <section v-else-if="error" class="panel panel--state">
        <p>{{ error }}</p>
      </section>

      <section v-else-if="games.length === 0" class="panel panel--state">
        <h2>No past roads yet</h2>
        <p>Older roads appear here once the archive fills in.</p>
      </section>

      <div v-else class="games-grid">
        <NuxtLink
          v-for="game in games"
          :key="game.gameNo"
          :to="`/games/${game.gameNo}`"
          class="panel game-card"
        >
          <div class="game-head">
            <div>
              <p class="eyebrow">{{ formatDate(game.playableAt) }}</p>
              <h2>Road {{ game.gameNo }}</h2>
            </div>
            <span class="day-pill">
              {{ game.expedition ? 'Classic + Expedition' : 'Classic' }}
            </span>
          </div>

          <div class="mode-list">
            <section v-if="game.classic" class="mode-card mode-card--classic">
              <div class="mode-head">
                <strong>Classic</strong>
                <span class="difficulty-pill">
                  {{ formatDifficulty(game.classic.difficultyBand) }}
                </span>
              </div>
              <div class="mode-stats">
                <div class="game-stat">
                  <span class="label">Target</span>
                  <span class="value">{{ game.classic.maxScore }}</span>
                </div>
                <div class="game-stat">
                  <span class="label">
                    {{ UI_COPY.boardHeader.metrics.boardCoins }}
                  </span>
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
                <span class="difficulty-pill">
                  {{ formatDifficulty(game.expedition.difficultyBand) }}
                </span>
              </div>
              <div class="mode-stats">
                <div class="game-stat">
                  <span class="label">Target</span>
                  <span class="value">{{ game.expedition.maxScore }}</span>
                </div>
                <div class="game-stat">
                  <span class="label">
                    {{ UI_COPY.boardHeader.metrics.boardCoins }}
                  </span>
                  <span class="value">{{ game.expedition.totalCoins }}</span>
                </div>
              </div>
            </section>
          </div>

          <span class="btn btn--primary">
            Replay road day
          </span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shell {
  min-height: calc(100dvh - 60px);
  padding: clamp(0.9rem, 2.5vw, 1.4rem);
}

.container {
  max-width: 1040px;
  margin: 0 auto;
  display: grid;
  gap: clamp(1rem, 2.5vw, 1.5rem);
}

.page-header {
  display: grid;
  gap: 0.25rem;
  text-align: center;
  justify-items: center;
}

.eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(var(--color-gold-rgb) / 0.6);
}

.page-header h1 {
  margin: 0;
  font-size: clamp(2rem, 6vw, 2.6rem);
  color: var(--color-gold-bright);
  line-height: 1.05;
}

.subtitle {
  margin: 0;
  max-width: 46ch;
  color: rgb(var(--color-gold-rgb) / 0.74);
}

.panel {
  border-radius: var(--radius-lg);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
  padding: clamp(1.1rem, 3vw, 1.4rem);
}

.panel--state {
  display: grid;
  gap: 0.4rem;
  justify-items: center;
  text-align: center;
  color: rgb(var(--color-gold-rgb) / 0.8);
}

.panel--state h2 {
  margin: 0;
  color: var(--color-gold-bright);
}

.panel--state p {
  margin: 0;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.game-card {
  display: grid;
  gap: 1rem;
  align-content: start;
  color: inherit;
  text-decoration: none;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast);
}

.game-card:hover {
  transform: translateY(-2px);
  border-color: rgb(var(--color-gold-rgb) / 0.38);
}

.game-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.game-head h2 {
  margin: 0.1rem 0 0;
  color: var(--color-gold-bright);
  font-size: 1.35rem;
}

.day-pill,
.difficulty-pill {
  align-self: start;
  padding: 0.26rem 0.6rem;
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.1);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.22);
  color: rgb(var(--color-gold-rgb) / 0.86);
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.mode-list {
  display: grid;
  gap: 0.7rem;
}

.mode-card {
  display: grid;
  gap: 0.6rem;
  padding: 0.85rem 1rem;
  border-radius: var(--radius-md);
  background: rgb(var(--color-gold-rgb) / 0.06);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.14);
}

.mode-card--expedition {
  border-color: rgb(var(--color-expedition-accent-rgb) / 0.24);
  background: rgb(var(--color-expedition-accent-rgb) / 0.08);
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

.mode-card--expedition .mode-head strong {
  color: var(--color-expedition-accent-bright);
}

.mode-stats {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.game-stat {
  display: grid;
  gap: 0.2rem;
}

.game-stat .label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(var(--color-gold-rgb) / 0.6);
}

.game-stat .value {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--color-gold-bright);
  font-variant-numeric: tabular-nums;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.65rem 1rem;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  font: inherit;
  font-weight: 800;
  text-decoration: none;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.btn--primary {
  color: var(--color-text-on-gold);
  background: var(--gradient-button-primary);
  box-shadow: 0 0 16px rgb(var(--color-gold-rgb) / 0.2);
}

.btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

@media (max-width: 600px) {
  .games-grid {
    grid-template-columns: 1fr;
  }
}
</style>
