<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import { useRetryConfirmation } from '../composables/useBoardOverlayGate';
import type { ShareRoadResultResponse } from '../composables/useRoadResultShare';
import { UI_COPY } from '../content/uiCopy';
import {
  computeFooterState,
  type FooterState,
} from '../utils/footerState';

const props = withDefaults(
  defineProps<{
    status: string;
    hintMessage: string | null;
    progressSyncSignal?: number;
    startInstructionDay?: string | null;
    solveAcknowledgement?: string | null;
    solvedAfterRollover?: boolean;
    attemptNumber: number;
    hasMoved: boolean;
    nextResetCountdown?: string;
    showNextResetCountdown?: boolean;
    roadExpired?: boolean;
    newRoadReady?: boolean;
    newRoadCheckFeedback?: { message: string } | null;
    expeditionJustUnlocked: boolean;
    practice?: boolean;
    hintsRemaining?: number;
    hintPending?: boolean;
    /** A hint route is on the board waiting to be followed. */
    hasGuidePath?: boolean;
    ended: boolean;
    solved: boolean;
    canRetry: boolean;
    canUndo?: boolean;
    canSwitchToExpedition: boolean;
    loading: boolean;
    submitting: boolean;
    trackingDisabled?: boolean;
    /** Increments when the board decides the player could use a hint. */
    hintNudgeSignal?: number;
    showStatsLink?: boolean;
    secondaryLinkTo?: string | null;
    secondaryLinkLabel?: string | null;
    showShare?: boolean;
    shareHandler?: (() => Promise<ShareRoadResultResponse | null>) | null;
  }>(),
  {
    nextResetCountdown: '00:00:00',
    showNextResetCountdown: true,
    roadExpired: false,
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
    canUndo: false,
  },
);

const emit = defineEmits<{
  hint: [];
  retry: [];
  undo: [];
  switchExpedition: [];
  loadNewRoad: [];
}>();

// The bulb lights once per nudge and settles back. Held in state so it can
// be cleared when the animation ends and re-run on the second nudge.
const hintNudging = ref(false);
let hintNudgeTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.hintNudgeSignal,
  (signal, previous) => {
    if (signal === undefined || previous === undefined || signal <= previous) {
      return;
    }
    if (hintNudgeTimer) clearTimeout(hintNudgeTimer);
    hintNudging.value = true;
    hintNudgeTimer = setTimeout(() => {
      hintNudging.value = false;
      hintNudgeTimer = null;
    }, 3700);
  },
);

const shareBusy = ref(false);
const footerCard = ref<HTMLElement | null>(null);
const feedbackClose = ref<HTMLButtonElement | null>(null);
const feedbackMessage = ref<string | null>(null);
let focusBeforeToast: HTMLElement | null = null;
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

function rememberToastFocus(event: FocusEvent) {
  const previous = event.relatedTarget;
  focusBeforeToast = previous instanceof HTMLElement && previous !== document.body
    ? previous
    : null;
}

async function restoreToastFocus(closeButton: HTMLButtonElement) {
  const previous = focusBeforeToast;
  focusBeforeToast = null;
  await nextTick();
  if (document.activeElement !== closeButton && document.activeElement !== document.body) return;

  const currentTile = footerCard.value?.closest('.board-column')
    ?.querySelector<HTMLElement>('.board-wrapper .tile[tabindex="0"]');
  const footerAction = footerCard.value?.querySelector<HTMLElement>('button:not(:disabled), a[href]');
  for (const target of [previous, currentTile, footerAction]) {
    if (!target?.isConnected || target.matches(':disabled') || !target.getClientRects().length) continue;
    target.focus({ preventScroll: true });
    if (document.activeElement === target) return;
  }
}

function showFeedback(message: string | null, persistent = false) {
  clearTimeout(feedbackTimer);
  feedbackMessage.value = message;
  if (!message) {
    const closeButton = feedbackClose.value;
    if (closeButton && document.activeElement === closeButton) {
      void restoreToastFocus(closeButton);
    }
  } else if (!persistent && !props.practice) {
    feedbackTimer = setTimeout(() => showFeedback(null), 6000);
  }
}

watch(() => props.startInstructionDay, (day) => {
  if (day) showFeedback(UI_COPY.runtime.preRun);
});

