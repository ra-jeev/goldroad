<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { buildEdgeMap, getEdgeType } from '#shared/utils/puzzleEngine';
import type { Board, EdgeType, PuzzleType } from '#shared/types/game';
import type { TileState } from '../types/game';
import GameTile from './GameTile.vue';
import BoardRoad from './BoardRoad.vue';
import RoadGlyph from './RoadGlyph.vue';
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
  /** Ordered hint route. Ordering is what lets the guide draw as a road. */
  guidePath?: number[];
  disabled?: boolean;
  /**
   * Increments whenever a run ends without a solve, dead end or wrong exit
   * alike. The board answers by shaking the tile the player stopped on.
   */
  failSignal?: number;
}>();

const emit = defineEmits<{
  select: [tileIndex: number];
  scoringMove: [payload: { type: 'toll' | 'bonus' }];
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

/** Walk an ordered tile route into edge key -> arrow direction. */
function edgeDirections(route: number[], cols: number): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
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
}

const traversedEdges = computed(() =>
  edgeDirections(props.pathHistory, props.board.cols),
);

/**
 * The hint route drawn as a road rather than a scatter of lit tiles. Ten
 * highlighted tiles say where to end up but not how to get there; the edges
 * and their arrows are what make the guide followable on a retry.
 */
const guideEdges = computed(() =>
  edgeDirections(props.guidePath ?? [], props.board.cols),
);

interface RoadData {
  key: string;
  orientation: 'h' | 'v';
  type: RoadVisualType;
  state: 'default' | 'closed' | 'active' | 'traversed' | 'guide';
  traversed: boolean;
  arrowDir: string | null;
  style: Record<string, string>;
}

const allRoads = computed<RoadData[]>(() => {
  const roads: RoadData[] = [];
  const { rows, cols } = props.board;
  const em = edgeMap.value;
  const trav = traversedEdges.value;
  const guide = guideEdges.value;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;

      if (col < cols - 1) {
        const rightIdx = idx + 1;
        const type = getEdgeType(idx, rightIdx, em);
        if (type !== 'missing') {
          const edgeKey = `${idx}-${rightIdx}`;
          const hit = trav.has(edgeKey);
          // Already-walked edges keep their traversed look; the guide only
          // claims the stretch still ahead of the player.
          const guided = !hit && guide.has(edgeKey);
          const hasVisitedEndpoint =
            props.visitedSet.has(idx) || props.visitedSet.has(rightIdx);
          const isCurrentActiveRoad =
            (props.currentTileIndex === idx && props.activeSet.has(rightIdx)) ||
            (props.currentTileIndex === rightIdx && props.activeSet.has(idx));
          const state = hit
            ? 'traversed'
            : guided
              ? 'guide'
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
            arrowDir: hit
              ? trav.get(edgeKey)!
              : guided
                ? guide.get(edgeKey)!
                : null,
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
        const guided = !hit && guide.has(edgeKey);
        const hasVisitedEndpoint =
          props.visitedSet.has(idx) || props.visitedSet.has(downIdx);
        const isCurrentActiveRoad =
          (props.currentTileIndex === idx && props.activeSet.has(downIdx)) ||
          (props.currentTileIndex === downIdx && props.activeSet.has(idx));
        const state = hit
          ? 'traversed'
          : guided
            ? 'guide'
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
          arrowDir: hit
            ? trav.get(edgeKey)!
            : guided
              ? guide.get(edgeKey)!
              : null,
          style: buildRoadStyle(row, col, 'v'),
        });
      }
    }
  }

  return roads;
});

// The tile the player stopped on, shaken once per failed run. Held in state
// rather than derived so the class can be removed when the animation ends and
// re-added on the next failure.
const shakingTileId = ref<number | null>(null);
let shakeTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.failSignal,
  (signal, previous) => {
    if (signal === undefined || previous === undefined || signal <= previous) {
      return;
    }
    if (shakeTimer) clearTimeout(shakeTimer);
    shakingTileId.value = props.currentTileIndex;
    shakeTimer = setTimeout(() => {
      shakingTileId.value = null;
      shakeTimer = null;
    }, 240);
  },
);

onBeforeUnmount(() => {
  if (shakeTimer) clearTimeout(shakeTimer);
});

/**
 * Delay for each tile of a freshly lit hint route, measured from the first
 * tile the player has yet to walk, so the reveal reads as a direction.
 */
const hintDelays = computed(() => {
  const delays = new Map<number, number>();
  const path = props.guidePath ?? [];
  let step = 0;

  for (const tileId of path) {
    if (!props.hintedTiles.has(tileId)) continue;
    delays.set(tileId, step * 45);
    step += 1;
  }

  return delays;
});

// Signal the score readout when a move newly crosses a toll or bonus edge.
watch(
  () => props.pathHistory.length,
  (len, prevLen) => {
    if (len <= (prevLen ?? 0) || len < 2) {
      return;
    }
    const a = props.pathHistory[len - 2];
    const b = props.pathHistory[len - 1];
    if (typeof a !== 'number' || typeof b !== 'number') {
      return;
    }
    const type = getEdgeType(a, b, edgeMap.value);
    if (type === 'toll' || type === 'bonus') {
      emit('scoringMove', { type });
    }
  },
);
</script>

<template>
  <section class="board-shell">
    <div class="board-stage">
      <div class="board-info-slot">
        <div
          v-if="puzzleType === 'expedition'"
          class="board-info"
          aria-label="Expedition road values"
        >
          <div class="info-item">
            <span class="info-road" aria-hidden="true">
              <RoadGlyph type="toll" state="default" />
            </span>
            <span class="info-label">
              {{ UI_COPY.board.info.tollCost }}
            </span>
            <span class="info-value">
              {{ board.tollValue }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-road" aria-hidden="true">
              <RoadGlyph type="bonus" state="default" />
            </span>
            <span>
              {{ UI_COPY.board.info.roadBonus }}
            </span>
            <span class="info-value">
              {{ board.bonusValue }}
            </span>
          </div>
        </div>
      </div>

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
            :is-shaking="shakingTileId === tile.id"
            :hint-delay-ms="hintDelays.get(tile.id)"
            :tab-index="tile.tabIndex"
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
    </div>
  </section>
</template>

<style scoped>
.board-shell {
  display: grid;
  justify-items: center;
}

.board-stage {
  width: min(100%, 600px);
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0;
}

.board-info {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.board-info-slot {
  min-height: 1.35rem;
  display: grid;
  place-items: center;
  width: 100%;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgb(var(--color-gold-rgb) / 0.64);
  font-size: var(--font-size-board-meta);
  line-height: 1;
}

.info-value {
  font-weight: 700;
  color: var(--color-gold);
}

.info-road {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  width: var(--tile-gap);
  height: var(--road-thickness);
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
    justify-content: center;
    gap: 0.6rem;
  }

  .info-item {
    padding: 0.35rem 0.65rem;
    font-size: var(--font-size-board-meta);
  }
}
</style>
