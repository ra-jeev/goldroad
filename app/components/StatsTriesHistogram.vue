<script setup lang="ts">
import { computed } from 'vue';

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
    upperBound: 25,
  },
);

type Bar = {
  key: string;
  value: number;
  highlight: boolean;
  marker: string | null;
};

/**
 * v1's histogram contract: one thin bar per attempt count up to the pooled
 * `${upperBound}+` bucket, heights relative to the busiest bucket, empty
 * buckets kept as hairlines so the field reads as a field. Absolute counts
 * are deliberately never rendered.
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
    return {
      key,
      value: count > 0 ? Math.max(6, Math.round((count / maxCount) * 100)) : 1,
      highlight,
      marker:
        highlight || index === 0 || key === overflowKey ? key : null,
    };
  });
});

const ariaLabel = computed(() =>
  props.playerAttempts === null
    ? 'How many attempts the field needed, from 1 to 25 and beyond.'
    : `How many attempts the field needed, from 1 to 25 and beyond. Your solve is marked at ${props.playerAttempts >= props.upperBound ? `${props.upperBound}+` : props.playerAttempts}.`,
);
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
        <span v-if="bar.marker" class="axis-marker">{{ bar.marker }}</span>
      </div>
    </div>
    <div class="graph-label" aria-hidden="true">attempts →</div>
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
  height: 8rem;
  margin-top: 0.5rem;
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

/* A thin arrow, not the 👇 emoji — reads as a UI marker, not a sticker. */
.graph-entry--you::after {
  content: '';
  position: absolute;
  top: -11px;
  left: 50%;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border-right: 1.5px solid var(--color-gold-bright);
  border-bottom: 1.5px solid var(--color-gold-bright);
  transform: rotate(45deg);
}

.axis-marker {
  position: absolute;
  bottom: -1.15rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.64rem;
  font-weight: 700;
  color: rgb(var(--color-gold-rgb) / 0.6);
  white-space: nowrap;
}

.graph-entry--you .axis-marker {
  color: var(--color-gold-bright);
}

.graph-label {
  margin-top: 1.4rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: rgb(var(--color-gold-rgb) / 0.6);
}

@media (prefers-reduced-motion: reduce) {
  .graph-entry {
    transition: none;
  }
}
</style>
