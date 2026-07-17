<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ShareRoadResultResponse } from '../composables/useRoadResultShare';
import { UI_COPY } from '../content/uiCopy';

const props = withDefaults(
  defineProps<{
    status: string;
    hintMessage: string | null;
    attemptNumber: number;
    hasMoved: boolean;
    nextResetCountdown?: string;
    showNextResetCountdown?: boolean;
    expeditionJustUnlocked: boolean;
    hintsUsed: number;
    ended: boolean;
    solved: boolean;
    canRetry: boolean;
    canSwitchToExpedition: boolean;
    loading: boolean;
    submitting: boolean;
    trackingDisabled?: boolean;
    showStatsLink?: boolean;
    secondaryLinkTo?: string | null;
    secondaryLinkLabel?: string | null;
    showShare?: boolean;
    shareHandler?: (() => Promise<ShareRoadResultResponse | null>) | null;
  }>(),
  {
    nextResetCountdown: '00:00:00',
    showNextResetCountdown: true,
    showStatsLink: true,
    trackingDisabled: false,
    secondaryLinkTo: null,
    secondaryLinkLabel: null,
    showShare: false,
    shareHandler: null,
  },
);

const emit = defineEmits<{
  hint: [];
  retry: [];
  switchExpedition: [];
}>();

const shareBusy = ref(false);
const shareMessage = ref<string | null>(null);
let shareMessageTimer: ReturnType<typeof setTimeout> | null = null;

async function onShare() {
  if (!props.shareHandler || shareBusy.value) return;

  shareBusy.value = true;
  try {
    const response = await props.shareHandler();
    if (shareMessageTimer) {
      clearTimeout(shareMessageTimer);
      shareMessageTimer = null;
    }
    shareMessage.value = response?.message ?? null;
    if (shareMessage.value) {
      shareMessageTimer = setTimeout(() => {
        shareMessage.value = null;
        shareMessageTimer = null;
      }, 3000);
    }
  } finally {
    shareBusy.value = false;
  }
}

const busy = computed(() => props.loading || props.submitting);
const retryBusy = computed(
  () => props.loading || (props.submitting && !props.ended),
);

/**
 * The footer shows exactly one contextual message (or none) plus the
 * state-relevant actions — v1's GameFooter contract, with Hint as the
 * one deliberate addition since v1 had no hint feature.
 */
type FooterState =
  | 'resting-first' // board at rest, first attempt: one instruction
  | 'resting-retry' // board at rest after a retry: attempt count only
  | 'mid-run' // moves made: no text, quiet retry + hint icons only
  | 'failed' // run ended unsolved: what happened + promoted Try again
  | 'solved-next' // solved, Expedition waiting: actions only
  | 'solved-final'; // solved, day done here: ticker + quiet actions

const footerState = computed<FooterState>(() => {
  if (props.solved) {
    return props.canSwitchToExpedition ? 'solved-next' : 'solved-final';
  }
  if (props.ended) return 'failed';
  if (props.hasMoved) return 'mid-run';
  return props.attemptNumber > 1 && !props.trackingDisabled
    ? 'resting-retry'
    : 'resting-first';
});

const footerMessage = computed<string | null>(() => {
  // A hint the player just asked for always replaces the resting message.
  if (props.hintMessage && !props.solved && !props.ended) {
    return props.hintMessage;
  }

  switch (footerState.value) {
    case 'resting-first':
      return props.status;
    case 'resting-retry':
      return UI_COPY.boardFooter.attemptResting(props.attemptNumber);
    case 'failed':
      return props.status;
    case 'solved-final':
      return props.showNextResetCountdown
        ? UI_COPY.boardFooter.nextRoadShort(props.nextResetCountdown)
        : null;
    default:
      return null;
  }
});

const showAttemptPill = computed(
  () =>
    footerState.value === 'failed' &&
    props.attemptNumber > 1 &&
    !props.trackingDisabled,
);
const showHintAction = computed(
  () =>
    (footerState.value === 'resting-first' ||
      footerState.value === 'resting-retry' ||
      footerState.value === 'mid-run') &&
    !props.trackingDisabled,
);
// Mid-run keeps Hint reachable but drops its label so nothing competes
// with the board.
const hintIsQuiet = computed(() => footerState.value === 'mid-run');
const showRetryAction = computed(() => props.canRetry);
const retryIsPrimary = computed(() => footerState.value === 'failed');
const showShareAction = computed(
  () => props.showShare && props.solved && Boolean(props.shareHandler),
);
const showStatsAction = computed(
  () => props.showStatsLink && footerState.value === 'solved-final',
);
const showSecondaryLink = computed(
  () =>
    Boolean(props.secondaryLinkTo && props.secondaryLinkLabel) &&
    (props.solved || props.ended),
);
const secondaryLinkTo = computed(() => props.secondaryLinkTo ?? '/');
const secondaryLinkLabel = computed(() => props.secondaryLinkLabel ?? '');
// Transient share feedback borrows the message slot so the footer's height
// never changes.
const displayMessage = computed(
  () => shareMessage.value ?? footerMessage.value,
);
</script>

