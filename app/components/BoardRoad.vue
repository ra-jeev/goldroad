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
    <span v-if="traversed && arrowDir" :class="['arrow', `arrow--${arrowDir}`]" />
  </span>
</template>

<style scoped>
.road {
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  z-index: 1;
  transition: background 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Open roads: visible but muted */
.road--open {
  background: rgb(218 165 32 / 30%);
}

/* Special roads */
.road--blocked {
  background: #fc2f00;
  opacity: 0.9;
}

.road--cost {
  background: #f59e0b;
  opacity: 0.85;
}

.road--bonus {
  background: #22c55e;
  opacity: 0.85;
}

/* Traversed roads: bright golden */
.road--traversed {
  background: goldenrod !important;
  opacity: 1 !important;
  box-shadow: 0 0 8px rgb(218 165 32 / 55%);
  z-index: 2;
}

/* ── Arrow triangles ────────────────────────────────────────── */
.arrow {
  width: 0;
  height: 0;
  flex-shrink: 0;
}

.arrow--right {
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-left: 7px solid #1a0e03;
}

.arrow--left {
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-right: 7px solid #1a0e03;
}

.arrow--down {
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 7px solid #1a0e03;
}

.arrow--up {
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 7px solid #1a0e03;
}
</style>
