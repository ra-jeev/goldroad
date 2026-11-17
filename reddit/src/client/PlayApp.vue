<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import GameBoard from '#game/app/components/GameBoard.vue';
import { buildInitialTileStates } from '#game/app/utils/boardUtils';
import { UI_COPY } from '#game/app/content/uiCopy';
import { calcMedalForAttempt } from '#game/lib/gameTiers';
import type { PublicRoad } from '../shared/api';
import { fetchRoad } from './api';
import { current, isOverTarget, moveTo, startRun, undo, type RunState } from './run';

const road = ref<PublicRoad | null>(null);
const error = ref<string | null>(null);
const run = ref<RunState | null>(null);
const attempt = ref(1);

// Signals the website board listens to for its small animations.
const failSignal = ref(0);
const deniedSignal = ref(0);
const deniedTile = ref<number | null>(null);
const focusSignal = ref(0);

onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  try {
    const response = await fetchRoad();
    road.value = response.road;
    run.value = startRun(response.road.board);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
});

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

const tiles = computed(() => {
  if (!road.value || !run.value) return [];
  const here = current(run.value);
  const visited = new Set(run.value.path);
  const active = new Set(run.value.active);
  return buildInitialTileStates(road.value.board).map((row) =>
    row.map((tile) => ({
      ...tile,
      done: visited.has(tile.id),
      active: active.has(tile.id),
      tabIndex: tile.id === here ? 0 : -1,
    })),
  );
});
const activeSet = computed(() => new Set(run.value?.active ?? []));
const visitedSet = computed(() => new Set(run.value?.path ?? []));
const noHints = new Set<number>();

const toGo = computed(() => (road.value && run.value ? road.value.target - run.value.score : 0));
const overTarget = computed(() =>
  road.value && run.value ? isOverTarget(road.value.mode, road.value.target, run.value) : false,
);
const medal = computed(() =>
  run.value?.outcome === 'solved' ? calcMedalForAttempt(attempt.value, true) : null,
);

/** The gap to the target, in words, so it never relies on colour alone. */
const gapLabel = computed(() => {
  if (toGo.value > 0) return `${toGo.value} to go`;
  if (toGo.value < 0) return `${-toGo.value} over`;
  return 'On target';
});

const status = computed(() => {
  const state = run.value;
  if (!state) return '';
  switch (state.outcome) {
    case 'solved':
      return medal.value
        ? `Solved. ${medal.value[0]!.toUpperCase()}${medal.value.slice(1)} on try ${attempt.value}.`
        : `Solved on try ${attempt.value}.`;
    case 'wrong-exit':
      return toGo.value > 0
        ? UI_COPY.runtime.destinationShort(toGo.value)
        : UI_COPY.runtime.destinationOver(-toGo.value);
    case 'dead-end':
      return UI_COPY.runtime.deadEnd;
  }
  if (overTarget.value) {
    return toGo.value === 0
      ? 'On target, but not on the flag. This walk cannot finish.'
      : `${-toGo.value} over. This walk can no longer land on the target.`;
  }
  if (state.path.length === 1) return 'Step onto a glowing tile. Reach the flag exactly on the target.';
  return '';
});

const canUndo = computed(() => !!run.value?.undoAvailable && !run.value.outcome);
const ended = computed(() => !!run.value?.outcome);

function select(tile: number) {
  if (!road.value || !run.value) return;
  const result = moveTo(road.value.board, road.value.target, run.value, tile);
  if (result.kind === 'denied') {
    deniedTile.value = tile;
    deniedSignal.value += 1;
    return;
  }
  run.value = result.state;
  focusSignal.value += 1;
  if (result.state.outcome === 'wrong-exit' || result.state.outcome === 'dead-end') {
    failSignal.value += 1;
  }
}

function takeBack() {
  if (!road.value || !run.value) return;
  const back = undo(road.value.board, run.value);
  if (back) {
    run.value = back;
    focusSignal.value += 1;
  }
}

function tryAgain() {
  if (!road.value || !run.value) return;
  // A try counts once the player has left the footprints.
  if (run.value.path.length > 1 && run.value.outcome !== 'solved') attempt.value += 1;
  run.value = startRun(road.value.board);
  focusSignal.value += 1;
}

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0], w: [-1, 0],
  ArrowDown: [1, 0], s: [1, 0],
  ArrowLeft: [0, -1], a: [0, -1],
  ArrowRight: [0, 1], d: [0, 1],
};

function onKeydown(event: KeyboardEvent) {
  if (!road.value || !run.value || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === 'Backspace') {
    event.preventDefault();
    takeBack();
    return;
  }
  const step = ARROWS[event.key];
  if (!step) return;
  event.preventDefault();
  const { cols, rows } = road.value.board;
  const here = current(run.value);
  const row = Math.floor(here / cols) + step[0];
  const col = (here % cols) + step[1];
  if (row < 0 || row >= rows || col < 0 || col >= cols) return;
  select(row * cols + col);
}
</script>

