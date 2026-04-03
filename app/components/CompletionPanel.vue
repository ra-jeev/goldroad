<script setup lang="ts">
import type { OutcomeTier } from '../../shared/types/game'

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

const tierLabel: Record<OutcomeTier, string> = {
  gold: 'Perfect route',
  silver: 'Excellent route',
  bronze: 'Strong route',
  finished: 'Finished route',
  unfinished: 'Unfinished route',
}
</script>

<template>
  <section v-if="visible" class="completion-panel">
    <div class="copy">
      <p class="eyebrow">Run Complete</p>
      <h2>{{ tier ? tierLabel[tier] : 'Road complete' }}</h2>
      <p>{{ status }}</p>
    </div>

    <div class="summary-grid">
      <article>
        <span>Final score</span>
        <strong>{{ score }}</strong>
      </article>
      <article>
        <span>Gold target</span>
        <strong>{{ maxScore }}</strong>
      </article>
      <article>
        <span>Moves</span>
        <strong>{{ moves }}</strong>
      </article>
      <article>
        <span>Outcome</span>
        <strong>{{ tier ?? '—' }}</strong>
      </article>
    </div>

    <div class="actions">
      <button class="primary" :disabled="submitting" @click="emit('another')">Play Another</button>
      <button class="secondary" :disabled="submitting" @click="emit('today')">Reload Today</button>
    </div>
  </section>
</template>

<style scoped>
.completion-panel {
  border-radius: 26px;
  padding: 1.05rem;
  background:
    radial-gradient(ellipse 90% 70% at 10% 0%, rgb(218 165 32 / 12%) 0%, transparent 55%),
    linear-gradient(160deg, #1e1407 0%, #150e04 100%);
  border: 1px solid rgb(218 165 32 / 28%);
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 45%),
    0 24px 48px rgb(0 0 0 / 44%),
    inset 0 1px 0 rgb(218 165 32 / 8%);
}

.eyebrow {
  margin: 0;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgb(218 165 32 / 60%);
}

.copy h2 {
  margin: 0.25rem 0 0;
  color: goldenrod;
  letter-spacing: 0.01em;
}

.copy p:last-child {
  color: rgb(218 165 32 / 55%);
  line-height: 1.42;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.9rem;
}

.summary-grid article {
  border-radius: 18px;
  padding: 0.8rem;
  background: rgb(218 165 32 / 8%);
  border: 1px solid rgb(218 165 32 / 18%);
}

.summary-grid span {
  display: block;
  color: rgb(218 165 32 / 55%);
  font-size: 0.82rem;
}

.summary-grid strong {
  display: block;
  margin-top: 0.25rem;
  color: goldenrod;
  font-size: 1.16rem;
}

.actions {
  display: flex;
  gap: 0.65rem;
  margin-top: 1rem;
}

button {
  border: 0;
  border-radius: 15px;
  padding: 0.75rem 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 140ms ease, box-shadow 140ms ease;
}

.primary {
  color: #1a0e00;
  background: linear-gradient(135deg, goldenrod 0%, #b8860b 100%);
  box-shadow: 0 0 18px rgb(218 165 32 / 35%);
}

.secondary {
  color: goldenrod;
  background: rgb(218 165 32 / 12%);
  border: 1px solid rgb(218 165 32 / 28%);
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgb(0 0 0 / 40%);
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
