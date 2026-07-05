<script lang="ts">
export type HistogramBar = {
  key: string;
  /** Short axis label, e.g. "1", "2", "3", "4+", "DNF". */
  label: string;
  /** Longer descriptor for the tooltip / a11y, e.g. "First try". */
  caption: string;
  count: number;
  isPlayer?: boolean;
};
</script>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  bars: HistogramBar[];
  /** You-are-here marker text on the player's bar. */
  playerTag?: string;
}>();

const maxCount = computed(() =>
  props.bars.reduce((max, bar) => Math.max(max, bar.count), 0),
);

const total = computed(() =>
  props.bars.reduce((sum, bar) => sum + bar.count, 0),
);

function barHeight(count: number): string {
  if (maxCount.value <= 0 || count <= 0) return '0%';
  // Floor non-zero bars so a lonely run still reads as a mark.
  return `${Math.max(9, Math.round((count / maxCount.value) * 100))}%`;
}

function sharePercent(count: number): number {
  if (total.value <= 0) return 0;
  return Math.round((count / total.value) * 100);
}

function barAriaLabel(bar: HistogramBar): string {
  const share = sharePercent(bar.count);
  const you = bar.isPlayer ? ' — your run' : '';
  return `${bar.caption}: ${bar.count} run${bar.count === 1 ? '' : 's'}, ${share}%${you}`;
}
</script>

<template>
  <div
    class="histogram"
    role="img"
    aria-label="Distribution of how many tries roadgoers took"
  >
    <div class="histogram-track">
      <div
        v-for="bar in bars"
        :key="bar.key"
        class="histogram-col"
        :class="{ 'histogram-col--player': bar.isPlayer }"
        :aria-label="barAriaLabel(bar)"
      >
        <span v-if="bar.isPlayer && playerTag" class="histogram-you">
          {{ playerTag }}
        </span>
        <span class="histogram-count">{{ bar.count }}</span>
        <div class="histogram-bar-wrap">
          <div
            class="histogram-bar"
            :style="{ height: barHeight(bar.count) }"
          />
        </div>
        <span class="histogram-label">{{ bar.label }}</span>
        <span class="histogram-caption">{{ bar.caption }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.histogram {
  --hist-accent-rgb: var(--color-gold-rgb);
  width: 100%;
}

.histogram-track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  align-items: end;
  gap: clamp(0.4rem, 2vw, 0.9rem);
}

.histogram-col {
  display: grid;
  grid-template-rows: auto auto 1fr auto auto;
  justify-items: center;
  gap: 0.3rem;
  min-width: 0;
}

.histogram-you {
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-full);
  background: rgb(var(--hist-accent-rgb) / 0.9);
  color: var(--color-text-on-gold);
  font-size: 0.64rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.histogram-col:not(.histogram-col--player) .histogram-you {
  visibility: hidden;
}

.histogram-count {
  font-size: 0.82rem;
  font-weight: 800;
  color: rgb(var(--color-gold-rgb) / 0.72);
  font-variant-numeric: tabular-nums;
}

.histogram-col--player .histogram-count {
  color: var(--color-gold-bright);
}

.histogram-bar-wrap {
  display: flex;
  align-items: end;
  width: 100%;
  max-width: 3.4rem;
  height: clamp(84px, 22vw, 132px);
  padding: 0 0.1rem;
}

.histogram-bar {
  width: 100%;
  min-height: 3px;
  border-radius: var(--radius-sm) var(--radius-sm) 4px 4px;
  background: linear-gradient(
    180deg,
    rgb(var(--color-gold-rgb) / 0.34) 0%,
    rgb(var(--color-gold-rgb) / 0.16) 100%
  );
  border: 1px solid rgb(var(--color-gold-rgb) / 0.22);
  border-bottom: 0;
  transition: height var(--transition-slow);
}

.histogram-col--player .histogram-bar {
  background: linear-gradient(
    180deg,
    rgb(var(--hist-accent-rgb) / 0.95) 0%,
    rgb(var(--hist-accent-rgb) / 0.5) 100%
  );
  border-color: rgb(var(--hist-accent-rgb) / 0.7);
  box-shadow: 0 0 16px rgb(var(--hist-accent-rgb) / 0.4);
}

.histogram-label {
  font-size: 0.9rem;
  font-weight: 800;
  color: rgb(var(--color-gold-rgb) / 0.82);
}

.histogram-col--player .histogram-label {
  color: var(--color-gold-bright);
}

.histogram-caption {
  font-size: 0.66rem;
  line-height: 1.15;
  text-align: center;
  color: rgb(var(--color-gold-rgb) / 0.52);
}

@media (prefers-reduced-motion: reduce) {
  .histogram-bar {
    transition: none;
  }
}

@media (max-width: 520px) {
  .histogram-caption {
    display: none;
  }
}
</style>
