<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import GameBoard from '#game/app/components/GameBoard.vue';
import { buildInitialTileStates } from '#game/app/utils/boardUtils';
import { UI_COPY } from '#game/app/content/uiCopy';
import { HINTS_PER_ROAD_MODE } from '#game/lib/gameConstants';
import { calcMedalForAttempt } from '#game/lib/gameTiers';
import { guideHighlightTiles, hintRevealsNewTile } from '#game/shared/utils/hints';
import type { HintResult } from '#game/shared/types/game';
import type { Medal, PlayerRun, PublicRoad, Standing } from '../shared/api';
import { current, isOverTarget, moveTo, replayRoute, startRun, undo, type RunState } from '../shared/run';
import { ApiError, fetchRoad, postFinish, postHint, postStart } from './api';
import ResultCard from './ResultCard.vue';
import { clearRoute, loadRoute, saveRoute } from './savedRoute';

const road = ref<PublicRoad | null>(null);
const error = ref<string | null>(null);
const run = ref<RunState | null>(null);

/** The server's record. Null for a logged-out player. */
const record = ref<PlayerRun | null>(null);
const loggedIn = ref(false);
/** Logged-out players: counted here only, never saved. */
const guestAttempts = ref(0);
const guestHints = ref(0);

/** Whether the try on the board has been counted (its first step is taken). */
const tryStarted = ref(false);
/** Whether the road was already solved before this try began. */
const solvedBefore = ref(false);
const guide = ref<number[]>([]);
const hintKind = ref<HintResult['kind'] | null>(null);
const hinting = ref(false);
const finishing = ref(false);
const saveProblem = ref(false);
/** Rank and streak from the server, once the road is solved. */
const standing = ref<Standing | null>(null);
const showResult = ref(false);
/** A logged-out solve, kept here so the card can show it. */
const guestSolved = ref(false);

// Signals the website board listens to for its small animations.
const failSignal = ref(0);
const deniedSignal = ref(0);
const deniedTile = ref<number | null>(null);
const focusSignal = ref(0);

onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  try {
    const response = await fetchRoad('classic');
    road.value = response.road;
    record.value = response.run;
    loggedIn.value = response.run !== null;
    solvedBefore.value = !!response.run?.solved;
    guide.value = response.run?.guidePath ?? [];
    standing.value = response.standing;
    showResult.value = !!response.run?.solved;
    run.value = resumeOrStart(response.road);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
});

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

function resumeOrStart(next: PublicRoad): RunState {
  const saved = loadRoute(next.day, next.mode);
  const resumed = saved ? replayRoute(next.board, next.target, saved.path) : null;
  if (saved && resumed && !resumed.outcome) {
    tryStarted.value = saved.started;
    return resumed;
  }
  clearRoute(next.day, next.mode);
  return startRun(next.board);
}

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
const hintedTiles = computed(() =>
  road.value && run.value
    ? new Set(guideHighlightTiles(guide.value, run.value.path, road.value.board.start))
    : new Set<number>(),
);

const toGo = computed(() => (road.value && run.value ? road.value.target - run.value.score : 0));
const overTarget = computed(() =>
  road.value && run.value ? isOverTarget(road.value.mode, road.value.target, run.value) : false,
);

const attempts = computed(() => (loggedIn.value ? record.value?.attempts ?? 0 : guestAttempts.value));
/** The try on the board: counted once its first step is taken. */
const tryNumber = computed(() => (tryStarted.value ? attempts.value : attempts.value + 1));
const hintsLeft = computed(() =>
  loggedIn.value ? record.value?.hintsLeft ?? 0 : HINTS_PER_ROAD_MODE - guestHints.value,
);

const tryLabel = computed(() => (solvedBefore.value ? 'Practice' : `Try ${tryNumber.value}`));

const medal = computed<Medal | null>(() => {
  if (loggedIn.value) return record.value?.medal ?? null;
  const solved = guestSolved.value || run.value?.outcome === 'solved';
  return solved ? calcMedalForAttempt(guestAttempts.value, true) : null;
});

