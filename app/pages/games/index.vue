<script setup lang="ts">
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
            <span class="card-arrow" aria-hidden="true">→</span>
          </div>

          <div class="mode-list">
            <span v-if="game.classic" class="mode-pill mode-pill--classic">
              Classic
            </span>

            <span
              v-if="game.expedition"
              class="mode-pill mode-pill--expedition"
            >
              Expedition
            </span>
          </div>

          <span class="card-action">Replay road day</span>
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
  gap: 0.9rem;
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

.game-card:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
  border-color: rgb(var(--color-gold-rgb) / 0.42);
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

.card-arrow {
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-circle);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
  background: rgb(var(--color-gold-rgb) / 0.08);
  color: var(--color-gold);
  font-size: 1.15rem;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast);
}

.game-card:hover .card-arrow {
  transform: translateX(2px);
  background: rgb(var(--color-gold-rgb) / 0.15);
}

.mode-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.mode-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.32rem 0.58rem;
  border-radius: var(--radius-full);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
  background: rgb(var(--color-gold-rgb) / 0.06);
  color: var(--color-gold);
  font-size: 0.82rem;
  font-weight: 800;
}

.card-action {
  color: rgb(var(--color-gold-rgb) / 0.78);
  font-size: 0.8rem;
  font-weight: 800;
}

@media (max-width: 600px) {
  .games-grid {
    grid-template-columns: 1fr;
  }
}
</style>
