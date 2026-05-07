<script setup lang="ts">
import { computed } from 'vue';
import type { Medal } from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';

const props = defineProps<{
  status: string;
  hintMessage: string | null;
  attemptNumber: number;
  medal: Medal | null;
  nextResetCountdown: string;
  expeditionJustUnlocked: boolean;
  hintsUsed: number;
  ended: boolean;
  solved: boolean;
  canRetry: boolean;
  canSwitchToExpedition: boolean;
  loading: boolean;
  submitting: boolean;
}>();

const emit = defineEmits<{
  hint: [];
  retry: [];
  switchExpedition: [];
}>();

const { openHowToPlay } = useHowToPlaySheet();

const busy = computed(() => props.loading || props.submitting);
const footerMessage = computed(() => props.hintMessage ?? props.status);
const showSolvedMeta = computed(() => props.ended && props.solved);
const retryButtonStyle = computed(() =>
  props.canSwitchToExpedition || showSolvedMeta.value ? 'secondary' : 'primary',
);
</script>

<template>
  <section class="board-footer-card">
    <div class="footer-top">
      <div class="footer-copy">
        <p class="footer-message">{{ footerMessage }}</p>

        <div v-if="showSolvedMeta" class="meta-row">
          <span v-if="medal" class="meta-pill">
            {{
              UI_COPY.boardFooter.medalAwarded(
                UI_COPY.boardHeader.medals[medal],
              )
            }}
          </span>
          <span class="meta-pill meta-pill--countdown">
            {{ UI_COPY.boardFooter.nextRoadCountdown(nextResetCountdown) }}
          </span>
          <span
            v-if="expeditionJustUnlocked"
            class="meta-pill meta-pill--accent"
          >
            {{ UI_COPY.boardFooter.expeditionUnlocked }}
          </span>
        </div>
      </div>

      <span v-if="attemptNumber > 1" class="attempt-pill">
        {{ UI_COPY.boardFooter.attemptLabel }} #{{ attemptNumber }}
      </span>
    </div>

    <div class="action-row">
      <button
        v-if="canSwitchToExpedition"
        type="button"
        class="primary"
        :disabled="busy"
        @click="emit('switchExpedition')"
      >
        {{ UI_COPY.boardFooter.switchToExpedition }}
      </button>

      <button
        v-if="canRetry"
        type="button"
        :class="retryButtonStyle"
        :disabled="busy"
        @click="emit('retry')"
      >
        {{ UI_COPY.boardFooter.retryRoad }}
      </button>

      <NuxtLink
        v-if="showSolvedMeta && !canSwitchToExpedition"
        to="/stats"
        class="link-button primary"
      >
        {{ UI_COPY.boardFooter.viewStats }}
      </NuxtLink>

      <button
        v-if="!ended"
        type="button"
        class="ghost ghost--hint"
        :disabled="busy"
        @click="emit('hint')"
      >
        <span>{{ UI_COPY.boardFooter.openHint }}</span>
        <small>{{ UI_COPY.boardFooter.hintUsedLabel(hintsUsed) }}</small>
      </button>

      <button type="button" class="ghost" @click="openHowToPlay()">
        {{ UI_COPY.boardFooter.openHelp }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.board-footer-card {
  display: grid;
  gap: 0.8rem;
  padding: 0.9rem 1rem;
  border-radius: var(--radius-xl);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.28);
  box-shadow: var(--shadow-border-dark), var(--shadow-lg);
}

.footer-message {
  margin: 0;
  color: var(--color-gold-bright);
  line-height: var(--line-height-snug);
}

.footer-copy {
  display: grid;
  gap: 0.55rem;
}

.footer-top {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 0.8rem;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.meta-pill {
  padding: 0.24rem 0.55rem;
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.12);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.24);
  color: rgb(var(--color-gold-rgb) / 0.9);
  font-size: 0.8rem;
  font-weight: 700;
}

.meta-pill--countdown {
  color: rgb(var(--color-gold-rgb) / 0.82);
}

.meta-pill--accent {
  color: var(--color-active);
  border-color: rgb(var(--color-active-rgb) / 0.35);
  background: rgb(var(--color-active-rgb) / 0.14);
}

.attempt-pill {
  flex-shrink: 0;
  padding: 0.25rem 0.55rem;
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.12);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.24);
  color: rgb(var(--color-gold-rgb) / 0.84);
  font-size: 0.8rem;
  font-weight: 700;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

button,
.link-button {
  border: 0;
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

.ghost--hint {
  display: grid;
  gap: 0.15rem;
  text-align: left;
}

.ghost--hint small {
  color: rgb(var(--color-gold-rgb) / 0.74);
  font-size: 0.72rem;
  font-weight: 600;
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
  .footer-top,
  .action-row {
    display: grid;
  }

  .meta-row {
    gap: 0.35rem;
  }
}
</style>