/** The gap to the target, in words, so it never relies on colour alone. */
const gapLabel = computed(() => {
  if (toGo.value > 0) return `${toGo.value} to go`;
  if (toGo.value < 0) return `${-toGo.value} over`;
  return 'On target';
});

const HINT_COPY: Record<HintResult['kind'], string> = {
  'next-step': UI_COPY.runtime.hintNextStep,
  diverged: UI_COPY.runtime.hintDiverged,
  'already-solved': UI_COPY.runtime.hintAlreadySolved,
};

const status = computed(() => {
  const state = run.value;
  if (!state) return '';
  switch (state.outcome) {
    case 'solved': {
      if (solvedBefore.value) return UI_COPY.runtime.solvedAgain;
      if (finishing.value) return 'Solved. Checking…';
      const tries = loggedIn.value ? record.value?.solvedAttempt ?? tryNumber.value : guestAttempts.value;
      const name = medal.value ? `${medal.value[0]!.toUpperCase()}${medal.value.slice(1)}` : 'Solved';
      return `${name} on try ${tries}.`;
    }
    case 'wrong-exit':
      return toGo.value > 0
        ? UI_COPY.runtime.destinationShort(toGo.value)
        : UI_COPY.runtime.destinationOver(-toGo.value);
    case 'dead-end':
      return UI_COPY.runtime.deadEnd;
  }
  if (saveProblem.value) return 'Could not reach the server. This try may not be saved.';
  if (hintKind.value) return HINT_COPY[hintKind.value];
  if (overTarget.value) {
    return toGo.value === 0
      ? 'On target, but not on the flag. This walk cannot finish.'
      : `${-toGo.value} over. This walk can no longer land on the target.`;
  }
  if (state.path.length === 1 && !tryStarted.value) {
    return 'Step onto a glowing tile. Reach the flag exactly on the target.';
  }
  return '';
});

const hasResult = computed(() => (loggedIn.value ? !!record.value?.solved : guestSolved.value));
const result = computed(() =>
  loggedIn.value
    ? {
        attempts: record.value?.solvedAttempt ?? 0,
        hints: record.value?.hintsUsed ?? 0,
        seconds: record.value?.solveSeconds ?? null,
      }
    : { attempts: guestAttempts.value, hints: guestHints.value, seconds: null },
);

const canUndo = computed(() => !!run.value?.undoAvailable && !run.value.outcome);
const ended = computed(() => !!run.value?.outcome);
const canHint = computed(() => !ended.value && !hinting.value && hintsLeft.value > 0 && !solvedBefore.value);

function persist() {
  if (!road.value || !run.value) return;
  saveRoute(road.value.day, road.value.mode, { path: run.value.path, started: tryStarted.value });
}

async function countTry() {
  if (!road.value) return;
  tryStarted.value = true;
  persist();
  if (!loggedIn.value) {
    if (!solvedBefore.value) guestAttempts.value += 1;
    return;
  }
  try {
    record.value = (await postStart(road.value.mode)).run;
  } catch (cause) {
    console.error('start failed', cause);
    saveProblem.value = true;
  }
}

async function finish() {
  if (!road.value || !run.value) return;
  const { mode, day } = road.value;
  clearRoute(day, mode);
  finishing.value = true;
  try {
    const result = await postFinish(mode, run.value.path);
    if (result.run) record.value = result.run;
    if (result.outcome === 'solved' && !solvedBefore.value) {
      standing.value = result.standing;
      if (!loggedIn.value) guestSolved.value = true;
      showResult.value = true;
    }
  } catch (cause) {
    console.error('finish failed', cause);
    saveProblem.value = true;
  } finally {
    finishing.value = false;
  }
}

