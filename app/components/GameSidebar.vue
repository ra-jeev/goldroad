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
        <span class="legend-line open" />
        <span>Open road</span>
      </div>
      <div class="legend-row">
        <span class="legend-line traversed" />
        <span>Your path</span>
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
      <div class="legend-row">
        <span class="legend-dot dot-start" />
        <span>Start</span>
      </div>
      <div class="legend-row">
        <span class="legend-dot dot-end" />
        <span>End</span>
      </div>
      <p class="status-copy">{{ status }}</p>
    </section>
  </aside>
</template>

<style scoped>
.sidebar {
  display: grid;
  gap: 1rem;
}

.hero-card,
.detail-card,
.hint-card,
.legend-card {
  border-radius: 24px;
  padding: 1rem;
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 50%),
    0 20px 42px rgb(0 0 0 / 40%),
    inset 0 1px 0 rgb(218 165 32 / 10%);
}

.hero-card {
  background:
    radial-gradient(ellipse 120% 90% at 10% 0%, rgb(218 165 32 / 14%) 0%, transparent 60%),
    linear-gradient(160deg, #1e1004 0%, #150c03 62%, #0e0802 100%);
  border: 1px solid rgb(218 165 32 / 30%);
  color: #e8c84a;
}

.eyebrow {
  margin: 0;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgb(218 165 32 / 65%);
}

.hero-card h1,
.hint-card h2,
.legend-card h2 {
  margin: 0.25rem 0 0;
  color: goldenrod;
}

.hero-card h1 {
  font-size: 1.72rem;
  letter-spacing: 0.01em;
  color: goldenrod;
}

.hero-copy {
  margin: 0.65rem 0 0;
  color: rgb(218 165 32 / 60%);
  line-height: 1.45;
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
  border-radius: 20px;
  padding: 0.9rem;
  background:
    radial-gradient(ellipse 120% 80% at 50% -20%, rgb(218 165 32 / 10%) 0%, transparent 60%),
    linear-gradient(180deg, #1e1407 0%, #150e04 100%);
  border: 1px solid rgb(218 165 32 / 20%);
}

.metric-label {
  display: block;
  margin-bottom: 0.3rem;
  color: rgb(218 165 32 / 55%);
  font-size: 0.82rem;
}

.metrics-grid strong,
.detail-row strong {
  color: goldenrod;
  font-size: 1.14rem;
  letter-spacing: 0.01em;
}

.detail-card,
.legend-card {
  background: linear-gradient(180deg, #1e1407 0%, #150e04 100%);
  border: 1px solid rgb(218 165 32 / 18%);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.35rem 0;
  color: rgb(218 165 32 / 70%);
}

.detail-row + .detail-row {
  border-top: 1px solid rgb(218 165 32 / 12%);
}

.hint-card {
  background:
    radial-gradient(ellipse 100% 80% at 95% 0%, rgb(180 80 0 / 12%) 0%, transparent 55%),
    linear-gradient(180deg, #1e1407 0%, #150e04 100%);
  border: 1px solid rgb(180 80 0 / 30%);
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
  background: rgb(218 165 32 / 15%);
  color: goldenrod;
  border: 1px solid rgb(218 165 32 / 30%);
  font-size: 0.75rem;
  font-weight: 700;
}

.mini-status.ended {
  background: rgb(180 80 0 / 20%);
  color: #f59e0b;
  border-color: rgb(180 80 0 / 40%);
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
  color: #d4a044;
  line-height: 1.4;
}

.hint-message.empty {
  color: rgb(218 165 32 / 40%);
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: 0.7rem;
  color: rgb(218 165 32 / 70%);
}

.legend-chip {
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 999px;
  display: inline-block;
}

.chip-active {
  background: rgb(68 221 25 / 50%);
  border: 2px solid rgb(68 221 25);
}

.chip-done {
  background: linear-gradient(135deg, rgb(212 175 55), rgb(184 142 30));
  box-shadow: 0 0 6px 2px rgb(218 165 32 / 40%);
}

.legend-line {
  width: 2.2rem;
  height: 0.45rem;
  border-radius: 999px;
  display: inline-block;
}

.legend-line.blocked { background: #fc2f00; }
.legend-line.cost { background: #f59e0b; }
.legend-line.bonus { background: #22c55e; }
.legend-line.open { background: rgb(218 165 32 / 20%); }
.legend-line.traversed { background: goldenrod; box-shadow: 0 0 4px rgb(218 165 32 / 40%); }

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  margin-left: 0.35rem;
}

.dot-start {
  background: #22c55e;
  border: 1.5px solid #a7f3d0;
  box-shadow: 0 0 4px rgb(34 197 94 / 50%);
}

.dot-end {
  background: #dc2626;
  border: 1.5px solid #fca5a5;
  box-shadow: 0 0 4px rgb(220 38 38 / 40%);
}

.status-copy {
  margin: 0.9rem 0 0;
  color: rgb(218 165 32 / 50%);
  line-height: 1.42;
}

button {
  border: 0;
  border-radius: 15px;
  padding: 0.7rem 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 140ms ease, box-shadow 140ms ease;
}

.secondary {
  color: goldenrod;
  background: rgb(218 165 32 / 12%);
  border: 1px solid rgb(218 165 32 / 28%);
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgb(0 0 0 / 35%);
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 980px) {
  .hero-card h1 {
    font-size: 1.5rem;
  }
}
</style>
