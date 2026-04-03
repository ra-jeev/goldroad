<script setup lang="ts">
import { computed } from 'vue'
import { buildEdgeMap, getEdgeType, getNeighborId, parseTileIndex } from '../../shared/utils/puzzleEngine'
import type { Board, Direction } from '../../shared/types/game'
import type { TileState } from '../types/game'

const props = defineProps<{
  board: Board
  tiles: TileState[][]
  currentTileIndex: number | null
  activeSet: Set<number>
  visitedSet: Set<number>
  hintedTiles: Set<number>
  pathHistory: number[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  select: [tileIndex: number]
}>()

const EDGE_DIRECTIONS: Direction[] = ['top', 'right', 'bottom', 'left']

const edgeMap = computed(() => buildEdgeMap(props.board))
const moveIndexMap = computed(() => {
  const map = new Map<number, number>()
  props.pathHistory.forEach((id, index) => map.set(id, index + 1))
  return map
})

function edgeTypeFor(tileIndex: number, direction: Direction): 'open' | 'blocked' | 'cost' | 'bonus' | 'boundary' {
  const [row, col] = parseTileIndex(tileIndex, props.board.cols)
  const neighbor = getNeighborId(row, col, direction, props.board.rows, props.board.cols)
  if (neighbor === null) return 'boundary'
  return getEdgeType(tileIndex, neighbor, edgeMap.value)
}

function edgeClass(tileIndex: number, direction: Direction) {
  const type = edgeTypeFor(tileIndex, direction)
  return ['edge', `edge-${direction}`, `edge-${type}`]
}

function tileClass(id: number) {
  return {
    tile: true,
    current: props.currentTileIndex === id,
    active: props.activeSet.has(id),
    done: props.visitedSet.has(id),
    start: props.board.start === id,
    end: props.board.end === id,
    hinted: props.hintedTiles.has(id),
  }
}

function moveIndex(id: number) {
  return moveIndexMap.value.get(id) ?? null
}
</script>

<template>
  <section class="board-shell">
    <header class="board-header">
      <div>
        <p class="eyebrow">Road Map</p>
        <h2>Pick the richest route to the exit</h2>
      </div>
      <p class="kbd-note">Click tiles or use arrow keys</p>
    </header>

    <div
      class="board"
      :style="{
        gridTemplateColumns: `repeat(${board.cols}, minmax(2.9rem, 1fr))`,
      }"
    >
      <button
        v-for="tile in tiles.flat()"
        :key="tile.id"
        :class="tileClass(tile.id)"
        :disabled="disabled"
        @click="emit('select', tile.id)"
      >
        <span
          v-for="dir in EDGE_DIRECTIONS"
          :key="`${tile.id}-${dir}`"
          :class="edgeClass(tile.id, dir)"
        />

        <span v-if="moveIndex(tile.id)" class="step-badge">{{ moveIndex(tile.id) }}</span>
        <span class="value">{{ tile.value }}</span>
        <span v-if="tile.start" class="tag tag-start">S</span>
        <span v-if="tile.end" class="tag tag-end">E</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
/* ── Board shell ────────────────────────────────────────────── */
.board-shell {
  padding: 1.1rem;
  border-radius: 26px;
  background:
    radial-gradient(ellipse 80% 60% at 18% 10%, rgb(255 212 59 / 6%) 0%, transparent 60%),
    linear-gradient(175deg, #1c1108 0%, #160e05 50%, #0e0a04 100%);
  border: 1px solid rgb(218 165 32 / 25%);
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 55%),
    0 28px 56px rgb(0 0 0 / 48%),
    inset 0 1px 0 rgb(255 215 0 / 10%);
}

.board-header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 1rem;
  margin-bottom: 1rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgb(218 165 32 / 65%);
}

.board-header h2 {
  margin: 0.18rem 0 0;
  font-size: 1.08rem;
  letter-spacing: 0.01em;
  color: #d4af37;
}

.kbd-note {
  margin: 0;
  color: rgb(218 165 32 / 45%);
  font-size: 0.86rem;
}

/* ── Tile grid ──────────────────────────────────────────────── */
.board {
  display: grid;
  gap: 0.7rem;
}

