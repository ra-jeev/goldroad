<script setup lang="ts">
import type { EdgeType } from '../../shared/types/game';

type RoadVisualType = 'open' | EdgeType;

withDefaults(
  defineProps<{
    type: RoadVisualType;
    state?: 'default' | 'closed' | 'active' | 'traversed';
    traversed?: boolean;
    arrowDir?: string | null;
    orientation?: 'h' | 'v';
  }>(),
  {
    state: 'default',
    traversed: false,
    arrowDir: null,
    orientation: 'h',
  },
);
</script>

<template>
  <span
    :class="[
      'road-glyph',
      `road-glyph--${type}`,
      `road-glyph--${state}`,
      { 'road-glyph--traversed': traversed },
    ]"
  >
    <svg
      v-if="type === 'toll'"
      :class="['road-icon', { 'road-icon--vertical': orientation === 'v' }]"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0"
      />
    </svg>

    <svg
      v-else-if="type === 'bonus'"
      :class="['road-icon', { 'road-icon--vertical': orientation === 'v' }]"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="2"
        d="M4 8h16M4 16h16"
      />
    </svg>

    <svg
      v-else-if="type === 'missing'"
      :class="['road-icon', { 'road-icon--vertical': orientation === 'v' }]"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        fill="none"
        stroke="currentColor"
        stroke-dasharray="2 4"
        stroke-linecap="round"
        stroke-width="2.4"
        d="M5 12h14"
      />
    </svg>

    <svg
      v-else
      :class="['road-icon', { 'road-icon--vertical': orientation === 'v' }]"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="3"
        d="M5 12h14"
      />
    </svg>

    <svg
      v-if="traversed && arrowDir"
      :class="['road-arrow', `road-arrow--${arrowDir}`]"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
    >
      <path
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="8"
        d="m12 30l12-14L12 2"
      />
    </svg>
  </span>
</template>

<style scoped>
.road-glyph {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--color-gold);
  opacity: 0.56;
}

.road-glyph--closed {
  opacity: 0.26;
}

.road-glyph--active {
  opacity: 1;
  filter: drop-shadow(0 0 4px rgb(var(--color-gold-rgb) / 0.55));
}

.road-glyph--toll {
  color: var(--color-toll);
}

.road-glyph--bonus {
  color: var(--color-bonus);
}

.road-glyph--missing {
  color: rgb(var(--color-gold-rgb) / 0.42);
  opacity: 0.7;
}

.road-glyph--traversed {
  opacity: 1;
  color: var(--color-gold-dark);
}

.road-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.road-icon--vertical {
  transform: rotate(90deg);
}

.road-arrow {
  position: absolute;
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  color: var(--color-gold-dark);
}

.road-arrow--right {
  right: -2px;
  transform: rotate(0deg);
}

.road-arrow--down {
  bottom: -2px;
  transform: rotate(90deg);
}

.road-arrow--left {
  left: -2px;
  transform: rotate(180deg);
}

.road-arrow--up {
  top: -2px;
  transform: rotate(270deg);
}
</style>
