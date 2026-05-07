<script setup lang="ts">
import { computed } from 'vue';
import { buildEdgeMap, getEdgeType } from '../../shared/utils/puzzleEngine';
import type { Board, EdgeType, PuzzleType } from '../../shared/types/game';
import type { TileState } from '../types/game';
import GameTile from './GameTile.vue';
import BoardRoad from './BoardRoad.vue';
import { UI_COPY } from '../content/uiCopy';

type RoadVisualType = 'open' | Exclude<EdgeType, 'missing'>;

const props = defineProps<{
  board: Board;
  puzzleType: PuzzleType;
  tiles: TileState[][];
  currentTileIndex: number | null;
  activeSet: Set<number>;
  visitedSet: Set<number>;
  hintedTiles: Set<number>;
  pathHistory: number[];
  disabled?: boolean;
}>();

const emit = defineEmits<{
  select: [tileIndex: number];
}>();

const BOARD_CELL = '(var(--tile-size) + var(--tile-gap))';
const ROAD_OFFSET = '((var(--tile-size) - var(--road-thickness)) / 2)';

function buildRoadStyle(
  row: number,
  col: number,
  orientation: 'h' | 'v',
): Record<string, string> {
  if (orientation === 'h') {
    return {
      left: `calc(${col} * ${BOARD_CELL} + var(--tile-size))`,
      top: `calc(${row} * ${BOARD_CELL} + ${ROAD_OFFSET})`,
      width: 'var(--tile-gap)',
      height: 'var(--road-thickness)',
    };
  }

  return {
    left: `calc(${col} * ${BOARD_CELL} + ${ROAD_OFFSET})`,
    top: `calc(${row} * ${BOARD_CELL} + var(--tile-size))`,
    width: 'var(--road-thickness)',
    height: 'var(--tile-gap)',
  };
}

const edgeMap = computed(() => buildEdgeMap(props.board));

const traversedEdges = computed(() => {
  const map = new Map<string, string>();
  const { cols } = props.board;
  for (let i = 0; i < props.pathHistory.length - 1; i++) {
    const a = props.pathHistory[i];
    const b = props.pathHistory[i + 1];
    if (typeof a !== 'number' || typeof b !== 'number') {
      continue;
    }
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    const diff = b - a;
    if (diff === 1) map.set(key, 'right');
    else if (diff === -1) map.set(key, 'left');
    else if (diff === cols) map.set(key, 'down');
    else map.set(key, 'up');
  }
  return map;
});

interface RoadData {
  key: string;
  orientation: 'h' | 'v';
  type: RoadVisualType;
  state: 'default' | 'closed' | 'active' | 'traversed';
  traversed: boolean;
  arrowDir: string | null;
  style: Record<string, string>;
}

const allRoads = computed<RoadData[]>(() => {
  const roads: RoadData[] = [];
  const { rows, cols } = props.board;
  const em = edgeMap.value;
  const trav = traversedEdges.value;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;

      if (col < cols - 1) {
        const rightIdx = idx + 1;
        const type = getEdgeType(idx, rightIdx, em);
        if (type !== 'missing') {
          const edgeKey = `${idx}-${rightIdx}`;
          const hit = trav.has(edgeKey);
          const hasVisitedEndpoint =
            props.visitedSet.has(idx) || props.visitedSet.has(rightIdx);
          const isCurrentActiveRoad =
            (props.currentTileIndex === idx && props.activeSet.has(rightIdx)) ||
            (props.currentTileIndex === rightIdx && props.activeSet.has(idx));
          const state = hit
            ? 'traversed'
            : isCurrentActiveRoad
              ? 'active'
              : hasVisitedEndpoint
                ? 'closed'
                : 'default';

          roads.push({
            key: `h-${idx}`,
            orientation: 'h',
            type,
            state,
            traversed: hit,
            arrowDir: hit ? trav.get(edgeKey)! : null,
            style: buildRoadStyle(row, col, 'h'),
          });
        }
      }

      if (row < rows - 1) {
        const downIdx = idx + cols;
        const type = getEdgeType(idx, downIdx, em);
        if (type === 'missing') {
          continue;
        }
        const edgeKey = `${idx}-${downIdx}`;
        const hit = trav.has(edgeKey);
        const hasVisitedEndpoint =
          props.visitedSet.has(idx) || props.visitedSet.has(downIdx);
        const isCurrentActiveRoad =
          (props.currentTileIndex === idx && props.activeSet.has(downIdx)) ||
          (props.currentTileIndex === downIdx && props.activeSet.has(idx));
        const state = hit
          ? 'traversed'
          : isCurrentActiveRoad
            ? 'active'
            : hasVisitedEndpoint
              ? 'closed'
              : 'default';

        roads.push({
          key: `v-${idx}`,
          orientation: 'v',
          type,
          state,
          traversed: hit,
          arrowDir: hit ? trav.get(edgeKey)! : null,
          style: buildRoadStyle(row, col, 'v'),
        });
      }
    }
  }

  return roads;
});
</script>

<template>
  <section class="board-shell">
    <div v-if="puzzleType === 'expedition'" class="board-info">
      <div class="info-item info-toll">
        <span class="info-icon">⊝</span>
        <span class="info-label"
          >{{ UI_COPY.board.info.toll }}: -{{ board.tollValue }}</span
        >
      </div>
      <div class="info-item info-bonus">
        <span class="info-icon">⊕</span>
        <span class="info-label"
          >{{ UI_COPY.board.info.bonus }}: +{{ board.bonusValue }}</span
        >
      </div>
      <p class="kbd-note">{{ UI_COPY.board.keyboardHint }}</p>
    </div>

    <p v-else class="kbd-note">{{ UI_COPY.board.keyboardHint }}</p>

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
        :state="road.state"
        :traversed="road.traversed"
        :arrow-dir="road.arrowDir"
        :orientation="road.orientation"
        :style="road.style"
      />
    </div>
  </section>
</template>

<style scoped>
.board-shell {
  display: grid;
  gap: 0.7rem;
  text-align: left;
}

.kbd-note {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.8);
  font-size: 0.86rem;
}

.board-info {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
  align-items: center;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.8rem;
  border-radius: var(--radius-full);
  font-size: 0.9rem;
  font-weight: 700;
  border: 1px solid;
}

.info-toll {
  background: rgb(205 127 50 / 0.15);
  color: var(--color-toll);
  border-color: rgb(205 127 50 / 0.4);
}

.info-bonus {
  background: rgb(255 215 0 / 0.15);
  color: var(--color-bonus);
  border-color: rgb(255 215 0 / 0.4);
}

.info-icon {
  font-size: 1.1rem;
  line-height: 1;
}

.info-label {
  letter-spacing: 0.02em;
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
  .board-info {
    justify-content: start;
    gap: 0.6rem;
  }

  .info-item {
    padding: 0.35rem 0.65rem;
    font-size: 0.82rem;
  }

  .info-icon {
    font-size: 1rem;
  }
}
</style>
