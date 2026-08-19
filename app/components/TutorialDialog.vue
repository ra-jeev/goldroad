<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { TUTORIAL_LESSONS } from '../content/tutorialContent';
import { UI_COPY } from '../content/uiCopy';

const { isTutorialOpen, closeTutorial, completeTutorial } = useTutorialFlow();
const practice = useTutorialPractice();
const COPY = UI_COPY.tutorial;
const step = ref<'guide' | 'practice'>('guide');
const dialog = ref<HTMLElement | null>(null);

useDialogFocusTrap(isTutorialOpen, dialog);

function finishTutorial() {
  completeTutorial();
  closeTutorial();
  void navigateTo('/');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeTutorial();
    return;
  }

  // Arrow/WASD walks the practice road. Bound at window level, like the live
  // board, so it works without the player first having to tab onto a tile —
  // the dialog opens with focus on its heading.
  if (step.value === 'practice') {
    practice.handleDirectionKey(event);
  }
}

watch(isTutorialOpen, (open) => {
  if (open) {
    step.value = 'guide';
    practice.restartPractice();
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
  <!--
    Deliberately no backdrop-click close. The practice step holds a part-walked
    road, and reopening restarts it from scratch, so a stray tap outside would
    silently throw away the player's run. Escape and the Close button remain.
  -->
  <div v-if="isTutorialOpen" class="tutorial-backdrop">
    <section
      ref="dialog"
      class="tutorial-panel"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      :aria-label="COPY.ariaLabel"
      :class="{ 'tutorial-panel--practice': step === 'practice' }"
    >
      <header class="tutorial-top">
        <div>
          <p class="eyebrow">{{ COPY.eyebrow }}</p>
          <h2
            id="tutorial-title"
            data-dialog-initial-focus
            tabindex="-1"
          >
            {{ COPY.title }}
          </h2>
          <p class="tutorial-description">{{ COPY.description }}</p>
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
              stroke-width="3"
            />
          </svg>
        </button>
      </header>

      <div
        class="step-switch segmented-control segmented-control--stretched"
        role="tablist"
        :aria-label="COPY.stepsAriaLabel"
      >
        <button
          id="tutorial-guide-tab"
          type="button"
          class="segmented-control__option"
          :class="{ 'active is-active': step === 'guide' }"
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
          class="segmented-control__option"
          :class="{ 'active is-active': step === 'practice' }"
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
              :middle-value="lesson.visual.middleValue"
              :edge-type="lesson.visual.edgeType"
              :is-start="lesson.visual.isStart"
              :is-end="lesson.visual.isEnd"
              :is-hinted="lesson.visual.isHinted"
              :show-undo-button="lesson.visual.showUndoButton"
              :show-keyboard-keys="lesson.visual.showKeyboardKeys"
              :show-retry-button="lesson.visual.showRetryButton"
              :show-hint-button="lesson.visual.showHintButton"
              :show-start-state="lesson.visual.showStartState"
            />

            <div class="lesson-copy">
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
        <p class="score-line practice-score-line">
          {{ UI_COPY.boardHeader.metrics.score }}
          <strong>{{ practice.score.value }}</strong>
          <span>•</span>
          {{ UI_COPY.boardHeader.metrics.target }}
          <strong>{{ practice.maxScore.value }}</strong>
          <span>•</span>
          {{ UI_COPY.boardHeader.metrics.boardTotal }}
          <strong>{{ practice.totalCoins.value }}</strong>
        </p>

        <GameBoard
          :board="practice.board"
          puzzle-type="expedition"
          :tiles="practice.tiles.value"
          :current-tile-index="practice.currentTileIndex.value"
          :active-set="practice.activeSet.value"
          :visited-set="practice.visited.value"
          :hinted-tiles="practice.hintedTiles.value"
          :guide-path="practice.guidePath.value"
          :path-history="practice.pathHistory.value"
          :disabled="practice.ended.value"
          :fail-signal="practice.failSignal.value"
          @select="practice.moveTo"
        />

        <GameBoardFooter
          :status="practice.status.value"
          :hint-message="practice.hintMessage.value"
          :solve-acknowledgement="practice.status.value"
          :attempt-number="1"
          :has-moved="practice.moves.value > 1"
          :show-next-reset-countdown="false"
          :show-stats-link="false"
          :expedition-just-unlocked="false"
          :hints-used="practice.hintsUsed.value"
          :ended="practice.ended.value"
          :solved="practice.solved.value"
          :can-retry="practice.canRetry.value"
          :can-undo="practice.canUndo.value"
          :can-switch-to-expedition="false"
          :loading="false"
          :submitting="false"
          @retry="practice.retryPractice"
          @undo="practice.undoLastStep"
          @hint="practice.requestHint"
        >
          <template #actions>
            <button
              v-if="practice.solved.value"
              type="button"
              class="practice-finish"
              @click="finishTutorial"
            >
              {{ COPY.playToday }}
            </button>
          </template>
        </GameBoardFooter>
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
  animation: sheet-in var(--transition-slow) both;
  position: relative;
  width: min(100%, 760px);
  max-height: min(92dvh, 900px);
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 1rem;
  border-radius: var(--radius-lg);
  padding: clamp(0.9rem, 2.5vw, 1.25rem);
  background: var(--gradient-card-overlay);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.32);
  box-shadow: var(--shadow-xl);
}

.tutorial-top {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 1rem;
}

.tutorial-top {
  padding-right: 2.6rem;
}

.tutorial-top h2 {
  margin: 0;
  color: var(--color-gold-bright);
}

.tutorial-top h2:focus {
  outline: none;
}

.tutorial-description {
  margin: 0.35rem 0 0;
  color: rgb(var(--color-gold-rgb) / 0.72);
  line-height: var(--line-height-base);
}

.tutorial-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: var(--control-size);
  height: var(--control-size);
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
  width: var(--icon-size);
  height: var(--icon-size);
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

/* Slot content is compiled in this component's scope, so the footer's own
   button styles do not reach it: match its primary text button here. */
.practice-finish {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--control-size);
  height: var(--control-size);
  border: 0;
  border-radius: var(--radius-full);
  padding: 0 0.85rem;
  font: inherit;
  font-size: var(--font-size-control);
  font-weight: 800;
  line-height: 1;
  color: var(--color-text-on-gold);
  background: var(--gradient-button-primary);
  box-shadow: 0 0 18px rgb(var(--color-gold-rgb) / 0.28);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.practice-finish:hover {
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
  min-height: 2.75rem;
  border: 0;
  border-radius: var(--radius-full);
  padding: 0.18rem 0.8rem;
  background: transparent;
  color: rgb(var(--color-gold-rgb) / 0.62);
  font: inherit;
  font-size: var(--font-size-control);
  font-weight: 800;
  cursor: pointer;
}

.step-switch button.active {
  background: rgb(var(--color-gold-rgb) / 0.18);
  color: var(--color-gold);
}

.lesson-card {
  display: grid;
  grid-template-columns: 11.5rem minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: var(--radius-md);
  background: rgb(var(--color-gold-rgb) / 0.06);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.14);
}

