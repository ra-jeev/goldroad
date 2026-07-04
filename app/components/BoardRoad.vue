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
  costValue: number | null;
  style: Record<string, string>;
}>();

const isScoring = props.type === 'toll' || props.type === 'bonus';
const chipSign = props.type === 'bonus' ? '+' : '−';
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

    <span
      v-if="isScoring && costValue != null"
      :class="['road-chip', `road-chip--${type}`, { 'road-chip--pop': traversed }]"
      aria-hidden="true"
    >
      <span class="road-chip__sign">{{ chipSign }}</span>
      <span class="road-chip__value">{{ costValue }}</span>
    </span>
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
  opacity: 0.35;
}

/* Cost chip at the road midpoint. Color + sign + shape carry the signal. */
.road-chip {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  gap: 0.05em;
  padding: 1px 5px 1px 4px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.02em;
  white-space: nowrap;
  border: 1px solid;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.45);
  z-index: 2;
}

.road-chip__sign {
  font-size: 11px;
}

.road-chip--toll {
  color: var(--color-toll-bright);
  background: rgb(40 18 4 / 0.92);
  border-color: rgb(var(--color-toll-rgb) / 0.7);
}

.road-chip--bonus {
  color: var(--color-bonus-bright);
  background: rgb(38 28 2 / 0.92);
  border-color: rgb(var(--color-bonus-rgb) / 0.7);
}

.road--closed .road-chip {
  opacity: 0.5;
}

.road-chip--pop {
  animation: chip-pop 620ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
</style>
