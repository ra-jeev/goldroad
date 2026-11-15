<script setup lang="ts">
import type { Medal, PuzzleType } from '#shared/types/game';
import { UI_COPY } from '../content/uiCopy';

defineProps<{
  selectedMode: PuzzleType | null;
  hasExpedition: boolean;
  isExpeditionUnlocked: boolean;
  classicSolved: boolean;
  classicMedal: Medal | null;
  expeditionSolved: boolean;
  expeditionMedal: Medal | null;
  score: number;
  maxScore: number;
  totalCoins: number;
  pulse?: { type: 'toll' | 'bonus'; key: number } | null;
  // Classic only: the run can no longer land on the target.
  overTarget?: boolean;
  // Expired roads lock mode switching (RP1-16): rebuilding the other mode's
  // board would act as a retry. The inactive tab disables to say so.
  modeSwitchLocked?: boolean;
}>();

const emit = defineEmits<{
  selectMode: [mode: PuzzleType];
}>();

function statusLabel(solved: boolean, medal: Medal | null): string {
  if (!solved) return 'Not solved';
  return medal
    ? `${UI_COPY.boardHeader.medals[medal]} medal`
    : UI_COPY.boardHeader.solvedBadge;
}
</script>

<template>
  <section
    class="board-header-card"
    :aria-label="UI_COPY.boardHeader.ariaLabels.controls"
  >
    <div
      class="mode-switch segmented-control segmented-control--compact"
      role="tablist"
      :aria-label="UI_COPY.boardHeader.ariaLabels.puzzleMode"
    >
      <button
        type="button"
        class="mode-option segmented-control__option"
        :class="{ 'mode-option--active is-active': selectedMode === 'classic' }"
        :aria-selected="selectedMode === 'classic'"
        :disabled="modeSwitchLocked && selectedMode !== 'classic'"
        role="tab"
        :title="
          classicSolved
            ? UI_COPY.boardHeader.solvedBadge
            : UI_COPY.boardHeader.classic
        "
        @click="emit('selectMode', 'classic')"
      >
        <span>{{ UI_COPY.boardHeader.classic }}</span>
        <span
          class="mode-status"
          :class="{ 'mode-status--solved': classicSolved }"
        >
          <svg v-if="classicSolved" viewBox="0 0 16 16" aria-hidden="true">
            <path d="m3.5 8.2 2.8 2.8 6.2-6.2" />
          </svg>
          <span v-else class="mode-status-dot" aria-hidden="true" />
          <span class="sr-only">
            {{ statusLabel(classicSolved, classicMedal) }}
          </span>
        </span>
      </button>

      <button
        v-if="hasExpedition"
        type="button"
        class="mode-option segmented-control__option"
        :class="{ 'mode-option--active is-active': selectedMode === 'expedition' }"
        :aria-selected="selectedMode === 'expedition'"
        :disabled="
          !isExpeditionUnlocked ||
          (modeSwitchLocked && selectedMode !== 'expedition')
        "
        role="tab"
        :title="
          isExpeditionUnlocked
            ? UI_COPY.boardHeader.expedition
            : UI_COPY.boardHeader.unlockHint
        "
        @click="emit('selectMode', 'expedition')"
      >
        <span>{{ UI_COPY.boardHeader.expedition }}</span>
        <span
          class="mode-status"
          :class="{ 'mode-status--solved': expeditionSolved }"
        >
          <svg v-if="expeditionSolved" viewBox="0 0 16 16" aria-hidden="true">
            <path d="m3.5 8.2 2.8 2.8 6.2-6.2" />
          </svg>
          <span v-else class="mode-status-dot" aria-hidden="true" />
          <span class="sr-only">
            {{ statusLabel(expeditionSolved, expeditionMedal) }}
          </span>
        </span>
      </button>
    </div>

    <GameBoardMetrics
      :score="score"
      :max-score="maxScore"
      :total-coins="totalCoins"
      :pulse="pulse"
      :over-target="overTarget"
    />
  </section>
</template>

<style scoped>
.board-header-card {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0;
  text-align: center;
}

.mode-switch {
  display: inline-grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(5rem, max-content);
  width: fit-content;
  padding: 0.16rem;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.22);
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.08);
}

.mode-option {
  min-height: var(--segmented-control-size);
  border: 0;
  border-radius: var(--radius-full);
  padding: 0.25rem 1rem;
  background: transparent;
  color: rgb(var(--color-gold-rgb) / 0.72);
  font: inherit;
  font-size: var(--font-size-control);
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.mode-option--active {
  background: rgb(var(--color-gold-rgb) / 0.18);
  color: var(--color-gold);
  box-shadow: inset 0 0 0 1px rgb(var(--color-gold-rgb) / 0.26);
}

.mode-option:disabled {
  color: rgb(var(--color-gold-rgb) / 0.34);
  cursor: not-allowed;
}

/* 16px badge: the 20px one read as a heavy blob next to 16px label text. */
.mode-status {
  position: relative;
  width: 1rem;
  height: 1rem;
  flex: 0 0 1rem;
  display: inline-grid;
  place-items: center;
  border-radius: var(--radius-circle);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.34);
  color: rgb(var(--color-gold-rgb) / 0.64);
}

.mode-status svg {
  width: 0.625rem;
  height: 0.625rem;
  fill: none;
  stroke: currentColor;
  /* Heavier stroke holds the tick's weight at the smaller badge size. */
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mode-status-dot {
  width: 0.22rem;
  height: 0.22rem;
  border-radius: var(--radius-circle);
  background: currentColor;
  opacity: 0.55;
}

.mode-status--solved {
  color: var(--color-text-on-gold);
  background: var(--color-gold);
  border-color: var(--color-gold-bright);
}

@media (max-width: 760px) {
  .board-header-card {
    padding: 0.1rem 0;
  }
}
</style>
