<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { CelebrationState } from '../composables/useRoadDayGameplay';
import type { ShareRoadResultResponse } from '../composables/useRoadResultShare';
import { UI_COPY } from '../content/uiCopy';

const props = withDefaults(
  defineProps<{
    celebration: CelebrationState | null;
    nextResetCountdown?: string;
    shareHandler: () => Promise<ShareRoadResultResponse | null>;
  }>(),
  {
    nextResetCountdown: '00:00:00',
  },
);

const emit = defineEmits<{
  dismiss: [];
  continueToExpedition: [];
}>();

const COPY = UI_COPY.celebration;

const shareBusy = ref(false);
const shareMessage = ref<string | null>(null);
let shareMessageTimer: ReturnType<typeof setTimeout> | null = null;

const isOpen = computed(() => Boolean(props.celebration));
const dialog = ref<HTMLElement | null>(null);

useDialogFocusTrap(isOpen, dialog);
const variant = computed(() => props.celebration?.variant ?? null);
const tier = computed(() => props.celebration?.tier ?? 'relief');
const isClassic = computed(() => variant.value === 'classic-solve');
const isDayComplete = computed(() => variant.value === 'day-complete');
const isReplay = computed(() => variant.value === 'replay-solve');

// Late no-medal solves let the Expedition CTA lead with a quieter share.
const expeditionLeads = computed(
  () => isClassic.value && tier.value === 'relief',
);
const showExpeditionCta = computed(
  () => isClassic.value && Boolean(props.celebration?.hasExpedition),
);
const showStatsLink = computed(
  () => isDayComplete.value || (isClassic.value && !showExpeditionCta.value),
);
const showStreakTick = computed(() => !isReplay.value);

function medalLabel(medal: string | null): string | null {
  if (!medal) return null;
  return (
    UI_COPY.boardHeader.medals[
      medal as keyof typeof UI_COPY.boardHeader.medals
    ] ?? null
  );
}

function formatTime(value: number | null): string | null {
  if (value === null) return null;
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0
    ? `${minutes}m ${String(seconds).padStart(2, '0')}s`
    : `${seconds}s`;
}

const heading = computed(() => {
  if (!props.celebration) return { eyebrow: '', title: '', body: '' };

  if (isDayComplete.value) {
    return {
      eyebrow: COPY.dayComplete.eyebrow,
      title: COPY.dayComplete.title,
      body: COPY.dayComplete.body,
    };
  }

  if (isReplay.value) {
    return {
      eyebrow: COPY.replay.eyebrow,
      title: COPY.replay.title,
      body: COPY.replay.body,
    };
  }

  const toneKey =
    tier.value === 'gold'
      ? 'gold'
      : tier.value === 'medal'
        ? 'medal'
        : 'relief';
  const tone = COPY.classic[toneKey];
  return {
    eyebrow: tone.eyebrow,
    title: tone.title,
    body: showExpeditionCta.value ? tone.body : COPY.noExpeditionBody,
  };
});

const primaryMedalLabel = computed(() =>
  medalLabel(props.celebration?.medal ?? null),
);

const resultChips = computed(() => {
  if (!props.celebration) return [];
  const chips: string[] = [];
  if (isReplay.value) {
    chips.push(COPY.solved);
    chips.push(COPY.attemptLabel(props.celebration.attemptNumber));
    const time = formatTime(props.celebration.solveTimeMs);
    if (time) chips.push(COPY.solveTimeLine(time));
    const wouldHaveMedal = medalLabel(props.celebration.wouldHaveMedal);
    if (wouldHaveMedal) chips.push(COPY.replay.wouldHaveLine(wouldHaveMedal));
    return chips;
  }
  const medal = primaryMedalLabel.value;
  chips.push(medal ? COPY.medalLine(medal) : COPY.solved);
  chips.push(COPY.attemptLabel(props.celebration.attemptNumber));
  const time = formatTime(props.celebration.solveTimeMs);
  if (time) chips.push(COPY.solveTimeLine(time));
  return chips;
});

type DayRow = { label: string; result: string };

