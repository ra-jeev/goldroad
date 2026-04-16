<script setup lang="ts">
import { computed, ref } from 'vue'
import { UI_COPY } from '../content/uiCopy'

const props = defineProps<{
  status: string
  hintMessage: string | null
  attemptNumber: number
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
const showHelp = ref(false)

const busy = computed(() => props.loading || props.submitting)
const footerMessage = computed(() => props.hintMessage ?? props.status)

function requestHint(level: 1 | 2 | 3) {
  showHints.value = false
  emit('hint', level)
}
</script>

<template>
  <section class="board-footer-card">
    <div class="footer-top">
      <p class="footer-message">{{ footerMessage }}</p>
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
        :class="canSwitchToExpedition ? 'secondary' : 'primary'"
        :disabled="busy"
        @click="emit('retry')"
      >
        {{ UI_COPY.boardFooter.retryRoad }}
      </button>

      <button
        v-if="!ended"
        type="button"
        class="ghost"
        :disabled="busy"
        @click="showHints = true"
      >
        {{ UI_COPY.boardFooter.openHint }}
      </button>

      <button type="button" class="ghost" @click="showHelp = true">
        {{ UI_COPY.boardFooter.openHelp }}
      </button>
    </div>

    <div v-if="showHints || showHelp" class="sheet-backdrop" @click.self="showHints = false; showHelp = false">
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

      <section v-if="showHelp" class="sheet-card" aria-label="How to play">
        <div class="sheet-header">
          <h2>{{ UI_COPY.boardFooter.helpTitle }}</h2>
          <button type="button" class="close-button" @click="showHelp = false">
            {{ UI_COPY.sidebar.close }}
          </button>
        </div>

        <article class="help-section">
          <h3>{{ UI_COPY.helpSheet.sections.howToPlay.title }}</h3>
          <ul>
            <li v-for="item in UI_COPY.helpSheet.sections.howToPlay.items" :key="item">{{ item }}</li>
          </ul>
        </article>

        <article class="help-section">
          <h3>{{ UI_COPY.helpSheet.sections.about.title }}</h3>
          <p>{{ UI_COPY.helpSheet.sections.about.body }}</p>
        </article>

        <article class="help-section">
          <h3>{{ UI_COPY.helpSheet.sections.updates.title }}</h3>
          <ul>
            <li v-for="item in UI_COPY.helpSheet.sections.updates.items" :key="item">{{ item }}</li>
          </ul>
        </article>
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

.footer-top {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 0.8rem;
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

button {
  border: 0;
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
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

button:hover:not(:disabled) {
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

.hint-buttons small,
.help-section p,
.help-section li {
  color: rgb(var(--color-gold-rgb) / 0.84);
}

.help-section {
  margin-top: 1rem;
}

.help-section ul {
  margin: 0.6rem 0 0;
  padding-left: 1.1rem;
}

.help-section p {
  margin: 0.6rem 0 0;
  line-height: var(--line-height-base);
}

@media (max-width: 760px) {
  .footer-top,
  .action-row {
    display: grid;
  }
}
</style>