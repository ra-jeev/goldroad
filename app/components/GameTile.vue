<script setup lang="ts">
defineProps<{
  value: number;
  isStart: boolean;
  isEnd: boolean;
  isCurrent: boolean;
  isActive: boolean;
  isDone: boolean;
  isHinted: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  select: [];
}>();
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

    <!-- Start/End markers positioned at top-right -->
    <svg
      v-if="isStart"
      xmlns="http://www.w3.org/2000/svg"
      class="marker"
      viewBox="0 0 32 32"
    >
      <g fill="currentColor">
        <path
          d="M10.496 2.01a1.25 1.25 0 0 1 1.099 1.384l-.072.625a1.25 1.25 0 1 1-2.484-.285l.072-.626a1.25 1.25 0 0 1 1.384-1.099m4.94 2.111a1.72 1.72 0 0 0-1.356-2.015a1.716 1.716 0 0 0-2.011 1.36l-.165.845a1.717 1.717 0 0 0 1.356 2.016c.93.18 1.83-.429 2.011-1.361z"
        />
        <path
          d="M13.66 8.92c0-3-2.46-3.42-5.5-3.42s-5.43.38-5.49 3.31v11.11a4.5 4.5 0 1 0 8.18-2.58a3.59 3.59 0 0 1 .81-4.16a5.49 5.49 0 0 0 2-4.26M8.67 3.43a1.13 1.13 0 0 0-2.26 0V4a1.13 1.13 0 1 0 2.26 0zm-3.798-.57a1.03 1.03 0 0 1 1.136.907l.06.517a1.03 1.03 0 0 1-.902 1.14a1.03 1.03 0 0 1-1.135-.907l-.06-.516a1.03 1.03 0 0 1 .901-1.14"
        />
        <path
          d="m2.67 4.092l-.009.002a.87.87 0 0 0-.64 1.051l.107.437a.87.87 0 0 0 1.051.64l.01-.003a.87.87 0 0 0 .64-1.05l-.107-.438a.87.87 0 0 0-1.051-.64m19.239 5.923a1.25 1.25 0 0 1-1.384-1.1l-.072-.625a1.25 1.25 0 1 1 2.484-.286l.071.626a1.25 1.25 0 0 1-1.099 1.385m-5.122-.146A1.72 1.72 0 0 0 18.8 11.23a1.72 1.72 0 0 0 1.355-2.015l-.164-.844a1.72 1.72 0 0 0-2.011-1.362a1.717 1.717 0 0 0-1.356 2.016z"
        />
        <path
          d="M18.39 13.82c0-3 2.47-3.42 5.5-3.42s5.44.38 5.5 3.31v11.12a4.5 4.5 0 1 1-9 0c0-.926.29-1.828.83-2.58a3.6 3.6 0 0 0-.81-4.16a5.5 5.5 0 0 1-2.02-4.27m5-4.91a1.13 1.13 0 1 0 2.26 0v-.57a1.13 1.13 0 0 0-2.26 0zm3.495 1.402a1.03 1.03 0 0 1-.901-1.14l.06-.517c.064-.565.573-.97 1.135-.906s.966.575.9 1.14l-.059.516a1.027 1.027 0 0 1-1.135.907m1.981.797l.01.002a.87.87 0 0 0 1.051-.64l.107-.437a.87.87 0 0 0-.64-1.05l-.01-.003a.87.87 0 0 0-1.05.64l-.107.437a.87.87 0 0 0 .64 1.05"
        />
      </g>
    </svg>

    <svg
      v-if="isEnd"
      xmlns="http://www.w3.org/2000/svg"
      class="marker"
      viewBox="0 0 512 512"
    >
      <path
        fill="currentColor"
        d="M105 37v114h30V37zm272 0v114h30V37zM16 48v20.94c20.9 6.4 43.8 13.28 43.8 13.28l-43.8.51V112h71V48zm137 0v64h206V88.53l-26.9-9.7l26.9-4.54V48zm272 0v64h71V48zM73 169v42.5l38.1 9.4l-38.1 8.2v68.5l44.3-3.2l-44.3 29v70c32.2 10 62.4 32.8 92.1 53.2c3.5 2.4 7 4.7 10.5 7l25-25l-9.5 34.9c22.6 13.7 44.5 23.5 64.9 23.5c28.2 0 59.1-18.6 90.9-40.4c29.7-20.4 59.9-43.2 92.1-53.2v-13.9l-66.8-17.1l66.8-12.6V169H306.7L256 202.8L205.3 169z"
      />
    </svg>
  </button>
