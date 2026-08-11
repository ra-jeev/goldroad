<script setup lang="ts">
import { computed } from 'vue';
// Nuxt's own alias for the shared/ directory, not a deep relative path: from
// 4.5 the Nitro bundle cannot resolve a value imported out of shared/ by
// relative path from a page chunk, and the production build fails.
import { SOLVED_ATTEMPTS_UPPER_BOUND } from '#shared/types/histogram';

const props = withDefaults(
  defineProps<{
    /** Solved-attempts distribution keyed by "1".."24" and "25+". */
    distribution: Record<string, number>;
    /** The player's own solved attempt count, if they solved this road. */
    playerAttempts?: number | null;
    upperBound?: number;
  }>(),
  {
    playerAttempts: null,
    upperBound: SOLVED_ATTEMPTS_UPPER_BOUND,
  },
);

type Bar = {
  key: string;
  value: number;
  highlight: boolean;
  /** Scale anchor sat on the axis: only the first and the pooled bar. */
  axisMarker: string | null;
  /** The player's own count, floated above their bar's arrow. */
  youMarker: string | null;
};

/**
 * v1's histogram contract: one thin bar per attempt count up to the pooled
 * `${upperBound}+` bucket, heights relative to the busiest bucket, empty
 * buckets kept as hairlines so the field reads as a field. Absolute counts
 * are deliberately never rendered.
 *
 * The player's count rides above their bar rather than sitting on the axis.
 * Bars are only ~7-12px apart, so an axis label anywhere past ~22 collided
 * with the pooled `${upperBound}+` anchor (v1 had this bug too). Floating it
 * with the arrow makes a collision impossible at any attempt count, and reads
 * as part of the "you are here" marker rather than as another axis tick.
 */
const bars = computed<Bar[]>(() => {
  const overflowKey = `${props.upperBound}+`;
  const playerKey =
    props.playerAttempts === null
      ? null
      : props.playerAttempts >= props.upperBound
        ? overflowKey
        : String(props.playerAttempts);

  const keys = [
    ...Array.from({ length: props.upperBound - 1 }, (_, i) => String(i + 1)),
    overflowKey,
  ];

  const maxCount = Math.max(...keys.map((key) => props.distribution[key] ?? 0), 1);

  return keys.map((key, index) => {
    const count = props.distribution[key] ?? 0;
    const highlight = key === playerKey;
    const isAnchor = index === 0 || key === overflowKey;
    return {
      key,
      value: count > 0 ? Math.max(6, Math.round((count / maxCount) * 100)) : 1,
      highlight,
      axisMarker: isAnchor ? key : null,
      // On an anchor bar the axis already shows the count; a second copy
      // overhead would just repeat it.
      youMarker: highlight && !isAnchor ? key : null,
    };
  });
});

const ariaLabel = computed(() => {
  const scale = `How many tries the field needed, from 1 to ${props.upperBound} and beyond.`;
  if (props.playerAttempts === null) return scale;

  const marked =
    props.playerAttempts >= props.upperBound
      ? `${props.upperBound}+`
      : props.playerAttempts;
  return `${scale} Your solve is marked at ${marked}.`;
});
</script>

<template>
  <div class="graph" role="img" :aria-label="ariaLabel">
    <div class="graph-plot">
      <div
        v-for="bar in bars"
        :key="bar.key"
        class="graph-entry"
        :class="{ 'graph-entry--you': bar.highlight }"
        :style="{ height: `${bar.value}%` }"
      >
        <span v-if="bar.youMarker" class="you-marker">{{ bar.youMarker }}</span>
        <span v-if="bar.axisMarker" class="axis-marker">
          {{ bar.axisMarker }}
        </span>
      </div>
    </div>
    <div class="graph-label" aria-hidden="true">tries →</div>
  </div>
</template>

<style scoped>
.graph {
  display: grid;
  justify-items: center;
  width: 100%;
}

.graph-plot {
  display: flex;
  align-items: flex-end;
  gap: clamp(3px, 1.2vw, 6px);
  /* Padding clears the "you" marker stack above a full-height bar: count,
     then arrow. Height carries that padding so the bars keep their old
     6.65rem of travel. */
  height: 9.15rem;
  margin-top: 0.5rem;
  padding-top: 2.5rem;
  padding-bottom: 0;
  border-bottom: 1px solid rgb(var(--color-gold-rgb) / 0.4);
}

.graph-entry {
  position: relative;
  width: clamp(4px, 1.4vw, 6px);
  border-radius: 2px 2px 0 0;
  background: rgb(var(--color-gold-rgb) / 0.35);
  transition: height var(--transition-slow);
}

.graph-entry--you {
  background: var(--color-gold-bright);
  box-shadow: 0 0 10px rgb(var(--color-gold-rgb) / 0.55);
}

/* Downward marker with a visible shaft and a 6px gap above the bar. */
.graph-entry--you::before,
.graph-entry--you::after {
  content: '';
  position: absolute;
  left: 50%;
  background: var(--color-gold-bright);
}

.graph-entry--you::before {
  bottom: calc(100% + 11px);
  width: 1.5px;
  height: 10px;
  transform: translateX(-50%);
}

.graph-entry--you::after {
  bottom: calc(100% + 6px);
  width: 8px;
  height: 8px;
  background: transparent;
  border-right: 1.5px solid var(--color-gold-bright);
  border-bottom: 1.5px solid var(--color-gold-bright);
  transform: translateX(-50%) rotate(45deg);
}

.axis-marker {
  position: absolute;
  bottom: -1.15rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--font-size-caption);
  font-weight: 700;
  color: rgb(var(--color-gold-rgb) / 0.6);
  white-space: nowrap;
}

.graph-entry--you .axis-marker {
  color: var(--color-gold-bright);
}

/* Sits above the arrow, so it can never meet an axis label. */
.you-marker {
  position: absolute;
  bottom: calc(100% + 23px);
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--font-size-caption);
  font-weight: 800;
  line-height: 1;
  color: var(--color-gold-bright);
  white-space: nowrap;
}

.graph-label {
  margin-top: 1.4rem;
  font-size: var(--font-size-caption);
  font-weight: 700;
  color: rgb(var(--color-gold-rgb) / 0.6);
}

@media (prefers-reduced-motion: reduce) {
  .graph-entry {
    transition: none;
  }
}
</style>
