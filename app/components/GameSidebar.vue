<script setup lang="ts">
import { ref } from 'vue';
import { UI_COPY } from '../content/uiCopy';

defineProps<{
  roadHeading: string;
  modeLabel: string;
  score: number;
  maxScore: number;
  totalCoins: number;
  moves: number;
  completionPercent: number;
  progressText: string;
  status: string;
  hintDisplayMessage: string;
  hasHintMessage: boolean;
  runStateHeading: string;
  difficultyLabel: string;
  hintUsage: {
    level1: number;
    level2: number;
    level3: number;
  };
  ended: boolean;
  loading: boolean;
}>();

const emit = defineEmits<{
  current: [];
  hint: [level: 1 | 2 | 3];
}>();

const showLegend = ref(false);
const showHints = ref(false);

function closeOverlays() {
  showLegend.value = false;
  showHints.value = false;
}
</script>

<template>
  <aside class="sidebar">
    <section class="hero-card">
      <div class="hero-top">
        <div>
          <p class="eyebrow">
            {{ UI_COPY.sidebar.eyebrow }}
            <span class="mode-badge">{{ modeLabel }}</span>
          </p>
          <h1>{{ roadHeading }}</h1>
        </div>
        <div class="hero-tools">
          <button
            class="secondary ghost"
            type="button"
            @click="showLegend = true"
          >
            {{ UI_COPY.sidebar.legend }}
          </button>
          <button
            class="secondary ghost"
            type="button"
            @click="showHints = true"
          >
            {{ UI_COPY.sidebar.hints }}
          </button>
        </div>
      </div>

      <p class="hero-copy">{{ UI_COPY.sidebar.heroCopy }}</p>

      <div class="hero-actions">
        <button class="secondary" :disabled="loading" @click="emit('current')">
          {{ UI_COPY.sidebar.reloadToday }}
        </button>
      </div>
    </section>

    <section class="metrics-grid">
      <article>
        <span class="metric-label">{{ UI_COPY.sidebar.metrics.score }}</span>
        <strong>{{ score }} / {{ maxScore }}</strong>
      </article>
      <article>
        <span class="metric-label">{{
          UI_COPY.sidebar.metrics.boardCoins
        }}</span>
        <strong>{{ totalCoins }}</strong>
      </article>
      <article>
        <span class="metric-label">{{ UI_COPY.sidebar.metrics.moves }}</span>
        <strong>{{ moves }}</strong>
      </article>
      <article>
        <span class="metric-label">{{ UI_COPY.sidebar.metrics.progress }}</span>
        <strong>{{ progressText }}</strong>
      </article>
    </section>

    <section class="status-card">
      <div class="status-header">
        <div>
          <p class="eyebrow">{{ UI_COPY.sidebar.runStatusEyebrow }}</p>
          <h2>{{ runStateHeading }}</h2>
        </div>
        <span class="mini-status" :class="{ ended }">{{
          difficultyLabel
        }}</span>
      </div>

      <p class="status-copy">{{ status }}</p>
      <p class="hint-inline" :class="{ empty: !hasHintMessage }">
        {{ hintDisplayMessage }}
      </p>

      <div class="quick-actions">
        <button class="secondary ghost" type="button" @click="showHints = true">
          {{ UI_COPY.sidebar.openHints }}
        </button>
        <button
          class="secondary ghost"
          type="button"
          @click="showLegend = true"
        >
          {{ UI_COPY.sidebar.openLegend }}
        </button>
      </div>
    </section>

    <div
      v-if="showHints || showLegend"
      class="overlay-backdrop"
      @click.self="closeOverlays"
    >
      <section v-if="showHints" class="overlay-card" aria-label="Hints overlay">
        <div class="overlay-header">
          <div>
            <p class="eyebrow">{{ UI_COPY.sidebar.overlayHelpEyebrow }}</p>
            <h2>{{ UI_COPY.sidebar.hintsTitle }}</h2>
          </div>
          <button class="close-button" type="button" @click="showHints = false">
            {{ UI_COPY.sidebar.close }}
          </button>
        </div>

        <div class="hint-buttons">
          <button
            class="secondary"
            :disabled="ended || loading"
            @click="emit('hint', 1)"
          >
            <span>{{ UI_COPY.sidebar.hintRows.level1Title }}</span>
            <small
              >{{ UI_COPY.sidebar.hintRows.level1Desc }} · Used
              {{ hintUsage.level1 }}</small
            >
          </button>
          <button
            class="secondary"
            :disabled="ended || loading"
            @click="emit('hint', 2)"
          >
            <span>{{ UI_COPY.sidebar.hintRows.level2Title }}</span>
            <small
              >{{ UI_COPY.sidebar.hintRows.level2Desc }} · Used
              {{ hintUsage.level2 }}</small
            >
          </button>
          <button
            class="secondary"
            :disabled="ended || loading"
            @click="emit('hint', 3)"
          >
            <span>{{ UI_COPY.sidebar.hintRows.level3Title }}</span>
            <small
              >{{ UI_COPY.sidebar.hintRows.level3Desc }} · Used
              {{ hintUsage.level3 }}</small
            >
          </button>
        </div>

        <p class="hint-message" :class="{ empty: !hasHintMessage }">
          {{
            hasHintMessage ? hintDisplayMessage : UI_COPY.sidebar.hintFallback
          }}
        </p>
      </section>

      <section
        v-if="showLegend"
        class="overlay-card"
        aria-label="Legend overlay"
      >
        <div class="overlay-header">
          <div>
            <p class="eyebrow">{{ UI_COPY.sidebar.overlayHelpEyebrow }}</p>
            <h2>{{ UI_COPY.sidebar.legendTitle }}</h2>
          </div>
          <button
            class="close-button"
            type="button"
            @click="showLegend = false"
          >
            {{ UI_COPY.sidebar.close }}
          </button>
        </div>

        <div class="legend-row">
          <span class="legend-chip chip-active" />
          <span>{{ UI_COPY.sidebar.legendRows.legalMove }}</span>
        </div>
        <div class="legend-row">
          <span class="legend-chip chip-done" />
          <span>{{ UI_COPY.sidebar.legendRows.visitedTile }}</span>
        </div>
        <div class="legend-row">
          <span class="legend-line blocked" />
          <span>{{ UI_COPY.sidebar.legendRows.blockedRoad }}</span>
        </div>
        <div class="legend-row">
          <span class="legend-line toll" />
          <span>{{ UI_COPY.sidebar.legendRows.tollRoad }}</span>
        </div>
        <div class="legend-row">
          <span class="legend-line bonus" />
          <span>{{ UI_COPY.sidebar.legendRows.bonusRoad }}</span>
        </div>
        <div class="legend-row">
          <span class="legend-dot dot-start" />
          <span>{{ UI_COPY.sidebar.legendRows.start }}</span>
        </div>
        <div class="legend-row">
          <span class="legend-dot dot-end" />
          <span>{{ UI_COPY.sidebar.legendRows.end }}</span>
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
  border-radius: var(--radius-lg);
  padding: 1rem;
  box-shadow:
    var(--shadow-border-dark), var(--shadow-lg), var(--shadow-inset-gold);
}