watch(() => props.hasMoved, (hasMoved) => {
  if (hasMoved && feedbackMessage.value === UI_COPY.runtime.preRun) {
    showFeedback(null);
  }
});

watch(
  () => [props.hintMessage, props.hintsRemaining] as const,
  ([message]) => {
    if (!props.roadExpired && !props.ended && !props.solved) showFeedback(message);
  },
);

watch(() => props.progressSyncSignal, (signal, previous) => {
  if (signal !== undefined && previous !== undefined && signal > previous) {
    showFeedback(UI_COPY.boardFooter.progressSynced);
  }
}, { flush: 'post' });

watch(() => props.newRoadCheckFeedback, (result) => {
  if (result) showFeedback(result.message);
  else if (feedbackMessage.value === UI_COPY.runtime.nextRoadPublishing) showFeedback(null);
});

onBeforeUnmount(() => {
  if (hintNudgeTimer) clearTimeout(hintNudgeTimer);
  clearTimeout(feedbackTimer);
  if (retryDialog.value?.open) {
    retryDialog.value.close();
    retryConfirmationOpen.value = false;
  }
});

async function onShare() {
  if (!props.shareHandler || shareBusy.value) return;

  shareBusy.value = true;
  try {
    const response = await props.shareHandler();
    showFeedback(response?.message ?? null);
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
  if (props.solveAcknowledgement && props.solved && !props.solvedAfterRollover) {
    return props.solveAcknowledgement;
  }
  if (props.practice && feedbackMessage.value && !props.solved && !props.ended) {
    return feedbackMessage.value;
  }

  switch (footerState.value) {
    case 'resting-first':
    case 'failed':
      return props.practice ? props.status : null;
    // Both solved states carry the next-road ticker — the day's next beat.
    case 'solved-next':
    case 'solved-final':
      if (!props.showNextResetCountdown) return null;
      if (props.newRoadReady) return UI_COPY.boardFooter.newRoadReady;
      if (props.roadExpired) return UI_COPY.runtime.nextRoadPublishing;
      return UI_COPY.boardFooter.nextRoadShort(props.nextResetCountdown);
    default:
      return null;
  }
});

const hintUnavailable = computed(
  () =>
    props.ended ||
    props.solved ||
    props.trackingDisabled ||
    props.roadExpired ||
    props.hintsRemaining === 0,
);

const hintBudget = computed(() =>
  props.hintsRemaining === undefined
    ? null
    : UI_COPY.boardFooter.hintsLeftLabel(props.hintsRemaining),
);
const hintLabel = computed(() =>
  hintBudget.value
    ? `${UI_COPY.boardFooter.openHint}, ${hintBudget.value}`
    : UI_COPY.boardFooter.openHint,
);
const showRetryAction = computed(() => props.canRetry && !props.roadExpired);
const retryIsPrimary = computed(() => footerState.value === 'failed');
const showAttemptCount = computed(() => footerState.value === 'resting-retry');

watch(
  () => [footerState.value, props.status, props.roadExpired, props.solveAcknowledgement] as const,
  ([state, status, expired, acknowledgement], [previous, previousStatus, wasExpired]) => {
    if (props.practice) return;
    if (props.solved && props.solvedAfterRollover && acknowledgement && state !== previous) {
      showFeedback(acknowledgement);
      return;
    }
    if (state === 'failed') {
      if (previous === 'failed' && status === previousStatus && !feedbackMessage.value) return;
      const deadEndAtRollover = expired && status === UI_COPY.runtime.deadEnd;
      showFeedback(deadEndAtRollover ? UI_COPY.runtime.expiredDeadEnd : status, true);
    } else if (expired && !wasExpired && !props.solved) {
      showFeedback(null);
    } else if (previous === 'failed' || props.solved) {
      showFeedback(null);
    }
  },
);

const retryDialog = ref<HTMLDialogElement | null>(null);
const retryButton = ref<HTMLButtonElement | null>(null);
const hintButton = ref<HTMLButtonElement | null>(null);
const rolloverButton = ref<HTMLButtonElement | null>(null);
const retryConfirmationOpen = useRetryConfirmation();
const dialogId = useId();
const needsRetryConfirmation = computed(
  () =>
    showRetryAction.value &&
    props.hasMoved &&
    !props.ended &&
    !props.trackingDisabled &&
    !props.practice,
);

