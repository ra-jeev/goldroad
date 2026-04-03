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
.board-shell {
  padding: 1rem;
  border-radius: 24px;
  background: linear-gradient(180deg, #fffdf8 0%, #eef4ff 100%);
  border: 1px solid #dbe2f3;
  box-shadow: 0 18px 40px rgb(28 39 74 / 10%);
}

.board-header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 1rem;
  margin-bottom: 0.9rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #5d6d91;
}

.board-header h2 {
  margin: 0.15rem 0 0;
  font-size: 1.05rem;
  color: #1d2850;
}

.kbd-note {
  margin: 0;
  color: #6a7697;
  font-size: 0.9rem;
}

.board {
  display: grid;
  gap: 0.6rem;
}

.tile {
  position: relative;
  aspect-ratio: 1 / 1;
  border: 1px solid #d6deef;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #f7faff 100%);
  color: #18254b;
  font-weight: 800;
  overflow: hidden;
  transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease, background 140ms ease;
}

.tile:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgb(38 57 105 / 14%);
}

.tile.active {
  border-color: #3d6cff;
  background: linear-gradient(180deg, #eef4ff 0%, #deebff 100%);
}

.tile.done {
  border-color: #a6c77a;
  background: linear-gradient(180deg, #f3fbe8 0%, #e5f2cd 100%);
}

.tile.current {
  box-shadow: inset 0 0 0 3px #f08c00;
}

.tile.hinted {
  box-shadow: inset 0 0 0 3px #d6336c;
}

.value {
  position: relative;
  z-index: 2;
  font-size: 1.15rem;
}

.step-badge {
  position: absolute;
  top: 0.34rem;
  left: 0.38rem;
  z-index: 2;
  min-width: 1.25rem;
  height: 1.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #20335f;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
}

.tag {
  position: absolute;
  right: 0.38rem;
  z-index: 2;
  min-width: 1.4rem;
  height: 1.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 800;
}

.tag-start {
  top: 0.34rem;
  background: #0f766e;
}

.tag-end {
  bottom: 0.34rem;
  background: #c2410c;
}

.edge {
  position: absolute;
  z-index: 1;
  pointer-events: none;
}

.edge-top,
.edge-bottom {
  left: 16%;
  right: 16%;
  height: 7px;
  border-radius: 999px;
}

.edge-left,
.edge-right {
  top: 16%;
  bottom: 16%;
  width: 7px;
  border-radius: 999px;
}

.edge-top { top: 0.12rem; }
.edge-bottom { bottom: 0.12rem; }
.edge-left { left: 0.12rem; }
.edge-right { right: 0.12rem; }

.edge-open,
.edge-boundary {
  display: none;
}

.edge-blocked {
  background: #111827;
}

.edge-cost {
  background: #f59e0b;
}

.edge-bonus {
  background: #0f9d72;
}

button:disabled {
  cursor: default;
}

@media (max-width: 760px) {
  .board-header {
    display: grid;
    gap: 0.45rem;
  }

  .kbd-note {
    font-size: 0.82rem;
  }
}
</style>
