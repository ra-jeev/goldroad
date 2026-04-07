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
    <svg v-if="isStart" xmlns="http://www.w3.org/2000/svg" class="marker marker-start" viewBox="0 0 32 32"><g fill="currentColor"><path d="M10.496 2.01a1.25 1.25 0 0 1 1.099 1.384l-.072.625a1.25 1.25 0 1 1-2.484-.285l.072-.626a1.25 1.25 0 0 1 1.384-1.099m4.94 2.111a1.72 1.72 0 0 0-1.356-2.015a1.716 1.716 0 0 0-2.011 1.36l-.165.845a1.717 1.717 0 0 0 1.356 2.016c.93.18 1.83-.429 2.011-1.361z"/><path d="M13.66 8.92c0-3-2.46-3.42-5.5-3.42s-5.43.38-5.49 3.31v11.11a4.5 4.5 0 1 0 8.18-2.58a3.59 3.59 0 0 1 .81-4.16a5.49 5.49 0 0 0 2-4.26M8.67 3.43a1.13 1.13 0 0 0-2.26 0V4a1.13 1.13 0 1 0 2.26 0zm-3.798-.57a1.03 1.03 0 0 1 1.136.907l.06.517a1.03 1.03 0 0 1-.902 1.14a1.03 1.03 0 0 1-1.135-.907l-.06-.516a1.03 1.03 0 0 1 .901-1.14"/><path d="m2.67 4.092l-.009.002a.87.87 0 0 0-.64 1.051l.107.437a.87.87 0 0 0 1.051.64l.01-.003a.87.87 0 0 0 .64-1.05l-.107-.438a.87.87 0 0 0-1.051-.64m19.239 5.923a1.25 1.25 0 0 1-1.384-1.1l-.072-.625a1.25 1.25 0 1 1 2.484-.286l.071.626a1.25 1.25 0 0 1-1.099 1.385m-5.122-.146A1.72 1.72 0 0 0 18.8 11.23a1.72 1.72 0 0 0 1.355-2.015l-.164-.844a1.72 1.72 0 0 0-2.011-1.362a1.717 1.717 0 0 0-1.356 2.016z"/><path d="M18.39 13.82c0-3 2.47-3.42 5.5-3.42s5.44.38 5.5 3.31v11.12a4.5 4.5 0 1 1-9 0c0-.926.29-1.828.83-2.58a3.6 3.6 0 0 0-.81-4.16a5.5 5.5 0 0 1-2.02-4.27m5-4.91a1.13 1.13 0 1 0 2.26 0v-.57a1.13 1.13 0 0 0-2.26 0zm3.495 1.402a1.03 1.03 0 0 1-.901-1.14l.06-.517c.064-.565.573-.97 1.135-.906s.966.575.9 1.14l-.059.516a1.027 1.027 0 0 1-1.135.907m1.981.797l.01.002a.87.87 0 0 0 1.051-.64l.107-.437a.87.87 0 0 0-.64-1.05l-.01-.003a.87.87 0 0 0-1.05.64l-.107.437a.87.87 0 0 0 .64 1.05"/></g></svg>
    <!-- <svg v-if="isStart" xmlns="http://www.w3.org/2000/svg" class="marker" viewBox="0 0 64 64"><path fill="currentColor" d="M27.038 27.228c-4.433 7.974 7.948 13.905.962 16.892c-6.985 2.988-10.346-3.63-13.854-12.064c-3.51-8.434-.691-17.694 6.295-20.68c6.985-2.989 12.461 5.296 6.597 15.852M23.954 5.441c.015-2.33 1.574-3.457 3.486-3.441c1.911.014 3.453 1.162 3.436 3.492c-.023 3.334-1.584 4.961-3.495 4.948s-3.452-1.664-3.427-4.999m-5.818 1.132c-.244-1.659.739-2.633 2.1-2.838c1.359-.207 2.581.436 2.824 2.094c.348 2.372-.582 3.704-1.942 3.909s-2.634-.794-2.982-3.165M13.859 9.45c-.393-1.414.358-2.373 1.52-2.703s2.293.092 2.686 1.508c.561 2.023-.105 3.285-1.267 3.615s-2.379-.397-2.939-2.42m-2.31 3.99c-.447-1.043.028-1.857.884-2.234s1.768-.174 2.216.869c.638 1.492.261 2.529-.595 2.908c-.855.377-1.863-.051-2.505-1.543m-1.412 3.469c-.357-.834.021-1.484.707-1.785c.684-.303 1.412-.141 1.771.693c.511 1.191.208 2.021-.477 2.324c-.683.301-1.489-.041-2.001-1.232m25.111 27.244c2.908 8.666-10.34 12.184-4.018 16.424c6.325 4.241 10.829-1.635 15.811-9.27s3.896-17.262-2.43-21.504c-6.323-4.24-13.211 2.882-9.363 14.35m6.988-20.836c.408-2.293-.919-3.692-2.801-4.036s-3.606.498-4.013 2.791c-.583 3.282.656 5.172 2.538 5.516s3.694-.989 4.276-4.271m5.513 2.198c.541-1.584-.248-2.727-1.548-3.182c-1.299-.457-2.615-.053-3.156 1.532c-.773 2.264-.101 3.748 1.198 4.203s2.734-.288 3.506-2.553m3.683 3.627c.642-1.318.078-2.4-1.002-2.941c-1.082-.541-2.271-.338-2.914.98c-.919 1.885-.494 3.248.587 3.791c1.08.541 2.409.054 3.329-1.83m1.543 4.353c.63-.941.311-1.832-.463-2.361c-.772-.531-1.705-.502-2.335.439c-.899 1.346-.716 2.438.058 2.969c.771.531 1.84.299 2.74-1.047m.758 3.672c.503-.752.247-1.463-.37-1.887c-.618-.424-1.361-.4-1.866.352c-.719 1.076-.57 1.946.046 2.372c.616.424 1.471.238 2.19-.837"/></svg> -->
    <!-- <svg v-if="isEnd" xmlns="http://www.w3.org/2000/svg" class="marker" viewBox="0 0 32 32"><path fill="currentColor" d="M19.562 10.75C21.74 8.572 25.5 7 25.5 7c-8 0-8-4-16-4v10c8 0 8 4 16 4c0 0-3.75-3-5.938-6.25M6.5 29h2V3h-2z"/></svg> -->
    <svg v-if="isEnd" xmlns="http://www.w3.org/2000/svg" class="marker" viewBox="0 0 512 512"><path fill="currentColor" d="M105 37v114h30V37zm272 0v114h30V37zM16 48v20.94c20.9 6.4 43.8 13.28 43.8 13.28l-43.8.51V112h71V48zm137 0v64h206V88.53l-26.9-9.7l26.9-4.54V48zm272 0v64h71V48zM73 169v42.5l38.1 9.4l-38.1 8.2v68.5l44.3-3.2l-44.3 29v70c32.2 10 62.4 32.8 92.1 53.2c3.5 2.4 7 4.7 10.5 7l25-25l-9.5 34.9c22.6 13.7 44.5 23.5 64.9 23.5c28.2 0 59.1-18.6 90.9-40.4c29.7-20.4 59.9-43.2 92.1-53.2v-13.9l-66.8-17.1l66.8-12.6V169H306.7L256 202.8L205.3 169z"/></svg>
    <span class="value">{{ value }}</span>
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
  gap: 2px;
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
  box-shadow: 0 0 0 3px var(--color-focus), var(--shadow-glow-focus);
}

/* ── Value ──────────────────────────────────────────────────── */
.value {
  /* Embossed/raised effect - light from top-left */
  text-shadow: 
    -1px -1px 0px rgba(255, 255, 255, 0.4),  /* highlight top-left */
    1px 1px 3px rgba(0, 0, 0, 0.8),          /* shadow bottom-right */
    0 0 8px rgba(212, 175, 55, 0.3);         /* subtle gold glow */
}

/* ── Start / End dot markers ────────────────────────────────── */
.marker {
  width: 14px;
  height: 14px;
  flex-grow: 0;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3));
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
