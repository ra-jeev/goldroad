<script setup lang="ts">
import { TUTORIAL_LESSONS } from '../content/tutorialContent';

const { isTutorialOpen, closeTutorial, completeTutorial } = useTutorialFlow();
const practice = useTutorialPractice();
const step = ref<'guide' | 'practice'>('guide');

const legendItems = computed(() => [
  { label: 'Open road', type: 'open' as const },
  { label: 'Missing road', type: 'missing' as const },
  { label: `Toll -${practice.board.tollValue}`, type: 'toll' as const },
  { label: `Bonus +${practice.board.bonusValue}`, type: 'bonus' as const },
]);

function finishTutorial() {
  completeTutorial();
  closeTutorial();
  void navigateTo('/');
}

watch(isTutorialOpen, (open) => {
  if (open) {
    step.value = 'guide';
  }
});
</script>

<template>
  <div
    v-if="isTutorialOpen"
    class="tutorial-backdrop"
    @click.self="closeTutorial"
  >
    <section class="tutorial-panel" aria-label="GoldRoad tutorial">
      <header class="tutorial-top">
        <div>
          <p class="eyebrow">Tutorial</p>
          <h2>Learn the road</h2>
        </div>

        <button type="button" class="close-button" @click="closeTutorial">
          Close
        </button>
      </header>

      <div class="step-switch" role="tablist" aria-label="Tutorial steps">
        <button
          type="button"
          :class="{ active: step === 'guide' }"
          :aria-selected="step === 'guide'"
          role="tab"
          @click="step = 'guide'"
        >
          1. Guide
        </button>
        <button
          type="button"
          :class="{ active: step === 'practice' }"
          :aria-selected="step === 'practice'"
          role="tab"
          @click="step = 'practice'"
        >
          2. Practice
        </button>
      </div>

      <section v-if="step === 'guide'" class="guide-section">
        <div class="lesson-grid" aria-label="Tutorial steps">
          <article
            v-for="lesson in TUTORIAL_LESSONS"
            :key="lesson.id"
            class="lesson-card"
          >
            <TutorialMiniBoard
              :from-value="lesson.visual.fromValue"
              :to-value="lesson.visual.toValue"
              :edge-type="lesson.visual.edgeType"
              :is-start="lesson.visual.isStart"
              :is-end="lesson.visual.isEnd"
              :modifier-label="lesson.visual.modifierLabel"
            />

            <div>
              <h3>{{ lesson.title }}</h3>
              <p>{{ lesson.body }}</p>
            </div>
          </article>
        </div>

        <button
          type="button"
          class="continue-button"
          @click="step = 'practice'"
        >
          Try a practice road
        </button>
      </section>

      <section v-else class="practice-section" aria-label="Practice puzzle">
        <div class="practice-heading">
          <div>
            <p class="eyebrow">Practice</p>
            <h3>{{ practice.game.title }}</h3>
          </div>

          <p class="score-line">
            Score
            <strong>{{ practice.score.value }}/{{ practice.maxScore.value }}</strong>
            <span>·</span>
            Board Coins <strong>{{ practice.totalCoins.value }}</strong>
          </p>
        </div>

        <GameBoard
          :board="practice.board"
          puzzle-type="expedition"
          :tiles="practice.tiles.value"
          :current-tile-index="practice.currentTileIndex.value"
          :active-set="practice.activeSet.value"
          :visited-set="practice.visited.value"
          :hinted-tiles="practice.hintedTiles.value"
          :path-history="practice.pathHistory.value"
          :disabled="practice.ended.value"
          @select="practice.moveTo"
        />

        <div class="legend-row" aria-label="Road legend">
          <div
            v-for="item in legendItems"
            :key="item.label"
            class="legend-item"
          >
            <span class="legend-road">
              <RoadGlyph :type="item.type" state="default" />
            </span>
            <span>{{ item.label }}</span>
          </div>
        </div>

        <GameBoardFooter
          :status="practice.status.value"
          :hint-message="practice.hintMessage.value"
          :attempt-number="1"
          :medal="null"
          :show-next-reset-countdown="false"
          :show-stats-link="false"
          :expedition-just-unlocked="false"
          :hints-used="practice.hintsUsed.value"
          :ended="practice.ended.value"
          :solved="practice.solved.value"
          :can-retry="practice.canRetry.value"
          :can-switch-to-expedition="false"
          :loading="false"
          :submitting="false"
          @retry="practice.retryPractice"
          @hint="practice.requestHint"
        />

        <button
          v-if="practice.solved.value"
          type="button"
          class="play-button"
          @click="finishTutorial"
        >
          Play today
        </button>
      </section>
    </section>
  </div>
