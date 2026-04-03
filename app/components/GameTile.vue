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
  border-radius: 50%;
  border: 3px solid rgb(218 165 32 / 40%);
  background: transparent;
  color: goldenrod;
  font-size: 1.15rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease-in-out;
}

/* ── States ─────────────────────────────────────────────────── */
.tile.active {
  border-color: rgb(68 221 25 / 50%);
  cursor: pointer;
}

.tile.active::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(68 221 25 / 14%) 0%, transparent 72%);
  pointer-events: none;
}

.tile.active:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 0 14px rgb(68 221 25 / 30%);
}

.tile.active:active:not(:disabled) {
  transform: scale(0.95);
}

.tile.done {
  border-color: darkgoldenrod;
  background: linear-gradient(135deg, rgb(212 175 55), rgb(184 142 30));
  box-shadow: 0 0 12px 4px rgb(218 165 32 / 54%);
}

.tile.done .value {
  color: #2d1c02;
  text-shadow: 0 1px 0 rgb(255 230 100 / 40%);
}

.tile.current {
  box-shadow:
    0 0 0 3px goldenrod,
    0 0 18px rgb(218 165 32 / 55%);
}

.tile.start {
  border-color: rgb(68 221 25 / 55%);
}

.tile.start.done {
  border-color: rgb(68 221 25 / 70%);
}

.tile.end {
  border-color: rgb(180 60 20 / 60%);
  box-shadow: 0 0 10px rgb(180 60 20 / 20%);
}

.tile.end.done {
  border-color: rgb(212 175 55);
}

.tile.hinted {
  border-color: #d6336c;
  box-shadow: 0 0 14px rgb(214 51 108 / 45%);
}

.tile:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px #4b9eff, 0 0 12px rgb(75 158 255 / 35%);
}

/* ── Value ──────────────────────────────────────────────────── */
.value {
  position: relative;
  z-index: 2;
  color: goldenrod;
}

/* ── Start / End dot markers ────────────────────────────────── */
.marker {
  position: absolute;
  z-index: 4;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  pointer-events: none;
}

.marker-start {
  top: -3px;
  right: -3px;
  background: #22c55e;
  border: 1.5px solid #a7f3d0;
  box-shadow: 0 0 6px rgb(34 197 94 / 60%);
}

.marker-end {
  bottom: -3px;
  right: -3px;
  background: #dc2626;
  border: 1.5px solid #fca5a5;
  box-shadow: 0 0 6px rgb(220 38 38 / 50%);
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
    font-size: 1rem;
  }
}
</style>
