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
  border-radius: 24px;
  padding: 1rem;
  background: linear-gradient(145deg, #fff6e7 0%, #fff 45%, #eef4ff 100%);
  border: 1px solid #f0d6ad;
  box-shadow: 0 18px 36px rgb(42 54 84 / 12%);
}

.eyebrow {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #9b6b29;
}

.copy h2 {
  margin: 0.25rem 0 0;
  color: #1b2852;
}

.copy p:last-child {
  color: #556688;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.9rem;
}

.summary-grid article {
  border-radius: 16px;
  padding: 0.8rem;
  background: rgb(255 255 255 / 78%);
  border: 1px solid #e8e3d7;
}

.summary-grid span {
  display: block;
  color: #6c7998;
  font-size: 0.82rem;
}

.summary-grid strong {
  display: block;
  margin-top: 0.25rem;
  color: #1b2852;
  font-size: 1.1rem;
}

.actions {
  display: flex;
  gap: 0.65rem;
  margin-top: 1rem;
}

button {
  border: 0;
  border-radius: 14px;
  padding: 0.75rem 1rem;
  font-weight: 700;
  cursor: pointer;
}

.primary {
  color: #fff;
  background: linear-gradient(135deg, #d9480f 0%, #ff7a18 100%);
}

.secondary {
  color: #203158;
  background: #e8efff;
}

button:disabled {
  opacity: 0.6;
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
