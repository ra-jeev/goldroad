<script setup lang="ts">
const localStats = useLocalPlayerStats()
const localProgress = useLocalGameProgress()
const summary = localStats.summary
const recentDays = localStats.recentDays
const loading = ref(true)

function getStoredPlayerUUID(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('goldroad-player-uuid')
}

function formatDay(day: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`))
}

function hintTotal(hints: { level1: number; level2: number; level3: number }): number {
  return hints.level1 + hints.level2 + hints.level3
}

onMounted(() => {
  const playerUUID = getStoredPlayerUUID()
  if (playerUUID) {
    localStats.load(playerUUID)
    localProgress.load(playerUUID)

    if (localProgress.state.value) {
      localStats.syncCurrentDay(
        playerUUID,
        localProgress.state.value.day,
        localProgress.state.value.games,
      )
    }
  }

  loading.value = false
})
</script>

<template>
  <div class="shell">
    <div class="container">
      <header class="page-header">
        <h1>Your Stats</h1>
        <p class="subtitle">Local progress, medals, streaks, and hint usage across your recent roads.</p>
      </header>

      <section v-if="loading" class="empty-state">
        <h2>Loading stats…</h2>
      </section>

      <section v-else-if="!summary.modeSessionsPlayed" class="empty-state">
        <h2>No stats yet</h2>
        <p>Finish a road or use a hint and this page will start filling in automatically.</p>
      </section>

      <template v-else>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ summary.roadDaysPlayed }}</div>
            <div class="stat-label">Road Days</div>
          </div>

          <div class="stat-card">
            <div class="stat-value">{{ summary.exactSolves }}</div>
            <div class="stat-label">Exact Solves</div>
          </div>

          <div class="stat-card">
            <div class="stat-value">{{ summary.currentClassicStreak }}</div>
            <div class="stat-label">Classic Streak</div>
          </div>

          <div class="stat-card">
            <div class="stat-value">{{ summary.totalHints }}</div>
            <div class="stat-label">Hints Used</div>
          </div>
        </div>

        <div class="secondary-grid">
          <article class="detail-card">
            <span class="detail-label">Solve Rate</span>
            <strong>{{ summary.solveRate }}%</strong>
          </article>

          <article class="detail-card">
            <span class="detail-label">Best Classic Streak</span>
            <strong>{{ summary.bestClassicStreak }}</strong>
          </article>

          <article class="detail-card">
            <span class="detail-label">Mode Sessions</span>
            <strong>{{ summary.modeSessionsPlayed }}</strong>
          </article>

          <article class="detail-card">
            <span class="detail-label">Avg Solve Attempt</span>
            <strong>{{ summary.averageSolvedAttempts }}</strong>
          </article>
        </div>

        <section class="tier-section">
          <h2>Medal Breakdown</h2>
          <div class="tier-grid">
            <div class="tier-card tier-gold">
              <div class="tier-count">{{ summary.medalCounts.gold }}</div>
              <div class="tier-label">Gold</div>
            </div>

            <div class="tier-card tier-silver">
              <div class="tier-count">{{ summary.medalCounts.silver }}</div>
              <div class="tier-label">Silver</div>
            </div>

            <div class="tier-card tier-bronze">
              <div class="tier-count">{{ summary.medalCounts.bronze }}</div>
              <div class="tier-label">Bronze</div>
            </div>
          </div>
        </section>

        <section class="history-section">
          <div class="history-header">
            <h2>Recent Road Log</h2>
            <p>Each day tracks Classic and Expedition separately.</p>
          </div>

          <div class="history-list">
            <article v-for="entry in recentDays" :key="entry.day" class="history-card">
              <div class="history-top">
                <div>
                  <p class="history-day">{{ formatDay(entry.day) }}</p>
                  <h3>Road {{ entry.gameNo }}</h3>
                </div>
              </div>

              <div class="history-modes">
                <section v-if="entry.modes.classic" class="mode-card">
                  <div class="mode-head">
                    <strong>Classic</strong>
                    <span class="mode-badge" :class="{ 'mode-badge--solved': entry.modes.classic.solved }">
                      {{ entry.modes.classic.solved ? 'Solved' : 'Tried' }}
                    </span>
                  </div>
                  <p>Attempts: {{ entry.modes.classic.attempts }}</p>
                  <p>Best score: {{ entry.modes.classic.bestScore }}</p>
                  <p>Hints: {{ hintTotal(entry.modes.classic.hints) }}</p>
                </section>

                <section v-if="entry.modes.expedition" class="mode-card">
                  <div class="mode-head">
                    <strong>Expedition</strong>
                    <span class="mode-badge" :class="{ 'mode-badge--solved': entry.modes.expedition.solved }">
                      {{ entry.modes.expedition.solved ? 'Solved' : 'Tried' }}
                    </span>
                  </div>
                  <p>Attempts: {{ entry.modes.expedition.attempts }}</p>
                  <p>Best score: {{ entry.modes.expedition.bestScore }}</p>
                  <p>Hints: {{ hintTotal(entry.modes.expedition.hints) }}</p>
                </section>
              </div>
            </article>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.shell {
  min-height: calc(100dvh - 60px);
  padding: 1.3rem;
}

.container {
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
  display: grid;
  gap: 0.45rem;
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

.empty-state {
  padding: 2rem;
  border-radius: var(--radius-lg);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
  color: rgb(var(--color-gold-rgb) / 0.82);
}

.empty-state h2,
.history-header h2,
.history-card h3 {
  margin: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.secondary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  text-align: center;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--color-gold);
  margin-bottom: 0.5rem;
}

.stat-label {
  color: var(--color-gold-muted);
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-card {
  display: grid;
  gap: 0.4rem;
  padding: 1.15rem 1.2rem;
  border-radius: var(--radius-lg);
  background: rgb(var(--color-gold-rgb) / 0.06);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.16);
}

.detail-card strong {
  color: var(--color-gold);
  font-size: 1.4rem;
}

.detail-label {
  color: rgb(var(--color-gold-rgb) / 0.72);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.tier-section {
  margin-top: 3rem;
}

.tier-section h2 {
  color: var(--color-gold);
  font-size: 1.8rem;
  margin: 0 0 1.5rem;
  text-align: center;
}

.tier-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.tier-card {
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
  border-radius: var(--radius-lg);
  padding: 2rem 1.5rem;
  text-align: center;
}

.tier-count {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-gold);
  margin-bottom: 0.5rem;
}

.tier-label {
  color: var(--color-gold-muted);
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.history-section {
  margin-top: 3rem;
}

.history-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.history-header p,
.history-day,
.mode-card p {
  margin: 0;
}

.history-header p,
.history-day,
.mode-card p {
  color: rgb(var(--color-gold-rgb) / 0.78);
}

.history-list {
  display: grid;
  gap: 1rem;
}

.history-card {
  display: grid;
  gap: 1rem;
  padding: 1.2rem;
  border-radius: var(--radius-lg);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
}

.history-top {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.history-modes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.9rem;
}

.mode-card {
  display: grid;
  gap: 0.45rem;
  padding: 0.95rem 1rem;
  border-radius: var(--radius-md);
  background: rgb(var(--color-gold-rgb) / 0.06);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.16);
}

.mode-head {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: center;
}

.mode-head strong,
.history-card h3 {
  color: var(--color-gold);
}

.mode-badge {
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.08);
  color: rgb(var(--color-gold-rgb) / 0.78);
  font-size: 0.78rem;
  font-weight: 700;
}

.mode-badge--solved {
  color: var(--color-active);
  background: rgb(var(--color-active-rgb) / 0.12);
  border: 1px solid rgb(var(--color-active-rgb) / 0.24);
}

@media (max-width: 768px) {
  .shell {
    padding: 0.9rem;
  }

  .page-header h1 {
    font-size: 2rem;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .secondary-grid,
  .history-modes,
  .history-header {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
