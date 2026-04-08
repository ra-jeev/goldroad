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
    v-if="type !== 'blocked'"
    :class="['road', `road--${type}`, { 'road--traversed': traversed }]"
    :style="style"
  >
    <!-- Cost/Bonus indicators -->
    <svg
      v-if="!traversed && type === 'cost'"
      :class="[
        'road-icon',
        'road-cost',
        { 'road--vertical': orientation === 'v' },
      ]"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="3"
        d="M4 7.927C6.667 4.928 9.333 5.806 12 8s5.333 3.072 8 .073M4 15.927c2.667-2.999 5.333-2.121 8 .073s5.333 3.072 8 .073"
      />
    </svg>

    <svg
      v-if="!traversed && type === 'bonus'"
      :class="[
        'road-icon',
        'road-bonus',
        { 'road--vertical': orientation === 'v' },
      ]"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="3"
        d="M4 8h16M4 16h16"
      />
    </svg>

    <!-- Traversal arrow -->
    <svg
      v-if="traversed && arrowDir"
      :class="['arrow', `arrow--${arrowDir}`]"
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
  transition: background var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--color-gold-rgb) / 0.28);
}

.road--traversed {
  background: var(--color-gold-dark);
}

/* ── Road icons ─────────────────────────────────────────────── */
.road-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.road-cost {
  color: #cd7f32;
}

.road-bonus {
  color: var(--color-gold);
}

.road--vertical {
  transform: rotate(90deg);
}

/* ── SVG arrow ──────────────────────────────────────────────── */
.arrow {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--color-gold-dark);
}

.arrow--right {
  transform: rotate(0deg) translateX(4px);
}
.arrow--down {
  transform: translateY(4px) rotate(90deg);
}
.arrow--left {
  transform: rotate(180deg) translateX(4px);
}
.arrow--up {
  transform: translateY(-4px) rotate(270deg);
}
</style>
