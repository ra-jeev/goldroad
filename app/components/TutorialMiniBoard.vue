<script setup lang="ts">
import { computed } from 'vue';
import type { EdgeType } from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';
import BoardRoad from './BoardRoad.vue';
import GameTile from './GameTile.vue';

type RoadVisualType = 'open' | Exclude<EdgeType, 'missing'>;

const props = defineProps<{
  fromValue: number;
  toValue: number;
  middleValue?: number;
  edgeType: EdgeType | 'open';
  isStart?: boolean;
  isEnd?: boolean;
  isHinted?: boolean;
  showHintButton?: boolean;
}>();

const values = computed(() =>
  props.middleValue === undefined
    ? [props.fromValue, props.toValue]
    : [props.fromValue, props.middleValue, props.toValue],
);

const visibleEdgeType = computed<RoadVisualType | null>(() =>
  props.edgeType === 'missing' ? null : props.edgeType,
);

const BOARD_CELL = '(var(--tile-size) + var(--tile-gap))';
const ROAD_OFFSET = '((var(--tile-size) - var(--road-thickness)) / 2)';

function roadStyle(index: number): Record<string, string> {
  return {
    left: `calc(${index} * ${BOARD_CELL} + var(--tile-size))`,
    top: `calc(${ROAD_OFFSET})`,
    width: 'var(--tile-gap)',
    height: 'var(--road-thickness)',
  };
}
</script>

<template>
  <div v-if="showHintButton" class="mini-hint" aria-hidden="true">
    <span class="mini-hint__button">
      <svg viewBox="0 0 24 24">
        <path
          d="M9 18h6m-5-3.5h4m-7.5-4.7a5.5 5.5 0 1 1 9.2 4.05c-.77.68-1.2 1.28-1.34 2.15H9.64c-.14-.87-.57-1.47-1.34-2.15A5.48 5.48 0 0 1 6.5 9.8Z"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="3"
        />
      </svg>
      {{ UI_COPY.boardFooter.openHint }}
    </span>
  </div>

  <div v-else class="mini-board" aria-hidden="true">
    <div
      class="mini-board__tiles"
      :style="{
        gridTemplateColumns: `repeat(${values.length}, var(--tile-size))`,
      }"
    >
      <GameTile
        v-for="(value, index) in values"
        :key="`${index}-${value}`"
        :value="value"
        :is-start="Boolean(isStart) && index === 0"
        :is-end="Boolean(isEnd) && index === values.length - 1"
        :is-current="false"
        :is-active="false"
        :is-done="false"
        :is-hinted="Boolean(isHinted) && index === values.length - 1"
        :tab-index="-1"
        disabled
      />
    </div>

    <BoardRoad
      v-for="index in visibleEdgeType ? values.length - 1 : 0"
      :key="index"
      :type="visibleEdgeType ?? 'open'"
      state="default"
      :traversed="false"
      :arrow-dir="null"
      orientation="h"
      :style="roadStyle(index - 1)"
    />
  </div>
</template>

<style scoped>
.mini-board {
  position: relative;
  width: max-content;
}

.mini-board__tiles {
  display: grid;
  gap: var(--tile-gap);
}

.mini-hint {
  display: grid;
  place-items: end;
  min-width: 11.5rem;
}

.mini-hint__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  width: auto;
  min-width: 2.35rem;
  height: 2.35rem;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.28);
  border-radius: var(--radius-full);
  padding: 0 0.85rem;
  background: rgb(var(--color-gold-rgb) / 0.08);
  color: var(--color-gold);
  font: inherit;
  font-weight: 800;
  line-height: 1;
}

.mini-hint svg {
  width: 1.12rem;
  height: 1.12rem;
}
</style>
