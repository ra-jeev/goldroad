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
  border: var(--tile-border) solid rgb(var(--color-gold-rgb) / 0.50);
  background: transparent;
  color: var(--color-gold);
  font-size: var(--font-size-xl);
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
}

/* ── States ─────────────────────────────────────────────────── */
.tile.active {
  border-color: rgb(var(--color-active-rgb) / 0.50);
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
  box-shadow: var(--shadow-glow-gold);
}

.tile.done .value {
  color: var(--color-text-dark);
  text-shadow: 0 1px 0 rgb(255 230 100 / 40%);
}

.tile.current {
  box-shadow:
    0 0 0 3px var(--color-gold),
    0 0 18px rgb(var(--color-gold-rgb) / 0.55);
}

.tile.start {
  border-color: rgb(var(--color-active-rgb) / 0.55);
}

.tile.start.done {
  border-color: rgb(var(--color-active-rgb) / 0.70);
}

.tile.end {
  border-color: rgb(180 60 20 / 0.60);
  box-shadow: var(--shadow-glow-end-subtle);
}

.tile.end.done {
  border-color: rgb(212 175 55);
}

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

@media (max-width: 760px) {
  .tile {
    font-size: var(--font-size-lg);
  }
}
</style>
