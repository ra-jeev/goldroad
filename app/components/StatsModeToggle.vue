<script setup lang="ts">
import { computed } from 'vue';
import type { PuzzleType } from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';

const props = defineProps<{
  modelValue: PuzzleType;
}>();

const emit = defineEmits<{
  'update:modelValue': [mode: PuzzleType];
}>();

const nextMode = computed<PuzzleType>(() =>
  props.modelValue === 'classic' ? 'expedition' : 'classic',
);

const nextLabel = computed(() =>
  nextMode.value === 'classic'
    ? UI_COPY.boardHeader.classic
    : UI_COPY.boardHeader.expedition,
);
</script>

<template>
  <button
    type="button"
    class="stats-mode-toggle"
    @click="emit('update:modelValue', nextMode)"
  >
    <span v-if="nextMode === 'classic'" aria-hidden="true">←</span>
    <span>View {{ nextLabel }} stats</span>
    <span v-if="nextMode === 'expedition'" aria-hidden="true">→</span>
  </button>
</template>

<style scoped>
.stats-mode-toggle {
  min-height: 2.75rem;
  padding: 0.55rem 0.25rem 0.1rem;
  border: 0;
  border-top: 1px solid rgb(var(--color-gold-rgb) / 0.14);
  background: none;
  color: rgb(var(--color-gold-rgb) / 0.76);
  font: inherit;
  font-size: var(--font-size-caption);
  font-weight: 800;
  cursor: pointer;
  justify-self: stretch;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}

.stats-mode-toggle:hover {
  color: var(--color-gold-bright);
}

.stats-mode-toggle:focus-visible {
  outline: 2px solid var(--color-gold-bright);
  outline-offset: 2px;
}
</style>