function requestRetry() {
  if (!needsRetryConfirmation.value) {
    emit('retry');
    return;
  }

  const dialog = retryDialog.value;
  if (dialog && !dialog.open) {
    dialog.returnValue = '';
    dialog.showModal();
    retryConfirmationOpen.value = true;
  }
}

function confirmRetry() {
  if (!needsRetryConfirmation.value || retryBusy.value) return;
  retryDialog.value?.close('retry');
  emit('retry');
}

function onRetryDialogClose(event: Event) {
  retryConfirmationOpen.value = false;
  if (event.target instanceof HTMLDialogElement && event.target.returnValue === 'retry') {
    return;
  }
  const button = [retryButton.value, rolloverButton.value, hintButton.value]
    .find((candidate) => candidate && !candidate.disabled);
  button?.focus({ preventScroll: true });
}

watch(needsRetryConfirmation, (needed) => {
  if (!needed) retryDialog.value?.close();
});

const undoTitle = computed(() =>
  props.canUndo
    ? UI_COPY.boardFooter.undoLastStep
    : UI_COPY.boardFooter.undoSpent,
);
const showShareAction = computed(
  () => props.showShare && props.solved && Boolean(props.shareHandler),
);
const showStatsAction = computed(
  () =>
    props.showStatsLink &&
    footerState.value === 'solved-final' &&
    !props.roadExpired,
);
const rolloverAction = computed(() =>
  props.roadExpired && props.showNextResetCountdown
    ? props.newRoadReady
      ? UI_COPY.boardFooter.playNewRoad
      : UI_COPY.boardFooter.checkForNewRoad
    : null,
);
const showSecondaryLink = computed(
  () =>
    Boolean(props.secondaryLinkTo && props.secondaryLinkLabel) &&
    (props.solved || props.ended),
);
const secondaryLinkTo = computed(() => props.secondaryLinkTo ?? '/');
const secondaryLinkLabel = computed(() => props.secondaryLinkLabel ?? '');
watch(
  () => [props.hasGuidePath, props.hasMoved, props.attemptNumber] as const,
  ([hasGuidePath, hasMoved]) => {
    if (
      !props.practice &&
      !props.roadExpired &&
      !props.ended &&
      !props.solved &&
      hasGuidePath &&
      !hasMoved &&
      !props.hintMessage
    ) {
      showFeedback(UI_COPY.boardFooter.followGuide);
    }
  },
);
</script>