function select(tile: number) {
  if (!road.value || !run.value || finishing.value) return;
  const result = moveTo(road.value.board, road.value.target, run.value, tile);
  if (result.kind === 'denied') {
    deniedTile.value = tile;
    deniedSignal.value += 1;
    return;
  }
  run.value = result.state;
  focusSignal.value += 1;
  hintKind.value = null;
  if (result.kind === 'moved' && !tryStarted.value) void countTry();
  if (result.state.outcome) {
    if (result.state.outcome !== 'solved') failSignal.value += 1;
    void finish();
  } else {
    persist();
  }
}

function takeBack() {
  if (!road.value || !run.value) return;
  const back = undo(road.value.board, run.value);
  if (back) {
    run.value = back;
    focusSignal.value += 1;
    persist();
  }
}

function tryAgain() {
  if (!road.value || !run.value || finishing.value) return;
  if (run.value.outcome === 'solved') solvedBefore.value = true;
  run.value = startRun(road.value.board);
  tryStarted.value = false;
  hintKind.value = null;
  saveProblem.value = false;
  clearRoute(road.value.day, road.value.mode);
  focusSignal.value += 1;
}

async function askHint() {
  if (!road.value || !run.value || !canHint.value) return;
  hinting.value = true;
  const path = [...run.value.path];
  try {
    const response = await postHint(road.value.mode, path, guide.value);
    // The player may have moved while the hint was on its way.
    if (!run.value || run.value.path.length !== path.length) return;
    if (response.run) {
      record.value = response.run;
      guide.value = response.run.guidePath;
    } else if (hintRevealsNewTile(guide.value, response.hint.guidePath)) {
      guestHints.value += 1;
      guide.value = response.hint.guidePath;
    }
    hintKind.value = response.hint.kind;
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 429 && record.value) {
      record.value = { ...record.value, hintsLeft: 0 };
    } else {
      console.error('hint failed', cause);
    }
  } finally {
    hinting.value = false;
  }
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
          :hinted-tiles="hintedTiles"
          :path-history="run.path"
          :guide-path="guide"
          :disabled="ended || finishing"
          :fail-signal="failSignal"
          :denied-move-signal="deniedSignal"
          :denied-tile-index="deniedTile"
          :focus-signal="focusSignal"
          @select="select"
        />
      </section>

      <footer class="footer">
        <p
          class="status"
          :class="{ 'status--solved': run.outcome === 'solved', 'status--hint': hintKind && !run.outcome }"
          aria-live="polite"
        >
          {{ status }}
        </p>
        <div class="controls">
          <button type="button" class="control" :disabled="!canUndo" @click="takeBack">Undo</button>
          <button
            type="button"
            class="control control--hint"
            :disabled="!canHint"
            :aria-label="`Hint, ${hintsLeft} left`"
            @click="askHint"
          >
            Hint <span class="count">{{ hintsLeft }}</span>
          </button>
          <button
            type="button"
            class="control"
            :class="{ 'control--primary': ended || overTarget }"
            :disabled="(run.path.length === 1 && !ended) || finishing"
            @click="tryAgain"
          >
            Try again
          </button>
        </div>
        <p class="try">
          {{ tryLabel }}
          <template v-if="hasResult">
            · <button type="button" class="link" @click="showResult = true">Your result</button>
          </template>
        </p>
      </footer>

      <ResultCard
        v-if="showResult && hasResult"
        :road-no="road.roadNo"
        :medal="medal"
        :attempts="result.attempts"
        :hints="result.hints"
        :seconds="result.seconds"
        :standing="standing"
        :logged-in="loggedIn"
        @close="showResult = false"
      />
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

.status--hint {
  color: var(--color-hint);
}

.status--solved {
  color: var(--color-solved);
  font-weight: 700;
}

.controls {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  gap: 10px;
  width: min(100%, 420px);
  margin: 0 auto;
}

.try {
  margin: 0;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-gold-muted);
}

.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-gold);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
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

.count {
  display: inline-grid;
  place-items: center;
  min-width: 1.4em;
  margin-left: 4px;
  padding: 0 4px;
  border-radius: var(--radius-full);
  background: rgb(var(--color-hint-rgb) / 0.85);
  color: #fff;
  font-size: 0.8em;
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