</template>

<style scoped>
.tile {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-circle);
  border: var(--tile-border) solid rgb(var(--color-gold-rgb) / 0.72);
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.35));
  color: rgb(var(--color-gold-rgb) / 0.72);
  font-size: var(--font-size-2xl);
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
  line-height: 1;
  transition: all var(--transition-base);
  box-shadow:
    inset 3px 3px 6px rgba(255, 255, 255, 0.1),
    inset -3px -3px 6px rgba(0, 0, 0, 0.5),
    0 2px 4px rgba(0, 0, 0, 0.3);
}

/* ── States ─────────────────────────────────────────────────── */
.tile.active {
  cursor: pointer;
  color: var(--color-gold);
  border-color: var(--color-gold);
  /* Outer gold glow to make active tiles stand out */
  box-shadow:
    inset 3px 3px 6px rgba(255, 255, 255, 0.1),
    inset -3px -3px 6px rgba(0, 0, 0, 0.5),
    0 0 12px 4px rgba(var(--color-gold-rgb) / 0.6),
    0 2px 4px rgba(0, 0, 0, 0.3);
}

.tile.active:hover:not(:disabled) {
  transform: scale(1.05);
  /* Stronger outer glow on hover */
  box-shadow:
    inset 3px 3px 6px rgba(255, 255, 255, 0.1),
    inset -3px -3px 6px rgba(0, 0, 0, 0.5),
    0 0 20px 4px rgba(var(--color-gold-rgb) / 0.8),
    0 2px 6px rgba(0, 0, 0, 0.4);
}

.tile.active:active:not(:disabled) {
  transform: scale(0.95);
}

.tile.done {
  border-color: var(--color-gold-dark);
  background: var(--gradient-tile-done);
  color: var(--color-text-dark);
  box-shadow:
    inset 2px 2px 4px rgba(255, 255, 255, 0.3),
    inset -2px -2px 4px rgba(0, 0, 0, 0.2),
    var(--shadow-glow-gold);
}

.tile.done .value {
  /* Enhanced embossed effect for done tiles */
  text-shadow:
    1px 1px 2px rgba(0, 0, 0, 0.5),
    -1px -1px 1px rgba(255, 255, 255, 0.6),
    0 1px 0 rgb(255 230 100 / 40%);
}

.tile.hinted {
  border-color: var(--color-hint);
  box-shadow: var(--shadow-glow-hint);
}

.tile:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3px var(--color-focus),
    var(--shadow-glow-focus);
}

/* ── Value ──────────────────────────────────────────────────── */
.value {
  /* Embossed/raised effect - light from top-left */
  text-shadow:
    -1px -1px 0px rgba(255, 255, 255, 0.4),
    /* highlight top-left */ 1px 1px 3px rgba(0, 0, 0, 0.8),
    /* shadow bottom-right */ 0 0 8px rgba(212, 175, 55, 0.3); /* subtle gold glow */
}

/* ── Start / End markers ────────────────────────────────────── */
.marker {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  z-index: 3;
  background-color: var(--color-text-dark);
  border-radius: var(--radius-circle);
  padding: 3px;
  border: 1px solid var(--color-gold);
  color: var(--color-gold);
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
</style>