<template>
  <section ref="footerCard" class="board-footer-card">
    <div v-if="!solved" class="play-actions">
      <button
        ref="hintButton"
        type="button"
        :class="[
          'action-button',
          'ghost',
          'ghost--hint',
          'play-hint',
          { 'is-pending': hintPending },
          { 'is-nudging': hintNudging && !hintPending },
        ]"
        :disabled="busy || hintPending || hintUnavailable"
        :aria-label="hintLabel"
        :aria-busy="hintPending"
        :title="hintPending ? UI_COPY.boardFooter.hintLoading : hintLabel"
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
        <svg v-else class="hint-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M9 18h6m-5-3.5h4m-7.5-4.7a5.5 5.5 0 1 1 9.2 4.05c-.77.68-1.2 1.28-1.34 2.15H9.64c-.14-.87-.57-1.47-1.34-2.15A5.48 5.48 0 0 1 6.5 9.8Z"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="3"
          />
        </svg>
        <span v-if="hintBudget" class="hint-count" aria-hidden="true">
          {{ hintsRemaining }}
        </span>
      </button>

      <button
        v-if="rolloverAction"
        ref="rolloverButton"
        type="button"
        class="action-button play-retry play-retry--text"
        :class="newRoadReady ? 'primary' : 'secondary'"
        :disabled="busy"
        @click="emit('loadNewRoad')"
      >
        {{ rolloverAction }}
      </button>
      <span v-else-if="showAttemptCount" class="play-attempt" role="status">
        {{ UI_COPY.boardFooter.attemptResting(attemptNumber) }}
      </span>
      <button
        v-else
        ref="retryButton"
        type="button"
        class="action-button play-retry"
        :class="[
          retryIsPrimary && showRetryAction
            ? 'primary action-button--promoted'
            : 'ghost',
          { 'play-retry--text': retryIsPrimary },
        ]"
        :disabled="retryBusy || !showRetryAction"
        :aria-label="UI_COPY.boardFooter.retryRoad"
        :title="UI_COPY.boardFooter.retryRoad"
        @click="requestRetry"
      >
        <svg v-if="!retryIsPrimary" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4.5 11.2a7.5 7.5 0 1 1 2.2 5.3M4.5 11.2V6.5m0 4.7h4.7"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="3"
          />
        </svg>
        <span v-else>{{ UI_COPY.boardFooter.retryRoad }}</span>
      </button>

      <button
        type="button"
        class="action-button ghost play-undo"
        :disabled="busy || !canUndo"
        :aria-label="UI_COPY.boardFooter.undoLastStep"
        :title="undoTitle"
        @click="emit('undo')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4.5 5.5v13M20 12H9m0 0 4.5-4.5M9 12l4.5 4.5"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="3"
          />
        </svg>
      </button>
    </div>

    <div
      v-if="
        showShareAction ||
        showSecondaryLink ||
        showStatsAction ||
        (solved && rolloverAction) ||
        canSwitchToExpedition ||
        $slots.actions
      "
      class="action-row"
    >
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
        v-if="solved && rolloverAction"
        ref="rolloverButton"
        type="button"
        class="action-button action-button--text"
        :class="newRoadReady ? 'primary' : 'secondary'"
        :disabled="busy"
        @click="emit('loadNewRoad')"
      >
        {{ rolloverAction }}
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

    <div
      class="footer-status"
      role="status"
      :aria-live="solved && (!solveAcknowledgement || solvedAfterRollover) ? 'off' : 'polite'"
    >
      <p v-if="footerMessage">{{ footerMessage }}</p>
    </div>

    <Teleport v-if="!practice" to="#teleports">
      <div class="footer-feedback">
        <Transition name="board-toast">
          <div v-if="feedbackMessage" class="feedback-toast">
            <p aria-hidden="true">{{ feedbackMessage }}</p>
            <button
              ref="feedbackClose"
              type="button"
              class="feedback-close"
              :aria-label="UI_COPY.boardFooter.dismissFeedback"
              @focus="rememberToastFocus"
              @click="showFeedback(null)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="m6 6 12 12M18 6 6 18"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
        </Transition>
        <div class="sr-only" role="status">{{ feedbackMessage }}</div>
      </div>
    </Teleport>

    <dialog
      v-if="!practice && !trackingDisabled"
      ref="retryDialog"
      class="retry-dialog"
      :aria-labelledby="`${dialogId}-title`"
      :aria-describedby="`${dialogId}-detail`"
      @close="onRetryDialogClose"
    >
      <h2 :id="`${dialogId}-title`">{{ UI_COPY.boardFooter.confirmRetry }}</h2>
      <p :id="`${dialogId}-detail`">{{ UI_COPY.boardFooter.confirmRetryDetail }}</p>
      <div class="action-row">
        <form method="dialog">
          <button
            type="submit"
            class="action-button secondary action-button--text"
            autofocus
          >
            {{ UI_COPY.boardFooter.keepPlaying }}
          </button>
        </form>
        <button
          type="button"
          class="action-button primary action-button--text"
          @click="confirmRetry"
        >
          {{ UI_COPY.boardFooter.retryRoad }}
        </button>
      </div>
    </dialog>
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
  width: min(100%, 23rem);
  justify-items: center;
  gap: 0.5rem;
  padding: 0.95rem 0 0.2rem;
  text-align: center;
}

.footer-status:empty {
  position: absolute;
}

.footer-status p {
  margin: 0;
  color: var(--color-gold-bright);
  font-size: var(--font-size-board-meta);
  font-weight: 700;
  line-height: var(--line-height-snug);
  font-variant-numeric: tabular-nums;
}

.footer-feedback {
  --toast-slide-offset: 0.75rem;
  position: fixed;
  z-index: 100;
  inset-inline: 0;
  bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
  display: grid;
  justify-items: center;
  padding-inline: 1rem;
  pointer-events: none;
}

.feedback-toast,
.retry-dialog {
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.35);
  box-shadow: var(--shadow-lg);
  color: var(--color-gold-bright);
}

.feedback-toast {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  column-gap: 0.5rem;
  width: min(100%, 27rem);
  min-height: 3.5rem;
  padding: 0.75rem 0.75rem 0.75rem 1.25rem;
  border-radius: var(--radius-lg);
}

.feedback-toast p {
  margin: 0;
  line-height: var(--line-height-snug);
}