.lesson-card > :first-child {
  justify-self: end;
}

/* The title sat flush against the body copy, tighter than the gap between
   the body's own lines, which read as one run-on block. */
.lesson-copy {
  display: grid;
  gap: 0.4rem;
}

.lesson-card h3 {
  margin: 0;
  color: var(--color-gold);
  font-size: 1rem;
}

.lesson-card p,
.score-line {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.8);
  line-height: var(--line-height-base);
}

.practice-section {
  display: grid;
  justify-items: center;
  gap: 1rem;
  padding-top: 0.25rem;
}

.practice-score-line {
  width: min(100%, 620px);
  text-align: center;
}

.score-line {
  font-weight: 800;
}

.score-line strong {
  color: var(--color-gold-bright);
}

.score-line span {
  margin: 0 0.3rem;
  color: rgb(var(--color-gold-rgb) / 0.4);
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
  .lesson-card {
    display: grid;
    justify-items: start;
    text-align: left;
  }

  .lesson-card {
    grid-template-columns: 1fr;
    width: 100%;
  }

  .lesson-card > :first-child {
    justify-self: start;
  }

  .step-switch {
    width: min(100%, 29rem);
    grid-template-columns: 1fr 1.45fr;
  }

  .step-switch button {
    width: 100%;
  }
}

@media (min-height: 700px) {
  .tutorial-panel--practice {
    grid-template-rows: auto auto minmax(0, 1fr);
  }

  .tutorial-panel--practice .practice-section {
    align-content: center;
  }
}
</style>
