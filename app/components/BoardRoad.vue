<script setup lang="ts">
import type { EdgeType } from '../../shared/types/game';
import RoadGlyph from './RoadGlyph.vue';

type RoadVisualType = 'open' | Exclude<EdgeType, 'missing'>;

const props = defineProps<{
  type: RoadVisualType;
  state: 'default' | 'closed' | 'active' | 'traversed';
  traversed: boolean;
  arrowDir: string | null;
  orientation: 'h' | 'v';
  style: Record<string, string>;
}>();

const isScoring = props.type === 'toll' || props.type === 'bonus';
</script>

<template>
  <span
    :class="[
      'road',
      `road--${type}`,
      {
        'road--active': state === 'active',
        'road--scoring': isScoring,
        'road--closed': state === 'closed',
      },
    ]"
    :style="style"
  >
    <RoadGlyph
      :type="type"
      :state="state"
      :traversed="traversed"
      :arrow-dir="arrowDir"
      :orientation="orientation"
    />
  </span>
</template>

<style scoped>
.road {
  position: absolute;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--transition-fast);
}

.road--active {
  transform: scale(1.04);
}

/* Extra visual mass: a soft tinted rail behind scoring roads. */
.road--scoring::before {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: var(--radius-full);
  z-index: -1;
}

.road--toll::before {
  background: rgb(var(--color-toll-rgb) / 0.16);
}

.road--bonus::before {
  background: rgb(var(--color-bonus-rgb) / 0.16);
}

.road--closed::before {
  opacity: 0.5;
}
</style>
