<script setup lang="ts">
import type { DifficultyBand } from '../../shared/types/game'

const props = defineProps<{
  gameNo: number | null
  score: number
  maxScore: number
  totalCoins: number
  moves: number
  completionPercent: number
  status: string
  hintMessage: string | null
  difficultyBand: DifficultyBand | null
  routeCount: number
  goldSilverGap: number
  hintUsage: {
    level1: number
    level2: number
    level3: number
  }
  ended: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  current: []
  hint: [level: 1 | 2 | 3]
}>()
</script>

<template>
  <aside class="sidebar">
    <section class="hero-card">
      <p class="eyebrow">Daily Test Build</p>
      <h1>Road {{ gameNo ?? '...' }}</h1>
      <p class="hero-copy">The goal is not to collect everything. The goal is to discover the best legal route.</p>
      <div class="hero-actions">
        <button class="secondary" :disabled="loading" @click="emit('current')">Reload Today</button>
      </div>
    </section>

    <section class="metrics-grid">
      <article>
        <span class="metric-label">Score</span>
        <strong>{{ score }} / {{ maxScore }}</strong>
      </article>
      <article>
        <span class="metric-label">Board Coins</span>
        <strong>{{ totalCoins }}</strong>
      </article>
      <article>
        <span class="metric-label">Moves</span>
        <strong>{{ moves }}</strong>
      </article>
      <article>
        <span class="metric-label">Progress</span>
        <strong>{{ completionPercent }}%</strong>
      </article>
    </section>

    <section class="detail-card">
      <div class="detail-row">
        <span>Difficulty</span>
        <strong>{{ difficultyBand ?? '—' }}</strong>
      </div>
      <div class="detail-row">
        <span>Route Count</span>
        <strong>{{ routeCount }}</strong>
      </div>
      <div class="detail-row">
        <span>Gold Gap</span>
        <strong>{{ goldSilverGap }}</strong>
      </div>
    </section>

    <section class="hint-card">
      <div class="card-header">
        <div>
          <p class="eyebrow">Help</p>
          <h2>Hints</h2>
        </div>
        <span class="mini-status" :class="{ ended }">{{ ended ? 'Run ended' : 'Run active' }}</span>
      </div>

      <div class="hint-buttons">
        <button class="secondary" :disabled="ended || loading" @click="emit('hint', 1)">
          Hint 1
          <small>Used {{ hintUsage.level1 }}</small>
        </button>
        <button class="secondary" :disabled="ended || loading" @click="emit('hint', 2)">
          Hint 2
          <small>Used {{ hintUsage.level2 }}</small>
        </button>
        <button class="secondary" :disabled="ended || loading" @click="emit('hint', 3)">
          Hint 3
          <small>Used {{ hintUsage.level3 }}</small>
        </button>
      </div>

      <p class="hint-message" :class="{ empty: !hintMessage }">
        {{ hintMessage ?? 'Hints will appear here. Level 2/3 also mark tiles on the board.' }}
      </p>
    </section>

    <section class="legend-card">
      <h2>Legend</h2>
      <div class="legend-row">
        <span class="legend-chip chip-active" />
        <span>Legal next move</span>
      </div>
      <div class="legend-row">
        <span class="legend-chip chip-done" />
        <span>Visited tile</span>
      </div>
      <div class="legend-row">
        <span class="legend-line blocked" />
        <span>Blocked road</span>
      </div>
      <div class="legend-row">
        <span class="legend-line cost" />
        <span>Cost road</span>
      </div>
      <div class="legend-row">
        <span class="legend-line bonus" />
        <span>Bonus road</span>
      </div>
      <p class="status-copy">{{ status }}</p>
    </section>
  </aside>
</template>

<style scoped>
.sidebar {
  display: grid;
  gap: 0.95rem;
}

.hero-card,
.detail-card,
.hint-card,
.legend-card {
  border-radius: 22px;
  padding: 1rem;
  box-shadow: 0 18px 36px rgb(20 30 58 / 10%);
}

.hero-card {
  background: linear-gradient(160deg, #1f2d5c 0%, #304989 60%, #5671bb 100%);
  color: #f4f7ff;
}

.eyebrow {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.8;
}

.hero-card h1,
.hint-card h2,
.legend-card h2 {
  margin: 0.25rem 0 0;
}

.hero-copy {
  margin: 0.65rem 0 0;
  color: #d9e4ff;
}

.hero-actions {
  margin-top: 0.9rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.metrics-grid article {
  border-radius: 18px;
  padding: 0.9rem;
  background: linear-gradient(180deg, #fffefa 0%, #f5f7ff 100%);
  border: 1px solid #dde5f6;
}

.metric-label {
  display: block;
  margin-bottom: 0.3rem;
  color: #67779d;
  font-size: 0.82rem;
}

.metrics-grid strong,
.detail-row strong {
  color: #182450;
  font-size: 1.1rem;
}

.detail-card,
.legend-card {
  background: linear-gradient(180deg, #fffefa 0%, #f7f8fc 100%);
  border: 1px solid #e4e8f2;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.35rem 0;
  color: #405179;
}

.detail-row + .detail-row {
  border-top: 1px solid #e6eaf4;
}

.hint-card {
  background: linear-gradient(180deg, #fff7ef 0%, #fffefe 100%);
  border: 1px solid #f4dcc6;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 1rem;
}

.mini-status {
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  background: #e5efff;
  color: #23407d;
  font-size: 0.75rem;
  font-weight: 700;
}

.mini-status.ended {
  background: #efe3ff;
  color: #6b2fb8;
}

.hint-buttons {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.9rem;
}

.hint-buttons button {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.hint-buttons small {
  font-size: 0.72rem;
  opacity: 0.7;
}

.hint-message {
  min-height: 3.1rem;
  margin: 0.85rem 0 0;
  color: #663b0f;
}

.hint-message.empty {
  color: #886a49;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: 0.7rem;
  color: #394a73;
}

.legend-chip {
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 999px;
  display: inline-block;
}

.chip-active {
  background: #3d6cff;
}

.chip-done {
  background: #a6c77a;
}

.legend-line {
  width: 2.2rem;
  height: 0.45rem;
  border-radius: 999px;
  display: inline-block;
}

.legend-line.blocked { background: #111827; }
.legend-line.cost { background: #f59e0b; }
.legend-line.bonus { background: #0f9d72; }

.status-copy {
  margin: 0.9rem 0 0;
  color: #53658d;
}

button {
  border: 0;
  border-radius: 14px;
  padding: 0.7rem 0.9rem;
  font-weight: 700;
  cursor: pointer;
}

.secondary {
  color: #203158;
  background: #e8efff;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
