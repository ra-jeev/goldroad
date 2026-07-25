<script setup lang="ts">
import { computed } from 'vue';
import type { Medal, PuzzleType } from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';

const props = defineProps<{
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
  // Expired roads lock mode switching (RP1-16): rebuilding the other mode's
  // board would act as a retry. The inactive tab disables to say so.
  modeSwitchLocked?: boolean;
}>();

const emit = defineEmits<{
  selectMode: [mode: PuzzleType];
}>();

const metrics = computed(() => {
  return [
    { label: UI_COPY.boardHeader.metrics.score, value: `${props.score}` },
    { label: UI_COPY.boardHeader.metrics.target, value: `${props.maxScore}` },
    {
      label: UI_COPY.boardHeader.metrics.boardTotal,
      value: `${props.totalCoins}`,
      description: UI_COPY.boardHeader.metrics.boardTotalDescription,
    },
  ];
});

// A fresh :key each pulse replays the score-pulse animation. Color follows
// the traversed edge's hue. Disabled under reduced motion via global CSS.
const pulseKey = computed(() => props.pulse?.key ?? 0);
const pulseStyle = computed(() => {
  if (!props.pulse) return undefined;
  return props.pulse.type === 'toll'
    ? {
        '--pulse-color': 'var(--color-toll-bright)',
        '--pulse-rgb': 'var(--color-toll-rgb)',
      }
    : {
        '--pulse-color': 'var(--color-bonus-bright)',
        '--pulse-rgb': 'var(--color-bonus-rgb)',
      };
});

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
          <span class="mode-status-label">
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
          <span class="mode-status-label">
            {{ statusLabel(expeditionSolved, expeditionMedal) }}
          </span>
        </span>
      </button>
    </div>

    <p
      :key="pulseKey"
      class="metric-line"
      :class="{ 'metric-line--pulse': pulse }"
      :style="pulseStyle"
      :aria-label="UI_COPY.boardHeader.ariaLabels.roadScore"
    >
      <span v-for="(metric, index) in metrics" :key="metric.label">
        <span class="metric-label" :title="metric.description">
          {{ metric.label }}
        </span>
        <strong>{{ metric.value }}</strong>
        <span v-if="index < metrics.length - 1" class="metric-separator">
          •
        </span>
      </span>
    </p>
  </section>
</template>

<style scoped>
.board-header-card {
  display: grid;
  justify-items: center;
  gap: 0.45rem;
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
  /* Height is set here, not by the padding: at 2.75rem the min-height
     swallowed it entirely. 2.5rem keeps a comfortable target on a pill
     that is ~110px wide. */
  min-height: 2.5rem;
  border: 0;
  border-radius: var(--radius-full);
  padding: 0.25rem 1rem;
  background: transparent;
  color: rgb(var(--color-gold-rgb) / 0.62);
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

.mode-status-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.metric-line {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.76);
  font-size: var(--font-size-board-meta);
  font-weight: 700;
}

.metric-label {
  margin-right: 0.25rem;
  color: rgb(var(--color-gold-rgb) / 0.58);
}

.metric-line strong {
  color: var(--color-gold);
  display: inline-block;
}

.metric-line--pulse strong {
  animation: score-pulse 700ms ease;
}

.metric-separator {
  margin: 0 0.5rem;
  color: rgb(var(--color-gold-rgb) / 0.64);
}

@media (max-width: 760px) {
  .board-header-card {
    padding: 0.1rem 0;
  }

}
</style>