const dayRows = computed<DayRow[]>(() => {
  if (!props.celebration) return [];

  const rows: DayRow[] = [];
  const classic = props.celebration.classicResult;
  const expedition = props.celebration.expeditionResult;

  const describe = (
    solved: boolean,
    medal: string | null,
    attempts: number,
  ): string => {
    if (!solved) return COPY.dayComplete.notPlayed;
    const label = medalLabel(medal);
    return label
      ? `${COPY.medalLine(label)} · ${COPY.attemptLabel(attempts)}`
      : `${COPY.solved} · ${COPY.attemptLabel(attempts)}`;
  };

  rows.push({
    label: COPY.dayComplete.classicLabel,
    result: classic
      ? describe(classic.solved, classic.medal, classic.attempts)
      : COPY.dayComplete.notPlayed,
  });
  rows.push({
    label: COPY.dayComplete.expeditionLabel,
    result: expedition
      ? describe(expedition.solved, expedition.medal, expedition.attempts)
      : COPY.dayComplete.notPlayed,
  });

  return rows;
});

function setShareMessage(message: string | null) {
  shareMessage.value = message;
  if (shareMessageTimer) {
    clearTimeout(shareMessageTimer);
    shareMessageTimer = null;
  }
  if (message) {
    shareMessageTimer = setTimeout(() => {
      shareMessage.value = null;
      shareMessageTimer = null;
    }, 3200);
  }
}

async function onShare() {
  if (shareBusy.value) return;
  shareBusy.value = true;
  try {
    const response = await props.shareHandler();
    if (response && response.message) {
      setShareMessage(response.message);
    }
  } finally {
    shareBusy.value = false;
  }
}

function onDismiss() {
  emit('dismiss');
}

function onContinue() {
  emit('continueToExpedition');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    onDismiss();
  }
}

watch(isOpen, (open) => {
  if (!import.meta.client) return;

  if (open) {
    setShareMessage(null);
    window.addEventListener('keydown', onKeydown);
  } else {
    window.removeEventListener('keydown', onKeydown);
  }
});

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', onKeydown);
  }
  if (shareMessageTimer) {
    clearTimeout(shareMessageTimer);
    shareMessageTimer = null;
  }
});
</script>

<template>
  <Transition name="celebration">
    <div v-if="celebration" class="celebration-scrim" @click.self="onDismiss">
      <section
        ref="dialog"
        class="celebration-sheet"
        tabindex="-1"
        :class="[`celebration-sheet--${tier}`, `celebration-sheet--${variant}`]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
      >
        <button
          type="button"
          class="celebration-close"
          :aria-label="COPY.close"
          @click="onDismiss"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="3"
            />
          </svg>
        </button>

        <div class="celebration-body">
          <div
            v-if="!isDayComplete"
            class="celebration-medal"
            :class="[
              primaryMedalLabel
                ? `celebration-medal--${celebration.medal}`
                : 'celebration-medal--plain',
            ]"
          >
            <span class="celebration-medal-core">
              {{ primaryMedalLabel ?? COPY.solved }}
            </span>
            <span v-if="showStreakTick" class="celebration-tick">
              {{ COPY.solveIncrement }}
            </span>
          </div>

          <div v-else class="celebration-day-badge" aria-hidden="true">
            <span class="celebration-day-badge-core">
              {{ COPY.dayComplete.bothSolved }}
            </span>
            <span v-if="showStreakTick" class="celebration-tick">
              {{ COPY.solveIncrement }}
            </span>
          </div>

          <p class="celebration-eyebrow">{{ heading.eyebrow }}</p>
          <h2 id="celebration-title" class="celebration-title">
            {{ heading.title }}
          </h2>
          <p class="celebration-lede">{{ heading.body }}</p>

          <div v-if="isDayComplete" class="celebration-day-grid">
            <div
              v-for="row in dayRows"
              :key="row.label"
              class="celebration-day-row"
            >
              <span class="celebration-day-mode">{{ row.label }}</span>
              <span class="celebration-day-result">{{ row.result }}</span>
            </div>
          </div>

          <div v-else class="celebration-preview">
            <span
              v-for="chip in resultChips"
              :key="chip"
              class="celebration-chip"
            >
              {{ chip }}
            </span>
          </div>

          <p v-if="isDayComplete" class="celebration-countdown">
            {{ COPY.dayComplete.nextRoad(nextResetCountdown) }}
          </p>

          <div class="celebration-actions">
            <template v-if="isClassic">
              <button
                type="button"
                class="celebration-button"
                :class="
                  expeditionLeads
                    ? 'celebration-button--ghost'
                    : 'celebration-button--primary'
                "
                :disabled="shareBusy"
                @click="onShare"
              >
                {{ COPY.share }}
              </button>

              <button
                v-if="showExpeditionCta"
                type="button"
                class="celebration-button"
                :class="
                  expeditionLeads
                    ? 'celebration-button--primary'
                    : 'celebration-button--secondary'
                "
                @click="onContinue"
              >
                {{ COPY.continueToExpedition }}
              </button>

              <NuxtLink
                v-else
                to="/stats"
                class="celebration-button celebration-button--secondary celebration-button--link"
                @click="onDismiss"
              >
                {{ COPY.viewStats }}
              </NuxtLink>
            </template>

            <template v-else-if="isDayComplete">
              <button
                type="button"
                class="celebration-button celebration-button--primary"
                :disabled="shareBusy"
                @click="onShare"
              >
                {{ COPY.shareDay }}
              </button>

              <NuxtLink
                to="/stats"
                class="celebration-button celebration-button--secondary celebration-button--link"
                @click="onDismiss"
              >
                {{ COPY.viewStats }}
              </NuxtLink>
            </template>

            <template v-else>
              <button
                type="button"
                class="celebration-button celebration-button--primary"
                @click="onDismiss"
              >
                {{ COPY.keepGoing }}
              </button>

              <button
                type="button"
                class="celebration-button celebration-button--ghost"
                :disabled="shareBusy"
                @click="onShare"
              >
                {{ COPY.share }}
              </button>
            </template>
          </div>

          <p
            class="celebration-share-message"
            :class="{ 'is-visible': Boolean(shareMessage) }"
            role="status"
            aria-live="polite"
          >
            {{ shareMessage }}
          </p>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.celebration-scrim {
  position: fixed;
  inset: 0;
  z-index: 140;
  display: grid;
  align-items: end;
  justify-items: center;
  padding: clamp(0rem, 2vw, 1rem);
  background: rgb(0 0 0 / 0.66);
  backdrop-filter: blur(6px);
}

