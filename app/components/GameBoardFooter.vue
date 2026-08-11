<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ShareRoadResultResponse } from '../composables/useRoadResultShare';
import { UI_COPY } from '../content/uiCopy';
import { computeFooterState, type FooterState } from '../utils/footerState';

const props = withDefaults(
  defineProps<{
    status: string;
    hintMessage: string | null;
    solveAcknowledgement?: string | null;
    attemptNumber: number;
    hasMoved: boolean;
    nextResetCountdown?: string;
    showNextResetCountdown?: boolean;
    newRoadReady?: boolean;
    expeditionJustUnlocked: boolean;
    hintsUsed: number;
    hintsRemaining?: number;
    hintPending?: boolean;
    /** A hint route is on the board waiting to be followed. */
    hasGuidePath?: boolean;
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
    newRoadReady: false,
    showStatsLink: true,
    trackingDisabled: false,
    secondaryLinkTo: null,
    secondaryLinkLabel: null,
    showShare: false,
    solveAcknowledgement: null,
    shareHandler: null,
    hintsRemaining: undefined,
    hintPending: false,
    hasGuidePath: false,
  },
);

const emit = defineEmits<{
  hint: [];
  retry: [];
  switchExpedition: [];
  loadNewRoad: [];
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

const footerState = computed<FooterState>(() =>
  computeFooterState({
    solved: props.solved,
    ended: props.ended,
    hasMoved: props.hasMoved,
    attemptNumber: props.attemptNumber,
    trackingDisabled: props.trackingDisabled,
    canSwitchToExpedition: props.canSwitchToExpedition,
  }),
);

const footerMessage = computed<string | null>(() => {
  if (props.solveAcknowledgement && props.solved) {
    return props.solveAcknowledgement;
  }
  // A hint the player just asked for always replaces the resting message.
  if (props.hintMessage && !props.solved && !props.ended) {
    return props.hintMessage;
  }

  switch (footerState.value) {
    case 'resting-first':
      return props.hasGuidePath
        ? UI_COPY.boardFooter.followGuide
        : props.status;
    case 'resting-retry': {
      const attempt = UI_COPY.boardFooter.attemptResting(props.attemptNumber);
      return props.hasGuidePath
        ? `${attempt} · ${UI_COPY.boardFooter.followGuide}`
        : attempt;
    }
    case 'failed':
      return props.status;
    // Both solved states carry the next-road ticker — the day's next beat.
    case 'solved-next':
    case 'solved-final':
      if (!props.showNextResetCountdown) return null;
      return props.newRoadReady
        ? UI_COPY.boardFooter.newRoadReady
        : UI_COPY.boardFooter.nextRoadShort(props.nextResetCountdown);
    default:
      return null;
  }
});

// Undefined means the caller does not budget hints; treat that as unlimited
// rather than silently hiding the control.
const hintsLeft = computed(() => props.hintsRemaining ?? Number.POSITIVE_INFINITY);

const showHintAction = computed(
  () =>
    (footerState.value === 'resting-first' ||
      footerState.value === 'resting-retry' ||
      footerState.value === 'mid-run') &&
    !props.trackingDisabled &&
    !props.newRoadReady &&
    hintsLeft.value > 0,
);

const hintTitle = computed(() => {
  if (props.hintPending) return UI_COPY.boardFooter.hintLoading;
  return Number.isFinite(hintsLeft.value)
    ? UI_COPY.boardFooter.hintUsedLabel(hintsLeft.value)
    : UI_COPY.boardFooter.openHint;
});
// Mid-run keeps Hint reachable but drops its label so nothing competes
// with the board.
const hintIsQuiet = computed(() => footerState.value === 'mid-run');
// Expiry removes retry and hint but never touches the board: the active
// attempt may finish; afterwards the only forward action is the new road.
const showRetryAction = computed(() => props.canRetry && !props.newRoadReady);
const retryIsPrimary = computed(() => footerState.value === 'failed');
const showShareAction = computed(
  () => props.showShare && props.solved && Boolean(props.shareHandler),
);
const showStatsAction = computed(
  () =>
    props.showStatsLink &&
    footerState.value === 'solved-final' &&
    !showNewRoadAction.value,
);
// Once the next road is live, loading it is the day's next beat — it takes
// the primary slot (and the stats link steps back) until the fetch actually
// returns a new road. It shows in every state: mid-run it sits quietly next
// to the board without replacing any message.
const showNewRoadAction = computed(
  () => props.newRoadReady && props.showNextResetCountdown,
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
          { 'is-pending': hintPending },
        ]"
        :disabled="busy || hintPending"
        :aria-label="UI_COPY.boardFooter.openHint"
        :aria-busy="hintPending"
        :title="hintTitle"
        @click="emit('hint')"
      >
        <svg
          v-if="hintPending"
          class="hint-spinner"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-dasharray="14 42"
          />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
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
        v-if="showNewRoadAction"
        type="button"
        class="action-button primary action-button--text"
        :disabled="busy"
        :title="UI_COPY.boardFooter.playNewRoad"
        @click="emit('loadNewRoad')"
      >
        {{ UI_COPY.boardFooter.playNewRoad }}
      </button>

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

      <!-- Callers with their own forward action (the tutorial's "walk today's
           road") put it here, so it shares the row with retry rather than
           opening a second row of buttons below the footer. -->
      <slot name="actions" />
    </div>

  </section>
</template>

<style scoped>
/* The hint round trip is the one action here that waits on the network, so
   it gets a spinner rather than a silently dead button. */
.hint-spinner {
  animation: hint-spin 900ms linear infinite;
  transform-origin: center;
}

.action-button.is-pending {
  cursor: progress;
}

@keyframes hint-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hint-spinner {
    animation-duration: 2400ms;
  }
}

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
  font-size: var(--font-size-board-meta);
  font-weight: 650;
  line-height: var(--line-height-snug);
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  justify-content: center;
  align-items: center;
  min-height: 2.35rem;
}

button,
.link-button {
  border: 0;
  border-radius: var(--radius-circle);
  width: var(--control-size);
  height: var(--control-size);
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
  font-size: var(--font-size-control);
  font-weight: 800;
  line-height: 1;
}

.action-button--text,
.link-button.action-button--text {
  width: auto;
  min-width: var(--control-size);
  border-radius: var(--radius-full);
  padding: 0 0.85rem;
}

.action-button svg {
  width: var(--icon-size);
  height: var(--icon-size);
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