<template>
  <section class="board-footer-card">
    <!-- Both slots always render at fixed heights so the board never
         shifts as messages and actions come and go. -->
    <div class="footer-message-slot" aria-live="polite">
      <p v-if="displayMessage" class="footer-message">{{ displayMessage }}</p>
    </div>

    <div class="action-row">
      <span v-if="showAttemptPill" class="attempt-pill">
        {{ UI_COPY.boardFooter.attemptLabel }} #{{ attemptNumber }}
      </span>
      <button
        v-if="showRetryAction"
        type="button"
        :class="[
          'action-button',
          retryIsPrimary ? 'primary' : 'ghost',
          { 'action-button--text': retryIsPrimary },
        ]"
        :disabled="retryBusy"
        :aria-label="UI_COPY.boardFooter.retryRoad"
        :title="UI_COPY.boardFooter.retryRoad"
        @click="emit('retry')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4.5 11.2a7.5 7.5 0 1 1 2.2 5.3M4.5 11.2V6.5m0 4.7h4.7"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="3"
          />
        </svg>
        <span v-if="retryIsPrimary">{{ UI_COPY.boardFooter.retryRoad }}</span>
      </button>

      <button
        v-if="showHintAction"
        type="button"
        :class="[
          'action-button',
          'ghost',
          'ghost--hint',
          { 'action-button--text': !hintIsQuiet },
        ]"
        :disabled="busy"
        :aria-label="UI_COPY.boardFooter.openHint"
        :title="UI_COPY.boardFooter.hintUsedLabel(hintsUsed)"
        @click="emit('hint')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M9 18h6m-5-3.5h4m-7.5-4.7a5.5 5.5 0 1 1 9.2 4.05c-.77.68-1.2 1.28-1.34 2.15H9.64c-.14-.87-.57-1.47-1.34-2.15A5.48 5.48 0 0 1 6.5 9.8Z"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="3"
          />
        </svg>
        <template v-if="!hintIsQuiet">
          {{ UI_COPY.boardFooter.openHint }}
        </template>
      </button>

      <button
        v-if="showShareAction"
        type="button"
        class="action-button secondary action-button--text"
        :disabled="shareBusy"
        :title="UI_COPY.boardFooter.shareResult"
        @click="onShare"
      >
        {{ UI_COPY.boardFooter.shareResult }}
      </button>

      <NuxtLink
        v-if="showSecondaryLink"
        :to="secondaryLinkTo"
        class="link-button secondary action-button--text"
      >
        {{ secondaryLinkLabel }}
      </NuxtLink>

      <NuxtLink
        v-if="showStatsAction"
        to="/stats"
        class="link-button primary action-button--text"
      >
        {{ UI_COPY.boardFooter.viewStats }}
      </NuxtLink>

      <button
        v-if="canSwitchToExpedition"
        type="button"
        class="action-button primary action-button--text"
        :disabled="busy"
        :title="
          expeditionJustUnlocked
            ? UI_COPY.boardFooter.expeditionUnlocked
            : UI_COPY.boardFooter.switchToExpedition
        "
        @click="emit('switchExpedition')"
      >
        {{ UI_COPY.boardFooter.switchToExpedition }}
      </button>
    </div>

  </section>
</template>

<style scoped>
.board-footer-card {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding: 0.2rem 0;
  text-align: center;
}

/* Fixed-height message slot: tall enough for the longest two-line message
   at mobile width, occupied or not, so the board below never jumps. */
.footer-message-slot {
  display: grid;
  align-items: center;
  justify-items: center;
  min-height: 3rem;
}

.footer-message {
  margin: 0;
  color: var(--color-gold-bright);
  font-size: 1rem;
  font-weight: 650;
  line-height: var(--line-height-snug);
}

.attempt-pill {
  flex-shrink: 0;
  padding: 0.25rem 0.55rem;
  border-radius: var(--radius-xs);
  background: rgb(var(--color-gold-rgb) / 0.12);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.24);
  color: rgb(var(--color-gold-rgb) / 0.84);
  font-size: 0.88rem;
  font-weight: 700;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  align-items: center;
  min-height: 2.35rem;
}

button,
.link-button {
  border: 0;
  border-radius: var(--radius-circle);
  width: 2.35rem;
  height: 2.35rem;
  padding: 0;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  font: inherit;
  font-size: 0.94rem;
  font-weight: 800;
  line-height: 1;
}

.action-button--text,
.link-button.action-button--text {
  width: auto;
  min-width: 2.35rem;
  border-radius: var(--radius-full);
  padding: 0 0.85rem;
}

.action-button svg {
  width: 1.12rem;
  height: 1.12rem;
  flex: 0 0 auto;
}

.primary {
  color: var(--color-text-on-gold);
  background: var(--gradient-button-primary);
  box-shadow: 0 0 18px rgb(var(--color-gold-rgb) / 0.28);
}

.secondary,
.ghost {
  color: var(--color-gold);
  background: rgb(var(--color-gold-rgb) / 0.12);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.28);
}

.ghost {
  background: rgb(var(--color-gold-rgb) / 0.08);
}

button:hover:not(:disabled),
.link-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 760px) {
  .footer-message {
    max-width: 34ch;
  }
}
</style>
