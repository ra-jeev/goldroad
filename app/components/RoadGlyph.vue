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
      class="road-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="2.2"
        stroke-dasharray="0.8 4"
        vector-effect="non-scaling-stroke"
        :d="orientation === 'h' ? 'M0 8H24M0 16H24' : 'M8 0V24M16 0V24'"
      />
    </svg>

    <svg
      v-else-if="type === 'bonus'"
      class="road-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="2.2"
        vector-effect="non-scaling-stroke"
        :d="orientation === 'h' ? 'M0 8H24M0 16H24' : 'M8 0V24M16 0V24'"
      />
    </svg>

    <svg
      v-else-if="type !== 'missing'"
      class="road-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="2.8"
        vector-effect="non-scaling-stroke"
        :d="orientation === 'h' ? 'M0 12H24' : 'M12 0V24'"
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
  opacity: 0.78;
}

.road-glyph--closed {
  opacity: 0.26;
}

.road-glyph--active {
  opacity: 1;
  filter: drop-shadow(0 0 4px rgb(var(--color-gold-rgb) / 0.55));
}

/* Scoring roads carry more visual mass than plain open roads. */
.road-glyph--toll {
  color: var(--color-toll);
  opacity: 0.94;
}

.road-glyph--bonus {
  color: var(--color-bonus);
  opacity: 0.94;
}

.road-glyph--toll.road-glyph--closed,
.road-glyph--bonus.road-glyph--closed {
  opacity: 0.42;
}

.road-glyph--missing {
  opacity: 0;
}

.road-glyph--traversed {
  opacity: 1;
  color: var(--color-gold-dark);
}

.road-icon {
  width: 100%;
  height: 100%;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  overflow: visible;
}

.road-glyph--toll .road-icon,
.road-glyph--bonus .road-icon {
  filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.4));
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
