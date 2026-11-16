<script setup lang="ts">
import { computed } from 'vue';
import type { EdgeType } from '#shared/types/game';

type RoadVisualType = 'open' | EdgeType;

const props = withDefaults(
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

const hasDoubleRails = computed(
  () => props.type === 'toll' || props.type === 'bonus',
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
    <!-- The rails extend beyond the viewBox to leave clearance for the centered marker. -->
    <svg
      v-if="hasDoubleRails"
      class="road-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        :class="{ 'toll-rail': type === 'toll' }"
        fill="none"
        stroke="currentColor"
        :stroke-linecap="type === 'toll' ? 'butt' : 'round'"
        stroke-width="3.2"
        vector-effect="non-scaling-stroke"
        :d="orientation === 'h' ? 'M0 -1.4H24M0 25.4H24' : 'M-1.4 0V24M25.4 0V24'"
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
      :class="['road-arrow', `road-arrow--${arrowDir}`, { 'road-arrow--triangle': hasDoubleRails }]"
      xmlns="http://www.w3.org/2000/svg"
      :viewBox="hasDoubleRails ? '0 0 6.235 7.2' : '0 0 32 32'"
      aria-hidden="true"
    >
      <path v-if="hasDoubleRails" fill="currentColor" d="M0 0L6.235 3.6L0 7.2Z" />
      <path
        v-else
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
  --rail-clip-inset: 0px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--road-type-color, var(--color-gold));
  opacity: 0.78;
}

.road-glyph--toll {
  --road-type-color: var(--color-toll-bright);
}

.road-glyph--bonus {
  --road-type-color: var(--color-bonus);
}

.road-glyph--toll,
.road-glyph--bonus {
  /* The wider rails extend beyond the road band. Leave room for them
     and their shadow while the travelled path draws itself. */
  --rail-clip-inset: -5px;
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
  color: var(--road-type-color, var(--color-gold-dark));
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
    clip-path: inset(var(--rail-clip-inset) 100% var(--rail-clip-inset) 0);
  }

  to {
    clip-path: inset(var(--rail-clip-inset) 0 var(--rail-clip-inset) 0);
  }
}

@keyframes road-draw-left {
  from {
    clip-path: inset(var(--rail-clip-inset) 0 var(--rail-clip-inset) 100%);
  }

  to {
    clip-path: inset(var(--rail-clip-inset) 0 var(--rail-clip-inset) 0);
  }
}

@keyframes road-draw-down {
  from {
    clip-path: inset(0 var(--rail-clip-inset) 100% var(--rail-clip-inset));
  }

  to {
    clip-path: inset(0 var(--rail-clip-inset) 0 var(--rail-clip-inset));
  }
}

@keyframes road-draw-up {
  from {
    clip-path: inset(100% var(--rail-clip-inset) 0 var(--rail-clip-inset));
  }

  to {
    clip-path: inset(0 var(--rail-clip-inset) 0 var(--rail-clip-inset));
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
  color: var(--road-type-color, var(--color-gold-dark));
  transform: rotate(var(--arrow-angle, 0deg));
}

.road-arrow--right {
  right: -2px;
}

.road-arrow--down {
  --arrow-angle: 90deg;
  bottom: -2px;
}

.road-arrow--left {
  --arrow-angle: 180deg;
  left: -2px;
}

.road-arrow--up {
  --arrow-angle: 270deg;
  top: -2px;
}

.road-arrow--triangle {
  inset: 50% auto auto 50%;
  width: 6.235px;
  height: 7.2px;
  transform: translate(-50%, -50%) rotate(var(--arrow-angle, 0deg));
}
</style>
