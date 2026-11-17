<script setup lang="ts">
import { computed } from 'vue';
import type { Heat } from '../shared/api';

const props = defineProps<{
  heat: Heat;
  rows: number;
  cols: number;
  start: number;
  end: number;
}>();

const busiest = computed(() => Math.max(1, ...props.heat.tiles));

/** Gold brightness grows with the share of walkers on the tile. */
const cells = computed(() =>
  props.heat.tiles.map((count, tile) => ({
    tile,
    count,
    alpha: count === 0 ? 0.05 : 0.14 + 0.76 * (count / busiest.value),
    mark: tile === props.start ? '👣' : tile === props.end ? '🚩' : '',
  })),
);

const goldLine = computed(() =>
  props.heat.goldRoute
    .map((tile) => `${(tile % props.cols) + 0.5},${Math.floor(tile / props.cols) + 0.5}`)
    .join(' '),
);

function direction(from: number, to: number): string {
  const rowStep = Math.floor(to / props.cols) - Math.floor(from / props.cols);
  if (rowStep < 0) return 'up';
  if (rowStep > 0) return 'down';
  return to < from ? 'left' : 'right';
}

/** One line about the first step: the place where walkers split. */
const caption = computed(() => {
  const { walkers, firstSteps, goldRoute } = props.heat;
  if (walkers <= 1) return 'You are the first walker on this road. The gold road is drawn on top.';
  const [topTile, topCount] = Object.entries(firstSteps)
    .map(([tile, count]) => [Number(tile), count] as const)
    .sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  const goldFirst = goldRoute[1];
  if (topTile === null || goldFirst === undefined) return `${walkers} walkers so far.`;
  const share = Math.round((topCount / walkers) * 100);
  const went = direction(props.start, topTile);
  if (topTile === goldFirst) return `${share}% of walkers went ${went} at the start, the gold way.`;
  return `${share}% of walkers went ${went} at the start. The gold road goes ${direction(props.start, goldFirst)}.`;
});
</script>

<template>
  <figure class="crowd">
    <figcaption class="title">Where the crowd walked</figcaption>
    <div
      class="map"
      :style="{ '--cols': cols, '--rows': rows }"
      role="img"
      :aria-label="`Crowd map from ${heat.walkers} first tries. ${caption}`"
    >
      <div v-for="cell in cells" :key="cell.tile" class="cell">
        <span class="fill" :style="{ '--alpha': cell.alpha }">{{ cell.mark }}</span>
      </div>
      <svg class="route" :viewBox="`0 0 ${cols} ${rows}`" aria-hidden="true">
        <polyline :points="goldLine" />
      </svg>
    </div>
    <p class="caption">{{ caption }}</p>
  </figure>
</template>

<style scoped>
.crowd {
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
  width: min(100%, calc(var(--cols) * 30px));
  aspect-ratio: var(--cols) / var(--rows);
}

.cell {
  padding: 2px;
}

.fill {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  background: rgb(var(--color-gold-rgb) / var(--alpha));
  font-size: 0.7rem;
  line-height: 1;
}

.route {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.route polyline {
  fill: none;
  stroke: var(--color-gold-bright);
  stroke-width: 0.12;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 0.08px rgb(0 0 0 / 0.9));
  opacity: 0.95;
}

.caption {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-gold-bright);
}
</style>