.feedback-toast .feedback-close {
  width: 2.75rem;
  height: 2.75rem;
  color: inherit;
  background: transparent;
  pointer-events: auto;
}

.feedback-close svg {
  width: 1.25rem;
  height: 1.25rem;
}

@media (max-height: 700px) {
  .footer-feedback {
    --toast-slide-offset: -0.75rem;
    top: calc(0.75rem + env(safe-area-inset-top, 0px));
    bottom: auto;
  }

  .feedback-toast {
    /* The top toast can cover the header controls. */
    pointer-events: auto;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .board-toast-enter-active,
  .board-toast-leave-active {
    transition: opacity 180ms ease, transform 180ms ease;
  }

  .board-toast-enter-from,
  .board-toast-leave-to {
    opacity: 0;
    transform: translateY(var(--toast-slide-offset));
  }
}

.retry-dialog {
  width: min(24rem, calc(100% - 2rem));
  padding: 1.25rem;
  border-radius: var(--radius-xl);
}

.retry-dialog::backdrop {
  background: rgb(0 0 0 / 0.68);
}

.retry-dialog h2 {
  margin: 0;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  justify-content: center;
  align-items: center;
}

.play-actions {
  --play-button-size: 2.75rem;
  --play-icon-size: 1.5rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(6rem, max-content) minmax(0, 1fr);
  align-items: center;
  width: 100%;
}

.play-actions .action-button {
  width: var(--play-button-size);
  height: var(--play-button-size);
}

.play-actions .action-button svg {
  width: var(--play-icon-size);
  height: var(--play-icon-size);
}

.play-actions .play-hint {
  position: relative;
  justify-self: start;
}

.play-retry,
.play-attempt {
  justify-self: center;
}

.play-attempt {
  display: grid;
  place-items: center;
  min-height: var(--play-button-size);
  color: var(--color-gold-bright);
  font-size: var(--font-size-board-meta);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.play-actions .play-retry--text {
  width: auto;
  min-width: var(--play-button-size);
  padding-inline: 1.25rem;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.play-undo {
  justify-self: end;
}

.hint-count {
  position: absolute;
  inset-block-start: -0.25rem;
  inset-inline-end: -0.3rem;
  display: grid;
  place-items: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding-inline: 0.2rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-gold);
  background: var(--color-gold);
  color: var(--color-text-on-gold);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
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

/* A failed run promotes retry from a quiet icon to a filled, labelled button.
   The state change already carried the message; it just happened in a single
   frame. The delay lets the tile shake land first, so the eye is walked from
   the board to the action rather than being pulled two ways at once.

   Scoped to the retry button by its own class: matching on
   .primary.action-button--text also caught "Play the new road", which then
   bloomed on every render of an expired road. */
.action-button--promoted {
  animation: action-promote 240ms cubic-bezier(0.2, 0.8, 0.2, 1) 140ms
    backwards;
}

@keyframes action-promote {
  from {
    transform: scale(0.9);
    box-shadow: none;
  }
}

/* Keep the labelled button and its neighbours still. Only the bulb reacts: a
   small damped shake as it switches on, followed by a short lit hold. */
.action-button.ghost--hint.is-nudging .hint-icon {
  animation: hint-nudge-shake 760ms ease-out;
}

.action-button.ghost--hint.is-nudging .hint-icon path {
  animation: hint-nudge-light 3500ms ease-in-out;
}

@keyframes hint-nudge-shake {
  0% {
    transform: translateX(0);
  }

  14% {
    transform: translateX(-3px);
  }

  28% {
    transform: translateX(3px);
  }

  42% {
    transform: translateX(-2px);
  }

  56% {
    transform: translateX(1px);
  }

  72%,
  100% {
    transform: translateX(0);
  }
}

@keyframes hint-nudge-light {
  0% {
    fill: transparent;
  }

  20% {
    fill: var(--color-gold-bright);
  }

  40%,
  50% {
    fill: transparent;
  }

  70% {
    fill: var(--color-gold-bright);
  }

  90%,
  100% {
    fill: transparent;
  }
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

.hint-icon {
  transform-box: fill-box;
  transform-origin: center;
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
  .action-row .action-button,
  .action-row .link-button {
    min-height: 2.75rem;
  }

  .play-actions {
    --play-button-size: 3.25rem;
    --play-icon-size: 1.75rem;
  }
}
</style>