.hero-card {
  background: var(--gradient-card-hero);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.45);
  color: var(--color-gold-light);
}

.status-card {
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.35);
}

.hero-card h1,
.status-card h2,
.overlay-card h2 {
  margin: 0.25rem 0 0;
  color: var(--color-gold);
}

.hero-card h1 {
  font-size: var(--font-size-3xl);
  letter-spacing: var(--letter-spacing-tight);
}

.mode-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.2);
  color: var(--color-gold);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.35);
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hero-copy {
  margin: 0.65rem 0 0;
  color: rgb(var(--color-gold-rgb) / 0.85);
  line-height: var(--line-height-base);
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
  background: var(--gradient-card-metric);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.35);
}

.metric-label {
  display: block;
  margin-bottom: 0.3rem;
  color: rgb(var(--color-gold-rgb) / 0.88);
  font-size: var(--font-size-base);
}

.metrics-grid strong {
  color: var(--color-gold);
  font-size: 1.14rem;
  letter-spacing: var(--letter-spacing-tight);
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
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.15);
  color: var(--color-gold);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.4);
  font-size: 0.8rem;
  font-weight: 700;
}

.mini-status.ended {
  background: rgb(180 80 0 / 0.2);
  color: var(--color-toll);
  border-color: rgb(180 80 0 / 0.4);
}

.status-copy,
.hint-inline,
.hint-message {
  margin: 0.85rem 0 0;
  line-height: var(--line-height-snug);
}

.status-copy {
  color: rgb(var(--color-gold-rgb) / 0.85);
}

.hint-inline,
.hint-message {
  min-height: 2.8rem;
  color: var(--color-gold-muted);
}

.hint-inline.empty,
.hint-message.empty {
  color: rgb(var(--color-gold-rgb) / 0.7);
}

.overlay-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(0 0 0 / 0.56);
  backdrop-filter: blur(4px);
}

.overlay-card {
  width: min(100%, 440px);
  border-radius: var(--radius-lg);
  padding: 1rem;
  background: var(--gradient-card-overlay);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.38);
  box-shadow: var(--shadow-xl);
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
  font-size: var(--font-size-sm);
  opacity: 0.72;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: 0.7rem;
  color: rgb(var(--color-gold-rgb) / 0.88);
}

.legend-chip {
  width: 1.15rem;
  height: 1.15rem;
  border-radius: var(--radius-full);
  display: inline-block;
}

.chip-active {
  background: var(--color-active);
}

.chip-done {
  background: var(--color-gold);
  box-shadow: var(--shadow-glow-gold-soft);
}

.legend-line {
  width: 2.2rem;
  height: 0.45rem;
  border-radius: var(--radius-full);
  display: inline-block;
}

.legend-line.blocked {
  background: var(--color-blocked);
}

.legend-line.toll {
  background: var(--color-toll);
}

.legend-line.bonus {
  background: var(--color-bonus);
}

.legend-dot {
  width: 1rem;
  height: 1rem;
  border-radius: var(--radius-full);
  display: inline-block;
}

.dot-start {
  background: var(--color-start-dark);
  border: 1px solid var(--color-start-light);
}

.dot-end {
  background: var(--color-end-dark);
  border: 1px solid var(--color-end-light);
}

button {
  border: 0;
  border-radius: var(--radius-sm);
  padding: 0.7rem 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.secondary {
  color: var(--color-gold);
  background: rgb(var(--color-gold-rgb) / 0.15);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.38);
}

.ghost {
  background: rgb(var(--color-gold-rgb) / 0.1);
}

.close-button {
  border: 1px solid rgb(var(--color-gold-rgb) / 0.35);
  border-radius: var(--radius-sm);
  padding: 0.55rem 0.8rem;
  background: rgb(var(--color-gold-rgb) / 0.14);
  color: var(--color-gold);
  font-weight: 700;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 980px) {
  .hero-card h1 {
    font-size: var(--font-size-2xl);
  }

  .hero-top,
  .quick-actions {
    display: grid;
  }
}
</style>
