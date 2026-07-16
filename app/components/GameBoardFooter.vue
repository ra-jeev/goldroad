<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ShareRoadResultResponse } from '../composables/useRoadResultShare';
import { UI_COPY } from '../content/uiCopy';

const props = withDefaults(
  defineProps<{
    status: string;
    hintMessage: string | null;
    attemptNumber: number;
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

const showShareAction = computed(
  () => props.showShare && props.solved && Boolean(props.shareHandler),
);

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
const footerMessage = computed(() => props.hintMessage ?? props.status);
const showSolvedMeta = computed(() => props.solved);
const retryButtonStyle = computed(() =>
  props.canSwitchToExpedition || showSolvedMeta.value ? 'secondary' : 'primary',
);
const showStatsLink = computed(
  () =>
    props.showStatsLink && showSolvedMeta.value && !props.canSwitchToExpedition,
);
const showAttemptPill = computed(
  () =>
    props.attemptNumber > 1 && !showSolvedMeta.value && !props.trackingDisabled,
);
const showHintAction = computed(
  () => !props.ended && !props.solved && !props.trackingDisabled,
);
const showSecondaryLink = computed(() =>
  Boolean(props.secondaryLinkTo && props.secondaryLinkLabel),
);
const secondaryLinkTo = computed(() => props.secondaryLinkTo ?? '/');
const secondaryLinkLabel = computed(() => props.secondaryLinkLabel ?? '');
const resultLine = computed(() => {
  if (!showSolvedMeta.value) {
    return footerMessage.value;
  }

  if (props.canSwitchToExpedition || !props.showNextResetCountdown) {
    return null;
  }

  return UI_COPY.boardFooter.nextRoadShort(props.nextResetCountdown);
});
const showFooterMessage = computed(() => Boolean(resultLine.value));
</script>

<template>
  <section
    class="board-footer-card"
    :class="{ 'board-footer-card--actions-only': !showFooterMessage }"
  >
    <div v-if="showFooterMessage" class="footer-top">
      <div class="footer-copy">
        <p class="footer-message">{{ resultLine }}</p>
      </div>

      <span v-if="showAttemptPill" class="attempt-pill">
        {{ UI_COPY.boardFooter.attemptLabel }} #{{ attemptNumber }}
      </span>
    </div>

    <div class="action-row">
      <button
        v-if="showHintAction"
        type="button"
        class="action-button ghost ghost--hint action-button--text"
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
        {{ UI_COPY.boardFooter.openHint }}
      </button>

      <button
        v-if="canRetry"
        type="button"
        :class="[
          'action-button',
          retryButtonStyle,
          { 'action-button--text': ended && !solved },
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
        <span v-if="ended && !solved">{{ UI_COPY.boardFooter.retryRoad }}</span>
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
        class="link-button secondary"
      >
        {{ secondaryLinkLabel }}
      </NuxtLink>

      <NuxtLink
        v-if="showStatsLink"
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

    <p
      v-if="shareMessage"
      class="share-message"
      role="status"
      aria-live="polite"
    >
      {{ shareMessage }}
    </p>
  </section>
</template>

<style scoped>
.board-footer-card {
  display: grid;
  justify-items: center;
  gap: 0.62rem;
  min-height: 2.9rem;
  padding: 0.2rem 0;
  text-align: center;
}

.board-footer-card--actions-only {
  min-height: 2.35rem;
}

.footer-message {
  margin: 0;
  color: var(--color-gold-bright);
  font-size: 1rem;
  font-weight: 650;
  line-height: var(--line-height-snug);
}

.footer-copy {
  display: grid;
  gap: 0.25rem;
  justify-items: center;
}

.footer-top {
  display: grid;
  justify-items: center;
  gap: 0.48rem;
  min-width: 0;
}

.share-message {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: rgb(var(--color-gold-rgb) / 0.7);
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
