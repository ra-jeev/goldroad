<script setup lang="ts">
defineProps<{
  value: number
  isStart: boolean
  isEnd: boolean
  isCurrent: boolean
  isActive: boolean
  isDone: boolean
  isHinted: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  select: []
}>()
</script>

<template>
  <button
    :class="{
      tile: true,
      current: isCurrent,
      active: isActive,
      done: isDone,
      start: isStart,
      end: isEnd,
      hinted: isHinted,
    }"
    :disabled="disabled"
    @click="emit('select')"
  >
    <span class="value">{{ value }}</span>
    <span v-if="isStart" class="marker marker-start" />
    <span v-if="isEnd" class="marker marker-end" />
  </button>
</template>

<style scoped>
.tile {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-circle);
  border: var(--tile-border) solid rgb(var(--color-gold-rgb));
  /* Subtle background so emboss is visible */
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.35));
  color: var(--color-gold);
  font-size: var(--font-size-2xl);
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
  /* Raised coin effect - light from top-left */
  box-shadow: 
    /* Inner highlight (top-left) */
    inset 3px 3px 6px rgba(255, 255, 255, 0.1),
    /* Inner shadow (bottom-right) */
    inset -3px -3px 6px rgba(0, 0, 0, 0.5),
    /* Outer shadow for depth */
    0 2px 4px rgba(0, 0, 0, 0.3);
}

/* ── States ─────────────────────────────────────────────────── */
.tile.active {
  cursor: pointer;
}

.tile.active::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-circle);
  background: var(--gradient-radial-active);
  pointer-events: none;
}

.tile.active:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: var(--shadow-glow-active);
}

.tile.active:active:not(:disabled) {
  transform: scale(0.95);
}

.tile.done {
  border-color: var(--color-gold-dark);
  background: var(--gradient-tile-done);
  box-shadow: 
    inset 2px 2px 4px rgba(255, 255, 255, 0.3),
    inset -2px -2px 4px rgba(0, 0, 0, 0.2),
    var(--shadow-glow-gold);
}

.tile.done .value {
  color: var(--color-text-dark);
  /* Enhanced embossed effect for done tiles */
  text-shadow: 
    1px 1px 2px rgba(0, 0, 0, 0.5),
    -1px -1px 1px rgba(255, 255, 255, 0.6),
    0 1px 0 rgb(255 230 100 / 40%);
}

/* .tile.start {
  border-color: rgb(var(--color-active-rgb) / 0.55);
}

.tile.start.done {
  border-color: rgb(var(--color-active-rgb) / 0.70);
} */

/* .tile.end {
  border-color: rgb(180 60 20 / 0.60);
  box-shadow: var(--shadow-glow-end-subtle);
}

.tile.end.done {
  border-color: rgb(212 175 55);
} */

.tile.hinted {
  border-color: var(--color-hint);
  box-shadow: var(--shadow-glow-hint);
}

.tile:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-focus), var(--shadow-glow-focus);
}

/* ── Value ──────────────────────────────────────────────────── */
.value {
  position: relative;
  z-index: 2;
  color: var(--color-gold);
  /* Embossed/raised effect - light from top-left */
  text-shadow: 
    -1px -1px 0px rgba(255, 255, 255, 0.4),  /* highlight top-left */
    1px 1px 3px rgba(0, 0, 0, 0.8),          /* shadow bottom-right */
    0 0 8px rgba(212, 175, 55, 0.3);         /* subtle gold glow */
}

/* ── Start / End dot markers ────────────────────────────────── */
.marker {
  position: absolute;
  z-index: 4;
  width: 10px;
  height: 10px;
  border-radius: var(--radius-circle);
  pointer-events: none;
}

.marker-start {
  top: -3px;
  right: -3px;
  background: var(--color-start);
  border: 1.5px solid var(--color-start-light);
  box-shadow: var(--shadow-glow-start);
}

.marker-end {
  bottom: -3px;
  right: -3px;
  background: var(--color-end);
  border: 1.5px solid var(--color-end-light);
  box-shadow: var(--shadow-glow-end);
}

button:disabled {
  cursor: default;
}

@media (prefers-reduced-motion: reduce) {
  .tile {
    transition: none;
  }

  .tile.active:hover:not(:disabled) {
    transform: none;
  }
}

/* @media (max-width: 760px) {
  .tile {
    font-size: var(--font-size-lg);
  }
} */
</style>