.celebration-sheet {
  position: relative;
  width: min(100%, 480px);
  max-height: min(92dvh, 760px);
  overflow-y: auto;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding: clamp(1.5rem, 4vw, 2rem) clamp(1.1rem, 3.5vw, 1.6rem)
    clamp(1.2rem, 3vw, 1.5rem);
  background: var(--gradient-card-completion, var(--gradient-card-overlay));
  border: 1px solid rgb(var(--color-gold-rgb) / 0.34);
  border-bottom: 0;
  box-shadow: var(--shadow-2xl);
}

@media (min-width: 560px) {
  .celebration-scrim {
    align-items: center;
  }

  .celebration-sheet {
    border-radius: var(--radius-xl);
    border-bottom: 1px solid rgb(var(--color-gold-rgb) / 0.34);
  }
}

.celebration-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 2.1rem;
  height: 2.1rem;
  display: inline-grid;
  place-items: center;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.22);
  border-radius: var(--radius-circle);
  background: rgb(0 0 0 / 0.28);
  color: rgb(var(--color-gold-rgb) / 0.78);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.celebration-close svg {
  width: 1.05rem;
  height: 1.05rem;
}

.celebration-close:hover {
  transform: translateY(-1px);
  color: var(--color-gold-bright);
}

.celebration-body {
  display: grid;
  justify-items: center;
  gap: 0.62rem;
  text-align: center;
}

.celebration-medal,
.celebration-day-badge {
  position: relative;
  display: inline-grid;
  place-items: center;
  margin-bottom: 0.2rem;
}

.celebration-medal-core {
  display: inline-grid;
  place-items: center;
  min-width: 4.6rem;
  min-height: 4.6rem;
  padding: 0 0.8rem;
  border-radius: var(--radius-circle);
  font-weight: 900;
  font-size: 1.02rem;
  letter-spacing: 0.01em;
  color: var(--color-text-on-gold);
  background: var(--gradient-button-primary);
  box-shadow: var(--shadow-glow-gold), var(--shadow-inset-gold);
}

.celebration-medal--silver .celebration-medal-core {
  color: var(--color-text-on-silver);
  background: var(--gradient-medal-silver);
  box-shadow:
    0 0 16px rgb(210 220 230 / 0.4),
    var(--shadow-inset-gold);
}

.celebration-medal--bronze .celebration-medal-core {
  color: var(--color-text-on-bronze);
  background: var(--gradient-medal-bronze);
  box-shadow:
    0 0 16px rgb(210 140 80 / 0.42),
    var(--shadow-inset-gold);
}

