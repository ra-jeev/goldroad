<script setup lang="ts">
import type { EdgeType } from '../../shared/types/game';

type RoadVisualType = 'open' | Exclude<EdgeType, 'missing'>;

defineProps<{
  type: RoadVisualType;
  state: 'default' | 'closed' | 'active' | 'traversed';
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
      `road--${state}`,
      { 'road--traversed': traversed },
    ]"
    :style="style"
  >
    <!-- Toll/Bonus indicators - always show, even when traversed -->
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

    <!-- Traversal arrow - show alongside toll/bonus icons -->
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
.road {
  position: absolute;
  pointer-events: none;
  transition:
    color var(--transition-base),
    opacity var(--transition-base),
    transform var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-gold);
  opacity: 0.56;
}

.road--closed {
  opacity: 0.26;
}

.road--active {
  opacity: 1;
  transform: scale(1.04);
  filter: drop-shadow(0 0 4px rgb(var(--color-gold-rgb) / 0.55));
}

.road--toll {
  color: var(--color-toll);
}

.road--bonus {
  color: var(--color-bonus);
}

.road--traversed {
  opacity: 1;
  color: var(--color-gold-dark);
}

/* ── Road icons ─────────────────────────────────────────────── */
.road-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.road-icon--vertical {
  transform: rotate(90deg);
}

/* ── SVG arrow (chevron) ──────────────────────────────────────── */
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
