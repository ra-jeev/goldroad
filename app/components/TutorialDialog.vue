<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { TUTORIAL_LESSONS } from '../content/tutorialContent';
import { UI_COPY } from '../content/uiCopy';

const { isTutorialOpen, closeTutorial, completeTutorial } = useTutorialFlow();
const practice = useTutorialPractice();
const COPY = UI_COPY.tutorial;
const step = ref<'guide' | 'practice'>('guide');

const legendItems = computed(() => [
  { label: UI_COPY.board.info.openRoad, type: 'open' as const },
  { label: UI_COPY.board.info.missingRoad, type: 'missing' as const },
  { label: `${UI_COPY.board.info.toll} -${practice.board.tollValue}`, type: 'toll' as const },
  { label: `${UI_COPY.board.info.bonus} +${practice.board.bonusValue}`, type: 'bonus' as const },
]);

function finishTutorial() {
  completeTutorial();
  closeTutorial();
  void navigateTo('/');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeTutorial();
  }
}

watch(isTutorialOpen, (open) => {
  if (open) {
    step.value = 'guide';
  }

  if (!import.meta.client) return;

  if (open) {
    window.addEventListener('keydown', onKeydown);
  } else {
    window.removeEventListener('keydown', onKeydown);
  }
});

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', onKeydown);
  }
});
</script>

<template>
  <div
    v-if="isTutorialOpen"
    class="tutorial-backdrop"
    @click.self="closeTutorial"
  >
    <section
      class="tutorial-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      :aria-label="COPY.ariaLabel"
    >
      <header class="tutorial-top">
        <div>
          <p class="eyebrow">{{ COPY.eyebrow }}</p>
          <h2 id="tutorial-title">{{ COPY.title }}</h2>
        </div>

        <button
          type="button"
          class="tutorial-close"
          :aria-label="COPY.close"
          @click="closeTutorial"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="2"
            />
          </svg>
        </button>
      </header>

      <div class="step-switch" role="tablist" :aria-label="COPY.stepsAriaLabel">
        <button
          id="tutorial-guide-tab"
          type="button"
          :class="{ active: step === 'guide' }"
          :aria-selected="step === 'guide'"
          aria-controls="tutorial-guide-panel"
          role="tab"
          @click="step = 'guide'"
        >
          {{ COPY.guideTab }}
        </button>
        <button
          id="tutorial-practice-tab"
          type="button"
          :class="{ active: step === 'practice' }"
          :aria-selected="step === 'practice'"
          aria-controls="tutorial-practice-panel"
          role="tab"
          @click="step = 'practice'"
        >
          {{ COPY.practiceTab }}
        </button>
      </div>

      <section
        v-if="step === 'guide'"
        id="tutorial-guide-panel"
        class="guide-section"
        role="tabpanel"
        aria-labelledby="tutorial-guide-tab"
      >
        <div class="lesson-grid" :aria-label="COPY.lessonsAriaLabel">
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
          class="tutorial-button tutorial-button--primary"
          @click="step = 'practice'"
        >
          {{ COPY.continueToPractice }}
        </button>
      </section>

      <section
        v-else
        id="tutorial-practice-panel"
        class="practice-section"
        role="tabpanel"
        aria-labelledby="tutorial-practice-tab"
        :aria-label="COPY.practiceAriaLabel"
      >
        <div class="practice-heading">
          <div>
            <p class="eyebrow">{{ COPY.practiceEyebrow }}</p>
            <h3>{{ practice.game.title }}</h3>
          </div>

          <p class="score-line">
            {{ UI_COPY.boardHeader.metrics.score }}
            <strong>{{ practice.score.value }}/{{ practice.maxScore.value }}</strong>
            <span>·</span>
            {{ UI_COPY.boardHeader.metrics.boardCoins }} <strong>{{ practice.totalCoins.value }}</strong>
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

        <div class="legend-row" :aria-label="COPY.roadLegendAriaLabel">
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
          class="tutorial-button tutorial-button--primary"
          @click="finishTutorial"
        >
          {{ COPY.playToday }}
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
  position: relative;
  width: min(100%, 760px);
  max-height: min(92dvh, 900px);
  overflow: auto;
  display: grid;
  gap: 1rem;
  border-radius: var(--radius-lg);
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

.tutorial-top {
  padding-right: 2.6rem;
}

.tutorial-top h2,
.practice-heading h3 {
  margin: 0;
  color: var(--color-gold-bright);
}

.tutorial-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 2.1rem;
  height: 2.1rem;
  display: inline-grid;
  place-items: center;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.22);
  border-radius: var(--radius-circle);
  background: rgb(0 0 0 / 0.28);
  color: rgb(var(--color-gold-rgb) / 0.78);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.tutorial-close svg {
  width: 1.05rem;
  height: 1.05rem;
}

.tutorial-close:hover {
  transform: translateY(-1px);
  color: var(--color-gold-bright);
}

.tutorial-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  padding: 0 1.1rem;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  text-decoration: none;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.tutorial-button--primary {
  color: var(--color-text-on-gold);
  background: var(--gradient-button-primary);
  box-shadow: 0 0 18px rgb(var(--color-gold-rgb) / 0.3);
}

.tutorial-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
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
  background: rgb(var(--color-gold-rgb) / 0.08);
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
  border-radius: var(--radius-md);
  background: rgb(var(--color-gold-rgb) / 0.06);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.14);
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
  border-radius: var(--radius-full);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.22);
  background: rgb(var(--color-gold-rgb) / 0.1);
  color: rgb(var(--color-gold-rgb) / 0.86);
  font-size: 0.78rem;
  font-weight: 800;
}

.legend-road {
  display: inline-grid;
  place-items: center;
  width: 1.7rem;
  height: 1rem;
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
