<script setup lang="ts">
import type { EdgeType } from '../../shared/types/game';

defineProps<{
  type: 'open' | EdgeType;
  traversed: boolean;
  arrowDir: string | null;
  orientation: 'h' | 'v';
  style: Record<string, string>;
}>();
</script>

<template>
  <span
    :class="['road', `road--${type}`, { 'road--traversed': traversed }]"
    :style="style"
  >
    <!-- Cost/Bonus indicators - always show, even when traversed -->
    <svg
      v-if="type === 'cost'"
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
      v-else-if="type !== 'blocked'"
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

    <!-- Traversal arrow - show alongside cost/bonus icons -->
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
  transition: color var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--color-gold-rgb) / 0.48);
}

.road--cost {
  color: #cd7f32;
}

.road--bonus {
  color: #ffd700;
}

.road--traversed {
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