<template>
  <main class="play">
    <p v-if="error" class="notice" role="alert">Could not load the road. {{ error }}</p>
    <p v-else-if="!road || !run" class="notice">{{ UI_COPY.runtime.loadingGame }}</p>
    <template v-else>
      <header class="header">
        <h1 class="title">GoldRoad <span class="road-no">#{{ road.roadNo }}</span></h1>
        <div class="metrics">
          <div class="metric">
            <span class="metric-label">Score</span>
            <span class="metric-value">{{ run.score }}</span>
          </div>
          <div class="metric metric--gap" :class="{ 'is-over': toGo < 0, 'is-on': toGo === 0 }">
            <span class="metric-label">Gap</span>
            <span class="metric-value metric-value--words">{{ gapLabel }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Target</span>
            <span class="metric-value">{{ road.target }}</span>
          </div>
        </div>
      </header>

      <section
        class="board-area"
        :style="{ '--cols': road.board.cols, '--rows': road.board.rows }"
      >
        <GameBoard
          :board="road.board"
          :puzzle-type="road.mode"
          :tiles="tiles"
          :current-tile-index="current(run)"
          :active-set="activeSet"
          :visited-set="visitedSet"
          :hinted-tiles="noHints"
          :path-history="run.path"
          :disabled="ended"
          :fail-signal="failSignal"
          :denied-move-signal="deniedSignal"
          :denied-tile-index="deniedTile"
          :focus-signal="focusSignal"
          @select="select"
        />
      </section>

      <footer class="footer">
        <p class="status" :class="{ 'status--solved': run.outcome === 'solved' }" aria-live="polite">
          {{ status }}
        </p>
        <div class="controls">
          <button type="button" class="control" :disabled="!canUndo" @click="takeBack">Undo</button>
          <span class="try">Try {{ attempt }}</span>
          <button
            type="button"
            class="control"
            :class="{ 'control--primary': ended || overTarget }"
            :disabled="run.path.length === 1"
            @click="tryAgain"
          >
            Try again
          </button>
        </div>
      </footer>
    </template>
  </main>
</template>

<style scoped>
.play {
  /* Fixed board furniture, as on the website. Tiles take what is left. */
  --tile-gap: 14px;
  --road-thickness: 12px;
  --board-margin: 12px;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 10px var(--board-margin) max(10px, env(safe-area-inset-bottom));
  background: var(--gradient-bg-main);
  color: var(--color-gold);
}

.notice {
  margin: auto;
  color: var(--color-gold-muted);
}

.header {
  display: grid;
  gap: 8px;
  justify-items: center;
}

.title {
  margin: 0;
  font-size: 1.375rem;
  line-height: 1.1;
  color: var(--color-gold-bright);
  letter-spacing: 0.04em;
}

.road-no {
  color: var(--color-gold-muted);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: min(100%, 420px);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.3);
  border-radius: var(--radius-sm);
  background: var(--gradient-card-metric);
}

.metric {
  display: grid;
  justify-items: center;
  padding: 6px 4px;
}

.metric + .metric {
  border-left: 1px solid rgb(var(--color-gold-rgb) / 0.2);
}

.metric-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-gold-muted);
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.metric-value--words {
  font-size: 1.05rem;
  line-height: 1.6;
  white-space: nowrap;
}

.metric--gap.is-over .metric-value {
  color: var(--color-toll-bright);
}

.metric--gap.is-on .metric-value {
  color: var(--color-solved);
}

.board-area {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  container-type: size;
  /* Size the tiles from the space this area really has, in both directions,
     so the whole board always fits without scrolling. */
  --tile-size: clamp(
    26px,
    min(
      (100cqw - (var(--cols) - 1) * var(--tile-gap) - 16px) / var(--cols),
      (100cqh - (var(--rows) - 1) * var(--tile-gap) - 16px) / var(--rows)
    ),
    68px
  );
}

/* Tile digits scale with the tile, in the bold UI face. */
.board-area :deep(.tile) {
  font-size: calc(var(--tile-size) * 0.5);
  font-weight: 800;
}

.footer {
  display: grid;
  gap: 8px;
}

.status {
  min-height: 2.6em;
  margin: 0;
  display: grid;
  place-items: center;
  text-align: center;
  font-size: 0.95rem;
  line-height: 1.3;
  color: var(--color-gold-bright);
}

.status--solved {
  color: var(--color-solved);
  font-weight: 700;
}

.controls {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  width: min(100%, 420px);
  margin: 0 auto;
}

.try {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-gold-muted);
}

.control {
  min-height: 44px;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.5);
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.08);
  color: var(--color-gold);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.control:disabled {
  opacity: 0.4;
  cursor: default;
}

.control--primary {
  border-color: transparent;
  background: var(--gradient-button-primary);
  color: var(--color-text-on-gold);
}
</style>
