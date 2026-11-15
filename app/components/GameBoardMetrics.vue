<script setup lang="ts">
import { computed } from 'vue';
import { UI_COPY } from '../content/uiCopy';

const props = defineProps<{
  score: number;
  maxScore: number;
  totalCoins: number;
  pulse?: { type: 'toll' | 'bonus'; key: number } | null;
  overTarget?: boolean;
}>();

// A fresh :key each pulse replays the score-pulse animation. Color follows
// the traversed edge's hue. The pulse marks a score change the player did not
// ask for directly — an edge cost collected by crossing it. A take-back is
// deliberate, so it stays quiet. Disabled under reduced motion via global CSS.
const pulseKey = computed(() => props.pulse?.key ?? 0);
const pulseStyle = computed(() => {
  if (!props.pulse) return undefined;
  return props.pulse.type === 'toll'
    ? {
        '--pulse-color': 'var(--color-toll-bright)',
        '--pulse-rgb': 'var(--color-toll-rgb)',
      }
    : {
        '--pulse-color': 'var(--color-bonus-bright)',
        '--pulse-rgb': 'var(--color-bonus-rgb)',
      };
});
</script>

<template>
  <div
    :key="pulseKey"
    class="metric-line"
    :class="{ 'metric-line--pulse': pulse }"
    :style="pulseStyle"
  >
    <span class="score-target">
      <span class="metric-label">{{ UI_COPY.boardHeader.metrics.score }}</span>
      <strong :class="{ 'metric-value--over': overTarget }">{{ score }}</strong>
      <span v-if="overTarget" class="sr-only">Past target.</span>
      <span class="target-divider" aria-hidden="true">/</span>
      <span class="sr-only">{{ UI_COPY.boardHeader.metrics.target }}</span>
      <strong class="target-value">{{ maxScore }}</strong>
    </span>
    <span class="metric-total">
      <span class="metric-separator" aria-hidden="true">•</span>
      <span>
        <span
          class="metric-label"
          :title="UI_COPY.boardHeader.metrics.boardTotalDescription"
        >{{ UI_COPY.boardHeader.metrics.boardTotal }}</span>
        <strong>{{ totalCoins }}</strong>
      </span>
    </span>
  </div>
</template>

<style scoped>
.metric-line {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: baseline;
  column-gap: var(--board-dot-gap);
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.76);
  font-size: 1.125rem;
  font-weight: 700;
  /* Score climbs from one digit to three as the road is walked; without this
     the whole line re-flows on every move. */
  font-variant-numeric: tabular-nums;
}

.metric-label {
  margin-right: 0.4rem;
  color: rgb(var(--color-gold-rgb) / 0.72);
}

.score-target {
  display: inline-flex;
  align-items: baseline;
}

/* Keep the slash close to the target. */
.target-divider {
  margin: 0 0.28rem;
  color: rgb(var(--color-gold-rgb) / 0.72);
}

.metric-line strong {
  color: var(--color-gold);
  display: inline-block;
  font-size: 1.25rem;
  transition: color 220ms ease;
}

/* A Classic run at or past the target can never land on it, so the number
   itself says so. Words would have to live in the footer, which stays
   deliberately quiet mid-run — which is exactly why the old warning string
   was never rendered. */
.metric-line strong.metric-value--over {
  color: var(--color-toll-bright);
}

.metric-line--pulse strong {
  animation: score-pulse 700ms ease;
}

.metric-separator {
  color: rgb(var(--color-gold-rgb) / 0.6);
}

.metric-total {
  display: inline-flex;
  align-items: baseline;
  gap: var(--board-dot-gap);
}

@media (max-width: 760px) {
  .metric-line {
    font-size: 1.25rem;
  }

  .metric-line strong {
    font-size: 1.5rem;
  }
}
</style>
