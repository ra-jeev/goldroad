<script setup lang="ts">
import { computed } from 'vue'
import { buildEdgeMap, getEdgeType } from '../../shared/utils/puzzleEngine'
import type { Board, EdgeType } from '../../shared/types/game'
import type { TileState } from '../types/game'
import GameTile from './GameTile.vue'
import BoardRoad from './BoardRoad.vue'
import { UI_COPY } from '../content/uiCopy'

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

const TILE_PX = 50
const GAP_PX = 14
const CELL = TILE_PX + GAP_PX
const ROAD_THICK = 6

const edgeMap = computed(() => buildEdgeMap(props.board))

const traversedEdges = computed(() => {
  const map = new Map<string, string>()
  const { cols } = props.board
  for (let i = 0; i < props.pathHistory.length - 1; i++) {
    const a = props.pathHistory[i]
    const b = props.pathHistory[i + 1]
    if (typeof a !== 'number' || typeof b !== 'number') {
      continue
    }
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`
    const diff = b - a
    if (diff === 1) map.set(key, 'right')
    else if (diff === -1) map.set(key, 'left')
    else if (diff === cols) map.set(key, 'down')
    else map.set(key, 'up')
  }
  return map
})

interface RoadData {
  key: string
  orientation: 'h' | 'v'
  type: 'open' | EdgeType
  traversed: boolean
  arrowDir: string | null
  style: Record<string, string>
}

const allRoads = computed<RoadData[]>(() => {
  const roads: RoadData[] = []
  const { rows, cols } = props.board
  const em = edgeMap.value
  const trav = traversedEdges.value

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c

      if (c < cols - 1) {
        const nIdx = idx + 1
        const t = getEdgeType(idx, nIdx, em)
        const edgeKey = `${idx}-${nIdx}`
        const hit = trav.has(edgeKey)
        roads.push({
          key: `h-${idx}`,
          orientation: 'h',
          type: t,
          traversed: hit,
          arrowDir: hit ? trav.get(edgeKey)! : null,
          style: {
            left: `${c * CELL + TILE_PX}px`,
            top: `${r * CELL + (TILE_PX - ROAD_THICK) / 2}px`,
            width: `${GAP_PX}px`,
            height: `${ROAD_THICK}px`,
          },
        })
      }

      if (r < rows - 1) {
        const nIdx = idx + cols
        const t = getEdgeType(idx, nIdx, em)
        const edgeKey = `${idx}-${nIdx}`
        const hit = trav.has(edgeKey)
        roads.push({
          key: `v-${idx}`,
          orientation: 'v',
          type: t,
          traversed: hit,
          arrowDir: hit ? trav.get(edgeKey)! : null,
          style: {
            left: `${c * CELL + (TILE_PX - ROAD_THICK) / 2}px`,
            top: `${r * CELL + TILE_PX}px`,
            width: `${ROAD_THICK}px`,
            height: `${GAP_PX}px`,
          },
        })
      }
    }
  }

  return roads
})
</script>

<template>
  <section class="board-shell">
    <header class="board-header">
      <div>
        <p class="eyebrow">{{ UI_COPY.board.eyebrow }}</p>
        <h2>{{ UI_COPY.board.heading }}</h2>
      </div>
      <p class="kbd-note">{{ UI_COPY.board.keyboardHint }}</p>
    </header>

    <div class="board-wrapper">
      <div
        class="board"
        :style="{
          gridTemplateColumns: `repeat(${board.cols}, var(--tile-size))`,
        }"
      >
        <GameTile
          v-for="tile in tiles.flat()"
          :key="tile.id"
          :value="tile.value"
          :is-start="board.start === tile.id"
          :is-end="board.end === tile.id"
          :is-current="currentTileIndex === tile.id"
          :is-active="activeSet.has(tile.id)"
          :is-done="visitedSet.has(tile.id)"
          :is-hinted="hintedTiles.has(tile.id)"
          :disabled="disabled"
          @select="emit('select', tile.id)"
        />
      </div>

      <BoardRoad
        v-for="road in allRoads"
        :key="road.key"
        :type="road.type"
        :traversed="road.traversed"
        :arrow-dir="road.arrowDir"
        :style="road.style"
      />
    </div>
  </section>
</template>

<style scoped>
.board-shell {
  padding: 1.1rem;
  border-radius: var(--radius-xl);
  background: var(--gradient-card-board);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.40);
  box-shadow:
    var(--shadow-border-dark),
    var(--shadow-2xl),
    var(--shadow-inset-gold);
  text-align: center;
}

.board-header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 1rem;
  margin-bottom: 1rem;
  text-align: left;
}

.board-header h2 {
  margin: 0.18rem 0 0;
  font-size: 1.08rem;
  letter-spacing: var(--letter-spacing-tight);
  color: var(--color-gold-bright);
}

.kbd-note {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.80);
  font-size: 0.86rem;
}

.board-wrapper {
  position: relative;
  display: inline-block;
  margin: 0 auto;
}

.board {
  display: grid;
  gap: var(--tile-gap);
}

@media (max-width: 760px) {
  .board-header {
    display: grid;
    gap: 0.45rem;
  }
}
</style>
