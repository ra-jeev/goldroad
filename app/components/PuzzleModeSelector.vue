<script setup lang="ts">
import { UI_COPY } from '../content/uiCopy'
import type { PuzzleType } from '../../shared/types/game'

interface GameInfo {
  gameNo: number
  puzzleType: PuzzleType
}

defineProps<{
  classicGame: GameInfo | null
  expeditionGame: GameInfo | null
  isExpeditionUnlocked: boolean
  classicCompleted: boolean
}>()

const emit = defineEmits<{
  select: [mode: PuzzleType]
  close: []
}>()
</script>

<template>
  <div class="mode-selector-backdrop" @click.self="emit('close')">
    <section class="mode-selector-card">
      <header class="selector-header">
        <h2>{{ UI_COPY.modeSelector.heading }}</h2>
      </header>

      <div class="mode-cards">
        <article
          class="mode-card classic"
          :class="{ completed: classicCompleted }"
        >
          <div class="mode-card-header">
            <h3>{{ UI_COPY.modeSelector.classicTitle }}</h3>
            <span v-if="classicGame" class="mode-game-no">Road {{ classicGame.gameNo }}</span>
          </div>

          <div class="mode-card-status">
            <span v-if="classicCompleted" class="status-badge completed">
              ✓ {{ UI_COPY.modeSelector.completedLabel }}
            </span>
          </div>

          <button
            v-if="classicGame"
            class="mode-button primary"
            @click="emit('select', 'classic')"
          >
            {{ classicCompleted ? UI_COPY.modeSelector.replayButton : UI_COPY.modeSelector.playButton }}
          </button>
        </article>

        <article
          class="mode-card expedition"
          :class="{ locked: !isExpeditionUnlocked, unlocked: isExpeditionUnlocked }"
        >
          <div class="mode-card-header">
            <h3>{{ UI_COPY.modeSelector.expeditionTitle }}</h3>
            <span v-if="expeditionGame" class="mode-game-no">Road {{ expeditionGame.gameNo }}</span>
          </div>

          <div class="mode-card-status">
            <span v-if="!isExpeditionUnlocked" class="status-badge locked">
              🔒 {{ UI_COPY.modeSelector.lockedLabel }}
            </span>
            <span v-else class="status-badge unlocked">
              {{ UI_COPY.modeSelector.unlockedLabel }}
            </span>
          </div>

          <button
            v-if="expeditionGame"
            class="mode-button primary"
            :disabled="!isExpeditionUnlocked"
            @click="emit('select', 'expedition')"
          >
            {{ UI_COPY.modeSelector.playButton }}
          </button>
        </article>
      </div>

      <p v-if="!isExpeditionUnlocked" class="unlock-hint">
        {{ UI_COPY.modeSelector.unlockHint }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.mode-selector-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(0 0 0 / 0.7);
  backdrop-filter: blur(6px);
  animation: fade-in var(--transition-base) both;
}

.mode-selector-card {
  width: min(100%, 640px);
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  background: var(--gradient-card-overlay);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.4);
  box-shadow: var(--shadow-2xl);
  animation: rise-in var(--transition-slow) both;
}

.selector-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.selector-header h2 {
  margin: 0;
  font-size: var(--font-size-3xl);
  color: var(--color-gold);
  letter-spacing: var(--letter-spacing-tight);
}

.mode-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.mode-card {
  position: relative;
  border-radius: var(--radius-lg);
  padding: 1.3rem;
  background: var(--gradient-card-status);
  border: 2px solid rgb(var(--color-gold-rgb) / 0.35);
  transition: all var(--transition-base);
}

.mode-card.classic {
  border-color: rgb(160 90 0 / 0.5);
}

.mode-card.expedition {
  border-color: rgb(0 90 120 / 0.5);
}

.mode-card.locked {
  opacity: 0.6;
}

.mode-card.unlocked {
  border-color: rgb(0 180 200 / 0.6);
  box-shadow: 0 0 20px rgb(0 180 200 / 0.2);
}

.mode-card:not(.locked):hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.mode-card-header {
  margin-bottom: 0.8rem;
}

.mode-card-header h3 {
  margin: 0 0 0.3rem;
  font-size: var(--font-size-2xl);
  color: var(--color-gold);
  letter-spacing: var(--letter-spacing-tight);
}

.mode-game-no {
  display: block;
  font-size: var(--font-size-base);
  color: rgb(var(--color-gold-rgb) / 0.75);
}

.mode-card-status {
  min-height: 2rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
}

.status-badge {
  display: inline-block;
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.status-badge.completed {
  background: rgb(var(--color-gold-rgb) / 0.2);
  color: var(--color-gold);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.4);
}

.status-badge.locked {
  background: rgb(139 69 19 / 0.2);
  color: rgb(205 127 50);
  border: 1px solid rgb(139 69 19 / 0.4);
}

.status-badge.unlocked {
  background: rgb(0 180 200 / 0.2);
  color: rgb(0 220 240);
  border: 1px solid rgb(0 180 200 / 0.4);
  animation: pulse-glow 2s ease-in-out infinite;
}

.mode-button {
  width: 100%;
  border: 0;
  border-radius: var(--radius-sm);
  padding: 0.85rem 1.2rem;
  font-weight: 700;
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.mode-button.primary {
  background: var(--gradient-button-primary);
  color: var(--color-text-on-gold);
  border: 1px solid rgb(var(--color-gold-dark-rgb) / 0.6);
}

.mode-button.primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow-gold-soft);
}

.mode-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.unlock-hint {
  margin: 1rem 0 0;
  text-align: center;
  color: rgb(var(--color-gold-rgb) / 0.8);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 8px rgb(0 180 200 / 0.3);
  }
  50% {
    box-shadow: 0 0 16px rgb(0 180 200 / 0.5);
  }
}

@media (max-width: 640px) {
  .mode-cards {
    grid-template-columns: 1fr;
  }

  .selector-header h2 {
    font-size: var(--font-size-2xl);
  }
}
</style>
