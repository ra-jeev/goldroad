<script setup lang="ts">
import { ref } from 'vue'
import type { DifficultyBand } from '../../shared/types/game'

defineProps<{
  gameNo: number | null
  score: number
  maxScore: number
  totalCoins: number
  moves: number
  completionPercent: number
  status: string
  hintMessage: string | null
  difficultyBand: DifficultyBand | null
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

const showLegend = ref(false)
const showHints = ref(false)

function closeOverlays() {
  showLegend.value = false
  showHints.value = false
}
</script>

<template>
  <aside class="sidebar">
    <section class="hero-card">
      <div class="hero-top">
        <div>
          <p class="eyebrow">Daily Test Build</p>
          <h1>Road {{ gameNo ?? '...' }}</h1>
        </div>
        <div class="hero-tools">
          <button class="secondary ghost" type="button" @click="showLegend = true">Legend</button>
          <button class="secondary ghost" type="button" @click="showHints = true">Hints</button>
        </div>
      </div>

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

    <section class="status-card">
      <div class="status-header">
        <div>
          <p class="eyebrow">Run Status</p>
          <h2>{{ ended ? 'Route Complete' : 'Route Active' }}</h2>
        </div>
        <span class="mini-status" :class="{ ended }">{{ difficultyBand ?? '—' }}</span>
      </div>

      <p class="status-copy">{{ status }}</p>
      <p class="hint-inline" :class="{ empty: !hintMessage }">
        {{ hintMessage ?? 'Use hints only when you need help. They stay tucked away until you ask for them.' }}
      </p>

      <div class="quick-actions">
        <button class="secondary ghost" type="button" @click="showHints = true">Open Hints</button>
        <button class="secondary ghost" type="button" @click="showLegend = true">Open Legend</button>
      </div>
    </section>

    <div v-if="showHints || showLegend" class="overlay-backdrop" @click.self="closeOverlays">
      <section v-if="showHints" class="overlay-card" aria-label="Hints overlay">
        <div class="overlay-header">
          <div>
            <p class="eyebrow">Help</p>
            <h2>Hints</h2>
          </div>
          <button class="close-button" type="button" @click="showHints = false">Close</button>
        </div>

        <div class="hint-buttons">
          <button class="secondary" :disabled="ended || loading" @click="emit('hint', 1)">
            <span>Hint 1</span>
            <small>Highlights the next best move · Used {{ hintUsage.level1 }}</small>
          </button>
          <button class="secondary" :disabled="ended || loading" @click="emit('hint', 2)">
            <span>Hint 2</span>
            <small>Shows the next few best tiles · Used {{ hintUsage.level2 }}</small>
          </button>
          <button class="secondary" :disabled="ended || loading" @click="emit('hint', 3)">
            <span>Hint 3</span>
            <small>Reveals the exact next best tile · Used {{ hintUsage.level3 }}</small>
          </button>
        </div>

        <p class="hint-message" :class="{ empty: !hintMessage }">
          {{ hintMessage ?? 'Hints appear here after you request one.' }}
        </p>
      </section>

      <section v-if="showLegend" class="overlay-card" aria-label="Legend overlay">
        <div class="overlay-header">
          <div>
            <p class="eyebrow">Help</p>
            <h2>Legend</h2>
          </div>
          <button class="close-button" type="button" @click="showLegend = false">Close</button>
        </div>

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
        <div class="legend-row">
          <span class="legend-dot dot-start" />
          <span>Start</span>
        </div>
        <div class="legend-row">
          <span class="legend-dot dot-end" />
          <span>End</span>
        </div>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: grid;
  gap: 1rem;
}

.hero-card,
.status-card {
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

.status-card {
  background: linear-gradient(180deg, #1e1407 0%, #150e04 100%);
  border: 1px solid rgb(218 165 32 / 18%);
}

.eyebrow {
  margin: 0;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgb(218 165 32 / 65%);
}

.hero-card h1,
.status-card h2,
.overlay-card h2 {
  margin: 0.25rem 0 0;
  color: goldenrod;
}

.hero-card h1 {
  font-size: 1.72rem;
  letter-spacing: 0.01em;
}

.hero-copy {
  margin: 0.65rem 0 0;
  color: rgb(218 165 32 / 60%);
  line-height: 1.45;
}

.hero-top {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.hero-tools,
.quick-actions {
  display: flex;
  gap: 0.55rem;
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

.metrics-grid strong {
  color: goldenrod;
  font-size: 1.14rem;
  letter-spacing: 0.01em;
}

.status-header,
.overlay-header {
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
  font-size: 0.8rem;
  font-weight: 700;
}

.mini-status.ended {
  background: rgb(180 80 0 / 20%);
  color: #f59e0b;
  border-color: rgb(180 80 0 / 40%);
}

.status-copy,
.hint-inline,
.hint-message {
  margin: 0.85rem 0 0;
  line-height: 1.42;
}

.status-copy {
  color: rgb(218 165 32 / 52%);
}

.hint-inline,
.hint-message {
  min-height: 2.8rem;
  color: #d4a044;
}

.hint-inline.empty,
.hint-message.empty {
  color: rgb(218 165 32 / 40%);
}

.overlay-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(0 0 0 / 56%);
  backdrop-filter: blur(4px);
}

.overlay-card {
  width: min(100%, 440px);
  border-radius: 24px;
  padding: 1rem;
  background:
    radial-gradient(ellipse 110% 80% at 10% 0%, rgb(218 165 32 / 10%) 0%, transparent 58%),
    linear-gradient(180deg, #1e1407 0%, #150e04 100%);
  border: 1px solid rgb(218 165 32 / 22%);
  box-shadow: 0 24px 48px rgb(0 0 0 / 42%);
}

.hint-buttons {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.9rem;
}

.hint-buttons button {
  display: grid;
  gap: 0.2rem;
  text-align: left;
}

.hint-buttons small {
  font-size: 0.75rem;
  opacity: 0.72;
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
  background: #4ade80;
}

.chip-done {
  background: goldenrod;
  box-shadow: 0 0 8px rgb(218 165 32 / 36%);
}

.legend-line {
  width: 2.2rem;
  height: 0.45rem;
  border-radius: 999px;
  display: inline-block;
}

.legend-line.blocked {
  background: #fc2f00;
}

.legend-line.cost {
  background: #f59e0b;
}

.legend-line.bonus {
  background: #22c55e;
}

.legend-dot {
  width: 1rem;
  height: 1rem;
  border-radius: 999px;
  display: inline-block;
}

.dot-start {
  background: #065f46;
  border: 1px solid #a7f3d0;
}

.dot-end {
  background: #7f1d1d;
  border: 1px solid #fca5a5;
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

.ghost {
  background: rgb(218 165 32 / 8%);
}

.close-button {
  border: 1px solid rgb(218 165 32 / 24%);
  border-radius: 14px;
  padding: 0.55rem 0.8rem;
  background: rgb(218 165 32 / 10%);
  color: goldenrod;
  font-weight: 700;
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

  .hero-top,
  .quick-actions {
    display: grid;
  }
}
</style>
