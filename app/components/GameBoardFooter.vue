<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Medal } from '../../shared/types/game'
import { UI_COPY } from '../content/uiCopy'

const props = defineProps<{
  status: string
  hintMessage: string | null
  attemptNumber: number
  medal: Medal | null
  nextResetCountdown: string
  expeditionJustUnlocked: boolean
  hintUsage: {
    level1: number
    level2: number
    level3: number
  }
  ended: boolean
  solved: boolean
  canRetry: boolean
  canSwitchToExpedition: boolean
  loading: boolean
  submitting: boolean
}>()

const emit = defineEmits<{
  hint: [level: 1 | 2 | 3]
  retry: []
  switchExpedition: []
}>()

const showHints = ref(false)
const { openHowToPlay } = useHowToPlaySheet()

const busy = computed(() => props.loading || props.submitting)
const footerMessage = computed(() => props.hintMessage ?? props.status)
const showSolvedMeta = computed(() => props.ended && props.solved)
const retryButtonStyle = computed(() => (props.canSwitchToExpedition || showSolvedMeta.value ? 'secondary' : 'primary'))

function requestHint(level: 1 | 2 | 3) {
  showHints.value = false
  emit('hint', level)
}
</script>

<template>
  <section class="board-footer-card">
    <div class="footer-top">
      <div class="footer-copy">
        <p class="footer-message">{{ footerMessage }}</p>

        <div v-if="showSolvedMeta" class="meta-row">
          <span v-if="medal" class="meta-pill">
            {{ UI_COPY.boardFooter.medalAwarded(UI_COPY.boardHeader.medals[medal]) }}
          </span>
          <span class="meta-pill meta-pill--countdown">
            {{ UI_COPY.boardFooter.nextRoadCountdown(nextResetCountdown) }}
          </span>
          <span v-if="expeditionJustUnlocked" class="meta-pill meta-pill--accent">
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
        class="ghost"
        :disabled="busy"
        @click="showHints = true"
      >
        {{ UI_COPY.boardFooter.openHint }}
      </button>

      <button type="button" class="ghost" @click="openHowToPlay()">
        {{ UI_COPY.boardFooter.openHelp }}
      </button>
    </div>

    <div v-if="showHints" class="sheet-backdrop" @click.self="showHints = false">
      <section v-if="showHints" class="sheet-card" aria-label="Hints">
        <div class="sheet-header">
          <h2>{{ UI_COPY.boardFooter.hintTitle }}</h2>
          <button type="button" class="close-button" @click="showHints = false">
            {{ UI_COPY.sidebar.close }}
          </button>
        </div>

        <div class="hint-buttons">
          <button type="button" class="secondary" :disabled="busy" @click="requestHint(1)">
            <span>{{ UI_COPY.boardFooter.hintRows.level1Title }}</span>
            <small>{{ UI_COPY.boardFooter.hintRows.level1Desc }} · Used {{ hintUsage.level1 }}</small>
          </button>
          <button type="button" class="secondary" :disabled="busy" @click="requestHint(2)">
            <span>{{ UI_COPY.boardFooter.hintRows.level2Title }}</span>
            <small>{{ UI_COPY.boardFooter.hintRows.level2Desc }} · Used {{ hintUsage.level2 }}</small>
          </button>
          <button type="button" class="secondary" :disabled="busy" @click="requestHint(3)">
            <span>{{ UI_COPY.boardFooter.hintRows.level3Title }}</span>
            <small>{{ UI_COPY.boardFooter.hintRows.level3Desc }} · Used {{ hintUsage.level3 }}</small>
          </button>
        </div>
      </section>
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
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
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
.ghost,
.close-button {
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

.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(0 0 0 / 0.6);
  backdrop-filter: blur(4px);
}

.sheet-card {
  width: min(100%, 520px);
  max-height: min(80dvh, 680px);
  overflow: auto;
  border-radius: var(--radius-lg);
  padding: 1rem;
  background: var(--gradient-card-overlay);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.35);
  box-shadow: var(--shadow-xl);
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
}

.sheet-header h2,
.help-section h3 {
  margin: 0;
  color: var(--color-gold);
}

.hint-buttons {
  display: grid;
  gap: 0.6rem;
  margin-top: 0.9rem;
}

.hint-buttons button {
  display: grid;
  gap: 0.22rem;
  text-align: left;
}

.hint-buttons small {
  color: rgb(var(--color-gold-rgb) / 0.84);
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