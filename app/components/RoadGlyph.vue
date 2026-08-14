<script setup lang="ts">
import type { EdgeType } from '#shared/types/game';

/*
 * Toll and bonus roads are drawn as two parallel rails inside the road's
 * `--road-thickness` band. The rails sit at 4/24 and 20/24 of the band rather
 * than 6/18: with a non-scaling 3.2px stroke, the old positions left barely
 * 2px of dark space between the rails on a phone, so the pair merged into one
 * thick line and the toll/bonus distinction disappeared.
 */
type RoadVisualType = 'open' | EdgeType;

withDefaults(
  defineProps<{
    type: RoadVisualType;
    state?: 'default' | 'closed' | 'active' | 'traversed' | 'guide';
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
      arrowDir ? `road-glyph--to-${arrowDir}` : null,
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
        class="toll-rail"
        fill="none"
        stroke="currentColor"
        stroke-linecap="butt"
        stroke-width="3.2"
        vector-effect="non-scaling-stroke"
        :d="orientation === 'h' ? 'M0 4H24M0 20H24' : 'M4 0V24M20 0V24'"
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
        stroke-width="3.2"
        vector-effect="non-scaling-stroke"
        :d="orientation === 'h' ? 'M0 4H24M0 20H24' : 'M4 0V24M20 0V24'"
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
        stroke-width="3.2"
        vector-effect="non-scaling-stroke"
        :d="orientation === 'h' ? 'M0 12H24' : 'M12 0V24'"
      />
    </svg>

    <svg
      v-if="arrowDir"
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

.road-glyph--missing {
  opacity: 0;
}

.road-glyph--traversed {
  opacity: 1;
  color: var(--color-gold-dark);
  /* The road the game is named after used to materialise. It now draws itself
     in the direction of travel, and because the clip covers the whole glyph
     the arrow arrives with the stroke that carries it. */
  animation: road-draw 170ms ease-out;
}

.road-glyph--traversed.road-glyph--to-right {
  animation-name: road-draw-right;
}

.road-glyph--traversed.road-glyph--to-left {
  animation-name: road-draw-left;
}

.road-glyph--traversed.road-glyph--to-down {
  animation-name: road-draw-down;
}

.road-glyph--traversed.road-glyph--to-up {
  animation-name: road-draw-up;
}

@keyframes road-draw {
  from {
    opacity: 0;
  }
}

@keyframes road-draw-right {
  from {
    clip-path: inset(0 100% 0 0);
  }
}

@keyframes road-draw-left {
  from {
    clip-path: inset(0 0 0 100%);
  }
}

@keyframes road-draw-down {
  from {
    clip-path: inset(0 0 100% 0);
  }
}

@keyframes road-draw-up {
  from {
    clip-path: inset(100% 0 0 0);
  }
}

/* The stretch of the hint route the player has yet to walk. */
.road-glyph--guide {
  opacity: 1;
  color: var(--color-hint);
}

.road-glyph--guide .road-arrow {
  color: var(--color-hint);
}

.road-icon {
  width: 100%;
  height: 100%;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  overflow: visible;
}

/*
 * Under non-scaling-stroke the dash pattern is measured in device pixels, not
 * viewBox units, so it does not scale with the road. Deriving it from
 * --tile-gap (the road's length) keeps the rail reading as dash / space / dash
 * in equal thirds however long the road is. Butt caps keep nominal and drawn
 * lengths identical; round ones added half a stroke width to each end, which
 * is what made the two dashes come out unequal with a pinched gap.
 */
.toll-rail {
  stroke-dasharray: calc(var(--tile-gap) / 3) calc(var(--tile-gap) / 3);
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
