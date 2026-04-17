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
}>()

const emit = defineEmits<{
  selectMode: [mode: PuzzleType]
}>()

const metrics = computed(() => {
  const items: Array<{ label: string; value: string }> = [
    { label: UI_COPY.boardHeader.metrics.score, value: `${props.score}/${props.maxScore}` },
    { label: UI_COPY.boardHeader.metrics.boardCoins, value: `${props.totalCoins}` },
  ]

  if (props.solved && props.medal) {
    items.push({ label: UI_COPY.boardHeader.metrics.medal, value: UI_COPY.boardHeader.medals[props.medal] })
  }

  return items
})
</script>

<template>
  <section class="board-header-card">
    <div class="header-row header-row--top">
      <div class="mode-switch" role="tablist" aria-label="Puzzle mode">
        <button
          type="button"
          class="mode-chip"
          :class="{ 'mode-chip--active': selectedMode === 'classic' }"
          @click="emit('selectMode', 'classic')"
        >
          {{ UI_COPY.boardHeader.classic }}
          <span v-if="classicSolved" class="chip-badge">
            {{ UI_COPY.boardHeader.solvedBadge }}
          </span>
        </button>

        <button
          v-if="hasExpedition"
          type="button"
          class="mode-chip"
          :class="{ 'mode-chip--active': selectedMode === 'expedition' }"
          :disabled="!isExpeditionUnlocked"
          @click="emit('selectMode', 'expedition')"
        >
          {{ UI_COPY.boardHeader.expedition }}
          <span v-if="!isExpeditionUnlocked" class="chip-badge chip-badge--locked">
            {{ UI_COPY.boardHeader.lockedBadge }}
          </span>
        </button>
      </div>

      <div class="metric-row">
        <article v-for="metric in metrics" :key="metric.label" class="metric-chip">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </article>
      </div>
    </div>

    <p v-if="hasExpedition && !isExpeditionUnlocked" class="unlock-hint">
      {{ UI_COPY.boardHeader.unlockHint }}
    </p>
  </section>
</template>

<style scoped>
.board-header-card {
  display: grid;
  gap: 0.55rem;
  padding: 0.9rem 1rem;
  border-radius: var(--radius-xl);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.32);
  box-shadow: var(--shadow-border-dark), var(--shadow-lg);
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.mode-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.mode-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.28);
  border-radius: var(--radius-full);
  padding: 0.45rem 0.8rem;
  background: rgb(var(--color-gold-rgb) / 0.08);
  color: rgb(var(--color-gold-rgb) / 0.82);
  font-weight: 700;
}

.mode-chip--active {
  background: rgb(var(--color-gold-rgb) / 0.18);
  color: var(--color-gold);
  border-color: rgb(var(--color-gold-rgb) / 0.45);
}

.mode-chip:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.chip-badge {
  padding: 0.16rem 0.42rem;
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.15);
  color: var(--color-gold);
  font-size: 0.72rem;
}

.chip-badge--locked {
  color: var(--color-toll);
}

.unlock-hint,
.metric-chip span {
  margin: 0;
}

.unlock-hint {
  color: rgb(var(--color-gold-rgb) / 0.76);
  font-size: 0.88rem;
}

.metric-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  justify-content: end;
}

.metric-chip {
  min-width: 88px;
  padding: 0.5rem 0.65rem;
  border-radius: var(--radius-md);
  background: rgb(var(--color-gold-rgb) / 0.08);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
}

.metric-chip span {
  display: block;
  color: rgb(var(--color-gold-rgb) / 0.72);
  font-size: 0.78rem;
}

.metric-chip strong {
  display: block;
  margin-top: 0.18rem;
  color: var(--color-gold);
}

@media (max-width: 760px) {
  .header-row {
    display: grid;
  }

  .metric-row {
    justify-content: start;
  }
}
</style>