.celebration-medal--plain .celebration-medal-core {
  color: var(--color-gold-bright);
  background: rgb(var(--color-gold-rgb) / 0.14);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.4);
  box-shadow: none;
}

.celebration-day-badge-core {
  display: inline-grid;
  place-items: center;
  padding: 0.55rem 1.1rem;
  border-radius: var(--radius-full);
  font-weight: 900;
  font-size: 0.9rem;
  color: var(--color-text-on-gold);
  background: var(--gradient-button-primary);
  box-shadow: var(--shadow-glow-gold-soft), var(--shadow-inset-gold);
}

.celebration-tick {
  position: absolute;
  top: -0.5rem;
  right: -0.7rem;
  min-width: 1.7rem;
  padding: 0.12rem 0.34rem;
  border-radius: var(--radius-full);
  background: var(--color-success);
  color: var(--color-text-on-success);
  font-size: 0.82rem;
  font-weight: 900;
  box-shadow: 0 0 10px rgb(30 160 90 / 0.6);
  animation: celebration-pop var(--transition-slow) both;
  animation-delay: 200ms;
}

.celebration-eyebrow {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 800;
  color: rgb(var(--color-gold-rgb) / 0.66);
}

.celebration-title {
  margin: 0;
  font-size: clamp(1.5rem, 5vw, 1.85rem);
  line-height: 1.12;
  color: var(--color-gold-bright);
}

.celebration-lede {
  margin: 0;
  max-width: 32ch;
  color: rgb(var(--color-gold-rgb) / 0.82);
  line-height: var(--line-height-base);
}

.celebration-preview {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 0.25rem;
}

.celebration-chip {
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-full);
  background: rgb(0 0 0 / 0.24);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.24);
  color: rgb(var(--color-gold-rgb) / 0.86);
  font-size: 0.82rem;
  font-weight: 800;
}

.celebration-day-grid {
  display: grid;
  gap: 0.4rem;
  width: 100%;
  margin-top: 0.35rem;
}

.celebration-day-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.8rem;
  border-radius: var(--radius-sm);
  background: rgb(0 0 0 / 0.22);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
}

.celebration-day-mode {
  font-weight: 900;
  color: var(--color-gold-bright);
}

.celebration-day-result {
  color: rgb(var(--color-gold-rgb) / 0.82);
  font-weight: 700;
  font-size: 0.88rem;
  text-align: right;
}

.celebration-countdown {
  margin: 0.1rem 0 0;
  font-size: 0.82rem;
  font-weight: 800;
  color: rgb(var(--color-gold-rgb) / 0.68);
}

.celebration-actions {
  display: grid;
  gap: 0.55rem;
  width: 100%;
  margin-top: 0.85rem;
}

.celebration-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  padding: 0 1.1rem;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  text-decoration: none;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.celebration-button--primary {
  color: var(--color-text-on-gold);
  background: var(--gradient-button-primary);
  box-shadow: 0 0 18px rgb(var(--color-gold-rgb) / 0.3);
}

.celebration-button--secondary {
  color: var(--color-gold-bright);
  background: rgb(var(--color-gold-rgb) / 0.14);
  border-color: rgb(var(--color-gold-rgb) / 0.42);
}

.celebration-button--ghost {
  color: rgb(var(--color-gold-rgb) / 0.82);
  background: rgb(var(--color-gold-rgb) / 0.08);
  border-color: rgb(var(--color-gold-rgb) / 0.22);
}

.celebration-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.celebration-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.celebration-share-message {
  margin: 0.15rem 0 0;
  min-height: 1.1rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: rgb(var(--color-gold-rgb) / 0.72);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.celebration-share-message.is-visible {
  opacity: 1;
}

@keyframes celebration-pop {
  from {
    opacity: 0;
    transform: scale(0.4);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.celebration-enter-active,
.celebration-leave-active {
  transition: opacity var(--transition-base);
}

.celebration-enter-active .celebration-sheet {
  transition: transform var(--transition-slow);
}

.celebration-enter-from,
.celebration-leave-to {
  opacity: 0;
}

.celebration-enter-from .celebration-sheet {
  transform: translateY(18px);
}

@media (prefers-reduced-motion: reduce) {
  .celebration-enter-from .celebration-sheet {
    transform: none;
  }

  .celebration-tick {
    animation: none;
  }
}
</style>
