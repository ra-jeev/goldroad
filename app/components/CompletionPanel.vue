<script setup lang="ts">
import type { OutcomeTier } from '../../shared/types/game'
import { UI_COPY } from '../content/uiCopy'

defineProps<{
  visible: boolean
  tier: OutcomeTier | null
  score: number
  maxScore: number
  moves: number
  status: string
  submitting: boolean
}>()

const emit = defineEmits<{
  another: []
  today: []
}>()

const tierLabel: Record<OutcomeTier, string> = UI_COPY.completion.tiers
</script>

<template>
  <section v-if="visible" class="completion-panel">
    <div class="copy">
      <p class="eyebrow">{{ UI_COPY.completion.eyebrow }}</p>
      <h2>{{ tier ? tierLabel[tier] : UI_COPY.completion.headingFallback }}</h2>
      <p>{{ status }}</p>
    </div>

    <div class="summary-grid">
      <article>
        <span>{{ UI_COPY.completion.labels.finalScore }}</span>
        <strong>{{ score }}</strong>
      </article>
      <article>
        <span>{{ UI_COPY.completion.labels.goldTarget }}</span>
        <strong>{{ maxScore }}</strong>
      </article>
      <article>
        <span>{{ UI_COPY.completion.labels.moves }}</span>
        <strong>{{ moves }}</strong>
      </article>
      <article>
        <span>{{ UI_COPY.completion.labels.outcome }}</span>
        <strong>{{ tier ?? '—' }}</strong>
      </article>
    </div>

    <div class="actions">
      <button class="primary" :disabled="submitting" @click="emit('another')">{{ UI_COPY.completion.labels.playAnother }}</button>
      <button class="secondary" :disabled="submitting" @click="emit('today')">{{ UI_COPY.completion.labels.reloadToday }}</button>
    </div>
  </section>
</template>

<style scoped>
.completion-panel {
  border-radius: var(--radius-xl);
  padding: 1.05rem;
  background: var(--gradient-card-completion);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.42);
  box-shadow:
    var(--shadow-border-dark),
    var(--shadow-xl),
    var(--shadow-inset-gold);
}

.copy h2 {
  margin: 0.25rem 0 0;
  color: var(--color-gold);
  letter-spacing: var(--letter-spacing-tight);
}

.copy p:last-child {
  color: rgb(var(--color-gold-rgb) / 0.85);
  line-height: var(--line-height-snug);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.9rem;
}

.summary-grid article {
  border-radius: var(--radius-md);
  padding: 0.8rem;
  background: rgb(var(--color-gold-rgb) / 0.10);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.35);
}

.summary-grid span {
  display: block;
  color: rgb(var(--color-gold-rgb) / 0.88);
  font-size: var(--font-size-base);
}

.summary-grid strong {
  display: block;
  margin-top: 0.25rem;
  color: var(--color-gold);
  font-size: 1.16rem;
}

.actions {
  display: flex;
  gap: 0.65rem;
  margin-top: 1rem;
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
  box-shadow: 0 0 18px rgb(var(--color-gold-rgb) / 0.35);
}

.secondary {
  color: var(--color-gold);
  background: rgb(var(--color-gold-rgb) / 0.15);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.38);
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 760px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .actions {
    flex-direction: column;
  }
}
</style>
