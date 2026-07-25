<script setup lang="ts">
import type { EdgeType } from '../../shared/types/game';
import RoadGlyph from './RoadGlyph.vue';

type RoadVisualType = 'open' | Exclude<EdgeType, 'missing'>;

const props = defineProps<{
  type: RoadVisualType;
  state: 'default' | 'closed' | 'active' | 'traversed' | 'guide';
  traversed: boolean;
  arrowDir: string | null;
  orientation: 'h' | 'v';
  style: Record<string, string>;
}>();

</script>

<template>
  <span
    :class="[
      'road',
      `road--${type}`,
      {
        'road--active': state === 'active',
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

</style>
