<script setup lang="ts">
import type { PuzzleType } from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';

defineProps<{
  modelValue: PuzzleType;
  label: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [mode: PuzzleType];
}>();

function formatModeLabel(mode: PuzzleType): string {
  return mode === 'classic'
    ? UI_COPY.boardHeader.classic
    : UI_COPY.boardHeader.expedition;
}
</script>

<template>
  <div
    class="stats-mode-switch segmented-control segmented-control--stretched"
    role="tablist"
    :aria-label="label"
  >
    <button
      v-for="mode in (['classic', 'expedition'] as const)"
      :key="mode"
      type="button"
      role="tab"
      class="segmented-control__option"
      :class="{ 'is-active': modelValue === mode }"
      :aria-selected="modelValue === mode"
      @click="emit('update:modelValue', mode)"
    >
      {{ formatModeLabel(mode) }}
    </button>
  </div>
</template>

<style scoped>
.stats-mode-switch {
  width: min(100%, 21rem);
}

.stats-mode-switch .segmented-control__option {
  font-size: var(--font-size-caption);
}
</style>
