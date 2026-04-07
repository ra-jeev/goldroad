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
    v-if="type !== 'blocked'"
    :class="['road', `road--${type}`, { 'road--traversed': traversed }]"
    :style="style"
  >
    <!-- Cost/Bonus indicators -->
    <svg
      v-if="!traversed && type === 'cost'"
      class="road-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="12" cy="12" r="10" fill="#cd7f32" />
      <text x="12" y="16" text-anchor="middle" font-size="14" font-weight="bold" fill="#2d1c02">-</text>
    </svg>
    
    <svg
      v-if="!traversed && type === 'bonus'"
      class="road-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="12" cy="12" r="10" fill="#ffd700" />
      <text x="12" y="16" text-anchor="middle" font-size="14" font-weight="bold" fill="#2d1c02">+</text>
    </svg>

    <!-- Traversal arrow -->
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
  pointer-events: none;
  z-index: 1;
  transition: background var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--color-gold-rgb) / 0.32);
}

.road--traversed {
  background: var(--color-gold-dark);
  box-shadow: var(--shadow-glow-road);
  z-index: 2;
}

/* ── Road icons ─────────────────────────────────────────────── */
.road-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

/* ── SVG arrow ──────────────────────────────────────────────── */
.arrow {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--color-text-dark);
}

.arrow--right { transform: rotate(0deg); }
.arrow--down  { transform: rotate(90deg); }
.arrow--left  { transform: rotate(180deg); }
.arrow--up    { transform: rotate(270deg); }
</style>
