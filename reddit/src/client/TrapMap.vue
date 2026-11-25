<script setup lang="ts">
import { computed } from 'vue';
import type { Trap } from '../shared/api';

const props = defineProps<{
  trap: Trap;
  rows: number;
  cols: number;
  tiles: number[];
  start: number;
  end: number;
}>();

const point = (tile: number) => ({ x: (tile % props.cols) + 0.5, y: Math.floor(tile / props.cols) + 0.5 });

const goldLine = computed(() =>
  props.trap.goldRoute.map((tile) => `${point(tile).x},${point(tile).y}`).join(' '),
);

/** The trap step. Lines run under the tiles and show in the gaps. */
const wrongLine = computed(() => {
  const { from, wrongTo } = props.trap;
  if (from === null || wrongTo === null) return null;
  const a = point(from);
  const b = point(wrongTo);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
});

const showTrap = computed(() => props.trap.walkers >= 2 && props.trap.from !== null);

function direction(from: number, to: number): string {
  const rowStep = Math.floor(to / props.cols) - Math.floor(from / props.cols);
  if (rowStep < 0) return 'up';
  if (rowStep > 0) return 'down';
  return to < from ? 'left' : 'right';
}

const percent = (part: number) => Math.round((part / Math.max(1, props.trap.walkers)) * 100);

const caption = computed(() => {
  const { walkers, solvedFirst, trapped, from, wrongTo, goldTo } = props.trap;
  if (walkers < 2) return 'The trap shows once more walkers have played this road.';
  if (from === null || wrongTo === null) return 'Every walker so far found the gold road on the first try.';
  const where = from === props.start ? 'at the start' : `at the ${props.tiles[from]}`;
  const turn =
    goldTo === null
      ? `${percent(trapped)}% of first tries went ${direction(from, wrongTo)} ${where}.`
      : `${percent(trapped)}% of first tries went ${direction(from, wrongTo)} ${where}. The gold road goes ${direction(from, goldTo)}.`;
  return `${turn} ${percent(solvedFirst)}% found it on the first try.`;
});
</script>

<template>
  <figure class="trap">
    <figcaption class="title">The trap</figcaption>
    <div
      v-if="showTrap"
      class="map"
      :style="{ '--cols': cols, '--rows': rows }"
      role="img"
      :aria-label="caption"
    >
      <svg class="lines" :viewBox="`0 0 ${cols} ${rows}`" aria-hidden="true">
        <polyline class="gold" :points="goldLine" />
        <line
          v-if="wrongLine"
          class="wrong"
          :x1="wrongLine.x1"
          :y1="wrongLine.y1"
          :x2="wrongLine.x2"
          :y2="wrongLine.y2"
        />
      </svg>
      <div
        v-for="(value, tile) in tiles"
        :key="tile"
        class="cell"
        :class="{
          'cell--trap': tile === trap.from,
          'cell--wrong': tile === trap.wrongTo,
          'cell--gold': trap.goldRoute.includes(tile),
        }"
      >
        <span class="fill">{{ tile === start ? '👣' : tile === end ? '🚩' : value }}</span>
      </div>
    </div>
    <p class="caption">{{ caption }}</p>
  </figure>
</template>

<style scoped>
.trap {
  width: 100%;
  margin: 0;
  display: grid;
  gap: 6px;
  justify-items: center;
}

.title {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-gold-muted);
}

.map {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  width: min(100%, calc(var(--cols) * 32px));
  aspect-ratio: var(--cols) / var(--rows);
}

.cell {
  position: relative;
  z-index: 1;
  padding: 3px;
}

.fill {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  background:
    linear-gradient(rgb(var(--color-gold-rgb) / 0.08), rgb(var(--color-gold-rgb) / 0.08)),
    var(--color-bg-dark);
  color: var(--color-gold-muted);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
}

.cell--gold .fill {
  background:
    linear-gradient(rgb(var(--color-gold-rgb) / 0.28), rgb(var(--color-gold-rgb) / 0.28)),
    var(--color-bg-dark);
  color: var(--color-gold-bright);
}

.cell--trap .fill {
  box-shadow: 0 0 0 2px var(--color-toll-bright);
}

.cell--wrong .fill {
  outline: 2px dashed var(--color-toll-bright);
  outline-offset: -1px;
  color: var(--color-toll-bright);
}

.lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.gold {
  fill: none;
  stroke: var(--color-gold-bright);
  stroke-width: 0.14;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.wrong {
  stroke: var(--color-toll-bright);
  stroke-width: 0.14;
  stroke-linecap: round;
}

.caption {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-gold-bright);
}
</style>
