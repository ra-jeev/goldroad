<script setup lang="ts">
import { computed } from 'vue';
import type { EdgeType } from '#shared/types/game';
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
  showUndoButton?: boolean;
  showKeyboardKeys?: boolean;
  showRetryButton?: boolean;
  showHintButton?: boolean;
  /** Show the real pre-run state: start occupied, its neighbor glowing. */
  showStartState?: boolean;
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
  <!-- Lessons about the footer controls show the controls themselves, drawn
       exactly as the board footer renders them at rest: retry as an icon,
       Hint labelled. -->
  <!-- Key caps are drawn, never typed: the shipped font subsets are latin
       only, so an arrow or backspace character would render as tofu. -->
  <div v-if="showKeyboardKeys" class="mini-actions" aria-hidden="true">
    <span class="mini-actions__button mini-actions__button--icon">
      <svg viewBox="0 0 24 24">
        <path
          d="M12 4v16M4 12h16M12 4 9.5 6.5M12 4l2.5 2.5M12 20l-2.5-2.5M12 20l2.5-2.5M4 12l2.5-2.5M4 12l2.5 2.5M20 12l-2.5-2.5M20 12l-2.5 2.5"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2.2"
        />
      </svg>
    </span>

    <span class="mini-actions__button mini-actions__button--icon">
      <svg viewBox="0 0 24 24">
        <path
          d="M4.5 5.5v13M20 12H9m0 0 4.5-4.5M9 12l4.5 4.5"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="3"
        />
      </svg>
    </span>
  </div>

  <div
    v-else-if="showUndoButton || showRetryButton || showHintButton"
    class="mini-actions"
    aria-hidden="true"
  >
    <span
      v-if="showUndoButton"
      class="mini-actions__button mini-actions__button--icon"
    >
      <svg viewBox="0 0 24 24">
        <path
          d="M4.5 5.5v13M20 12H9m0 0 4.5-4.5M9 12l4.5 4.5"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="3"
        />
      </svg>
    </span>

    <span
      v-if="showRetryButton"
      class="mini-actions__button mini-actions__button--icon"
    >
      <svg viewBox="0 0 24 24">
        <path
          d="M4.5 11.2a7.5 7.5 0 1 1 2.2 5.3M4.5 11.2V6.5m0 4.7h4.7"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="3"
        />
      </svg>
    </span>

    <span v-if="showHintButton" class="mini-actions__button">
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
        :is-current="Boolean(showStartState) && index === 0"
        :is-active="Boolean(showStartState) && index === 1"
        :is-done="Boolean(showStartState) && index === 0"
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

.mini-actions {
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 0.6rem;
  min-width: 11.5rem;
}

.mini-actions__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  width: auto;
  min-width: var(--control-size);
  height: var(--control-size);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.28);
  border-radius: var(--radius-full);
  padding: 0 0.85rem;
  background: rgb(var(--color-gold-rgb) / 0.08);
  color: var(--color-gold);
  font: inherit;
  font-weight: 800;
  line-height: 1;
}

.mini-actions__button--icon {
  width: var(--control-size);
  padding: 0;
  border-radius: var(--radius-circle);
}

.mini-actions svg {
  width: var(--icon-size);
  height: var(--icon-size);
  flex: 0 0 auto;
}

@media (max-width: 760px) {
  .mini-actions {
    min-width: 0;
    justify-content: start;
  }
}
</style>
