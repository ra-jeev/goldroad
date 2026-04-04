<script setup lang="ts">
import type { EdgeType } from '../../shared/types/game'

defineProps<{
  type: 'open' | EdgeType
  traversed: boolean
  arrowDir: string | null
  style: Record<string, string>
}>()
</script>

<template>
  <span
    :class="['road', `road--${type}`, { 'road--traversed': traversed }]"
    :style="style"
  >
     <svg
      v-if="traversed && arrowDir"
      :class="['arrow', `arrow--${arrowDir}`]"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M18 8L22 12L18 16" />
      <path d="M2 12H22" />
    </svg>
  </span>
</template>

<style scoped>
.road {
  position: absolute;
  border-radius: var(--radius-full);
  pointer-events: none;
  z-index: 1;
  transition: background var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
}

.road--open {
  background: rgb(var(--color-gold-rgb) / 0.30);
}

.road--blocked {
  background: var(--color-blocked);
  opacity: 0.9;
}

.road--cost {
  background: var(--color-cost);
  opacity: 0.85;
}

.road--bonus {
  background: var(--color-bonus);
  opacity: 0.85;
}

.road--traversed {
  background: var(--color-gold) !important;
  opacity: 1 !important;
  box-shadow: var(--shadow-glow-road);
  z-index: 2;
}

/* ── SVG arrow ──────────────────────────────────────────────── */
.arrow {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  color: var(--color-text-dark);
}

.arrow--right { transform: rotate(0deg); }
.arrow--down  { transform: rotate(90deg); }
.arrow--left  { transform: rotate(180deg); }
.arrow--up    { transform: rotate(270deg); }
</style>
