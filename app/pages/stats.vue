<script setup lang="ts">
// TODO: Implement stats composable
const stats = ref({
  gamesPlayed: 0,
  currentStreak: 0,
  maxStreak: 0,
  totalScore: 0,
  averageScore: 0,
  goldTiers: 0,
  silverTiers: 0,
  bronzeTiers: 0,
})
</script>

<template>
  <div class="shell">
    <div class="container">
      <header class="page-header">
        <h1>Your Stats</h1>
        <p class="subtitle">Track your Goldroad journey</p>
      </header>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ stats.gamesPlayed }}</div>
          <div class="stat-label">Games Played</div>
        </div>

        <div class="stat-card">
          <div class="stat-value">{{ stats.currentStreak }}</div>
          <div class="stat-label">Current Streak</div>
        </div>

        <div class="stat-card">
          <div class="stat-value">{{ stats.maxStreak }}</div>
          <div class="stat-label">Best Streak</div>
        </div>

        <div class="stat-card">
          <div class="stat-value">{{ stats.averageScore }}</div>
          <div class="stat-label">Avg Score</div>
        </div>
      </div>

      <section class="tier-section">
        <h2>Completion Tiers</h2>
        <div class="tier-grid">
          <div class="tier-card tier-gold">
            <div class="tier-icon">🥇</div>
            <div class="tier-count">{{ stats.goldTiers }}</div>
            <div class="tier-label">Gold</div>
          </div>

          <div class="tier-card tier-silver">
            <div class="tier-icon">🥈</div>
            <div class="tier-count">{{ stats.silverTiers }}</div>
            <div class="tier-label">Silver</div>
          </div>

          <div class="tier-card tier-bronze">
            <div class="tier-icon">🥉</div>
            <div class="tier-count">{{ stats.bronzeTiers }}</div>
            <div class="tier-label">Bronze</div>
          </div>
        </div>
      </section>
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

.tier-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
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
}
</style>