</template>

<style scoped>
.tutorial-backdrop {
  position: fixed;
  inset: 0;
  z-index: 130;
  display: grid;
  place-items: center;
  padding: clamp(0rem, 2vw, 1rem);
  background: rgb(0 0 0 / 0.68);
  backdrop-filter: blur(6px);
}

.tutorial-panel {
  width: min(100%, 760px);
  max-height: min(92dvh, 900px);
  overflow: auto;
  display: grid;
  gap: 1rem;
  border-radius: 8px;
  padding: clamp(0.9rem, 2.5vw, 1.25rem);
  background: var(--gradient-card-overlay);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.32);
  box-shadow: var(--shadow-xl);
}

.tutorial-top,
.practice-heading {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 1rem;
}

.tutorial-top h2,
.practice-heading h3 {
  margin: 0;
  color: var(--color-gold-bright);
}

.close-button,
.continue-button,
.play-button {
  border: 1px solid rgb(var(--color-gold-rgb) / 0.3);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.9rem;
  color: var(--color-gold-bright);
  background: rgb(var(--color-gold-rgb) / 0.13);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.lesson-grid {
  display: grid;
  gap: 0.75rem;
}

.guide-section {
  display: grid;
  justify-items: center;
  gap: 1rem;
}

.step-switch {
  justify-self: center;
  display: inline-grid;
  grid-auto-flow: column;
  padding: 0.16rem;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.22);
  border-radius: var(--radius-full);
  background: rgb(0 0 0 / 0.24);
}

.step-switch button {
  min-height: 1.9rem;
  border: 0;
  border-radius: var(--radius-full);
  padding: 0.32rem 0.8rem;
  background: transparent;
  color: rgb(var(--color-gold-rgb) / 0.62);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.step-switch button.active {
  background: rgb(var(--color-gold-rgb) / 0.18);
  color: var(--color-gold);
}

.lesson-card {
  display: grid;
  grid-template-columns: minmax(9.5rem, auto) 1fr;
  align-items: center;
  gap: 0.9rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: rgb(0 0 0 / 0.18);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
}

.lesson-card h3 {
  margin: 0;
  color: var(--color-gold);
  font-size: 1rem;
}

.lesson-card p,
.practice-message,
.score-line {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.8);
  line-height: var(--line-height-base);
}

.practice-section {
  display: grid;
  justify-items: center;
  gap: 0.7rem;
  padding-top: 0.25rem;
}

.practice-heading {
  width: min(100%, 620px);
  align-items: end;
}

.score-line {
  font-weight: 800;
}

.score-line strong {
  color: var(--color-gold-bright);
}

.score-line span {
  margin: 0 0.4rem;
  color: rgb(var(--color-gold-rgb) / 0.4);
}

.practice-message {
  min-height: 2.7rem;
  width: min(100%, 620px);
  text-align: center;
}

.legend-row {
  width: min(100%, 620px);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.32rem 0.5rem;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
  background: rgb(0 0 0 / 0.16);
  color: rgb(var(--color-gold-rgb) / 0.8);
  font-size: 0.78rem;
  font-weight: 800;
}

.legend-road {
  display: inline-grid;
  place-items: center;
  width: 1.7rem;
  height: 1rem;
}

.continue-button,
.play-button {
  background: rgb(var(--color-gold-rgb) / 0.2);
}

@media (max-width: 760px) {
  .tutorial-backdrop {
    align-items: stretch;
    padding: 0;
  }

  .tutorial-panel {
    width: 100%;
    max-height: 100dvh;
    min-height: 100dvh;
    border-radius: 0;
    border-inline: 0;
  }

  .tutorial-top,
  .practice-heading,
  .lesson-card {
    display: grid;
    justify-items: center;
    text-align: center;
  }

  .lesson-card {
    grid-template-columns: 1fr;
  }
}
</style>
