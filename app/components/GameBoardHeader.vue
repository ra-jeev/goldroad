<script setup lang="ts">
import { computed } from 'vue'
import type { Medal, PuzzleType } from '../../shared/types/game'
import { UI_COPY } from '../content/uiCopy'

const props = defineProps<{
  selectedMode: PuzzleType | null
  hasExpedition: boolean
  isExpeditionUnlocked: boolean
  classicSolved: boolean
  score: number
  maxScore: number
  totalCoins: number
  medal: Medal | null
  solved: boolean
  pulse?: { type: 'toll' | 'bonus'; key: number } | null
}>()

const emit = defineEmits<{
  selectMode: [mode: PuzzleType]
}>()

const metrics = computed(() => {
  return [
    { label: UI_COPY.boardHeader.metrics.score, value: `${props.score}/${props.maxScore}` },
    { label: UI_COPY.boardHeader.metrics.boardCoins, value: `${props.totalCoins}` },
  ]
})

// A fresh :key each pulse replays the score-pulse animation. Color follows
// the traversed edge's hue. Disabled under reduced motion via global CSS.
const pulseKey = computed(() => props.pulse?.key ?? 0)
const pulseStyle = computed(() => {
  if (!props.pulse) return undefined
  return props.pulse.type === 'toll'
    ? { '--pulse-color': 'var(--color-toll-bright)', '--pulse-rgb': 'var(--color-toll-rgb)' }
    : { '--pulse-color': 'var(--color-bonus-bright)', '--pulse-rgb': 'var(--color-bonus-rgb)' }
})
</script>

<template>
  <section
    class="board-header-card"
    :aria-label="UI_COPY.boardHeader.ariaLabels.controls"
  >
    <div
      class="mode-switch"
      role="tablist"
      :aria-label="UI_COPY.boardHeader.ariaLabels.puzzleMode"
    >
      <button
        type="button"
        class="mode-option"
        :class="{ 'mode-option--active': selectedMode === 'classic' }"
        :aria-selected="selectedMode === 'classic'"
        role="tab"
        :title="
          classicSolved
            ? UI_COPY.boardHeader.solvedBadge
            : UI_COPY.boardHeader.classic
        "
        @click="emit('selectMode', 'classic')"
      >
        {{ UI_COPY.boardHeader.classic }}
      </button>

      <button
        v-if="hasExpedition"
        type="button"
        class="mode-option"
        :class="{ 'mode-option--active': selectedMode === 'expedition' }"
        :aria-selected="selectedMode === 'expedition'"
        :disabled="!isExpeditionUnlocked"
        role="tab"
        :title="
          isExpeditionUnlocked
            ? UI_COPY.boardHeader.expedition
            : UI_COPY.boardHeader.unlockHint
        "
        @click="emit('selectMode', 'expedition')"
      >
        {{ UI_COPY.boardHeader.expedition }}
      </button>
    </div>

    <p
      :key="pulseKey"
      class="metric-line"
      :class="{ 'metric-line--pulse': pulse }"
      :style="pulseStyle"
      :aria-label="UI_COPY.boardHeader.ariaLabels.roadScore"
    >
      <span v-for="(metric, index) in metrics" :key="metric.label">
        <span class="metric-label">{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <span v-if="index < metrics.length - 1" class="metric-separator">·</span>
      </span>
    </p>
  </section>
</template>

<style scoped>
.board-header-card {
  display: grid;
  justify-items: center;
  gap: 0.45rem;
  padding: 0.25rem 0;
  text-align: center;
}

.mode-switch {
  display: inline-grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(5.4rem, max-content);
  width: fit-content;
  padding: 0.16rem;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.22);
  border-radius: var(--radius-full);
  background: rgb(0 0 0 / 0.28);
}

.mode-option {
  min-height: 1.85rem;
  border: 0;
  border-radius: var(--radius-full);
  padding: 0.28rem 0.72rem;
  background: transparent;
  color: rgb(var(--color-gold-rgb) / 0.62);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.mode-option--active {
  background: rgb(var(--color-gold-rgb) / 0.18);
  color: var(--color-gold);
  box-shadow: inset 0 0 0 1px rgb(var(--color-gold-rgb) / 0.26);
}

.mode-option:disabled {
  color: rgb(var(--color-gold-rgb) / 0.34);
  cursor: not-allowed;
}

.metric-line {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.76);
  font-size: 0.9rem;
  font-weight: 700;
}

.metric-label {
  margin-right: 0.25rem;
  color: rgb(var(--color-gold-rgb) / 0.58);
}

.metric-line strong {
  color: var(--color-gold);
  display: inline-block;
}

.metric-line--pulse strong {
  animation: score-pulse 700ms ease;
}

.metric-separator {
  margin: 0 0.55rem;
  color: rgb(var(--color-gold-rgb) / 0.36);
}

@media (max-width: 760px) {
  .board-header-card {
    padding: 0.1rem 0;
  }

  .metric-line {
    font-size: 0.84rem;
  }
}
</style>