/* ── Tile base ──────────────────────────────────────────────── */
.tile {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  /* double-ring: dotted outer (brand red-orange), solid gold inner */
  border: 3px dotted #b33200;
  background: #160e05;
  color: goldenrod;
  font-size: 1.25rem;
  font-weight: 800;
  overflow: hidden;
  isolation: isolate;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

/* inner gold ring via outline */
.tile::before {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  border: 2.5px solid rgb(218 165 32 / 45%);
  pointer-events: none;
  z-index: 3;
}

/* ── Tile states ────────────────────────────────────────────── */
.tile.active {
  border-color: #b33200;
  cursor: pointer;
  color: goldenrod;
}

.tile.active::before {
  border-color: rgb(68 221 25 / 50%);
}

/* green tint fill for legal moves */
.tile.active::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(68 221 25 / 18%) 0%, transparent 72%);
  z-index: 0;
}

.tile.active:hover:not(:disabled) {
  transform: scale(1.08);
  box-shadow: 0 0 18px rgb(68 221 25 / 35%);
}

.tile.active:active:not(:disabled) {
  transform: scale(0.94);
}

/* gold fill + glow for visited path */
.tile.done {
  color: #2d1c02;
  border-color: darkgoldenrod;
}

.tile.done::before {
  border-color: darkgoldenrod;
}

.tile.done::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, rgb(212 175 55) 0%, rgb(184 142 30) 100%);
  z-index: 0;
}

.tile.done .value {
  color: #2d1c02;
  text-shadow: 0 1px 0 rgb(255 230 100 / 40%);
}

/* gold glow around current tile */
.tile.current {
  box-shadow:
    0 0 0 3px goldenrod,
    0 0 18px rgb(218 165 32 / 55%);
}

/* pink/magenta for hints */
.tile.hinted::before {
  border-color: #d6336c;
}

.tile.hinted {
  box-shadow: 0 0 14px rgb(214 51 108 / 45%);
}

.tile:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px #4b9eff, 0 0 12px rgb(75 158 255 / 35%);
}

/* ── Value text ─────────────────────────────────────────────── */
.value {
  position: relative;
  z-index: 2;
  /* let .done override via .done .value */
  color: goldenrod;
}

/* ── Step badge (path order) ────────────────────────────────── */
.step-badge {
  position: absolute;
  top: 0.28rem;
  left: 0.32rem;
  z-index: 4;
  min-width: 1.2rem;
  height: 1.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgb(0 0 0 / 60%);
  color: goldenrod;
  font-size: 0.62rem;
  font-weight: 800;
  border: 1px solid rgb(218 165 32 / 40%);
}

/* ── Start / End tags ───────────────────────────────────────── */
.tag {
  position: absolute;
  right: 0.3rem;
  z-index: 4;
  min-width: 1.25rem;
  height: 1.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: #fff;
  font-size: 0.62rem;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.tag-start {
  top: 0.28rem;
  background: #065f46;
  border: 1px solid #a7f3d0;
}

.tag-end {
  bottom: 0.3rem;
  background: #7f1d1d;
  border: 1px solid #fca5a5;
}

/* ── Edge constraint markers ─────────────────────────────────── */
.edge {
  position: absolute;
  z-index: 1;
  pointer-events: none;
}

.edge-top,
.edge-bottom {
  left: 22%;
  right: 22%;
  height: 6px;
  border-radius: 999px;
}

.edge-left,
.edge-right {
  top: 22%;
  bottom: 22%;
  width: 6px;
  border-radius: 999px;
}

.edge-top    { top: 0; }
.edge-bottom { bottom: 0; }
.edge-left   { left: 0; }
.edge-right  { right: 0; }

.edge-open,
.edge-boundary {
  display: none;
}

.edge-blocked {
  background: #fc2f00;
  opacity: 0.85;
}

.edge-cost {
  background: #f59e0b;
}

.edge-bonus {
  background: #22c55e;
}

button:disabled {
  cursor: default;
}

@media (prefers-reduced-motion: reduce) {
  .tile {
    transition: none;
  }

  .tile.active:hover:not(:disabled) {
    transform: none;
  }
}

@media (max-width: 760px) {
  .board-header {
    display: grid;
    gap: 0.45rem;
  }

  .board {
    gap: 0.52rem;
  }

  .tile {
    font-size: 1.1rem;
  }
}
</style>
