<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { UI_COPY } from '../content/uiCopy';
import {
  HOW_TO_PLAY_EXAMPLE,
  HOW_TO_PLAY_MORE,
} from '../content/howToPlayContent';
import { TUTORIAL_LESSONS } from '../content/tutorialContent';

const { isHowToPlayOpen, closeHowToPlay } = useHowToPlaySheet();
const { openTutorial } = useTutorialFlow();
const COPY = UI_COPY.helpSheet;
const dialog = ref<HTMLElement | null>(null);

useDialogFocusTrap(isHowToPlayOpen, dialog);

// The example reuses a tutorial lesson, so the picture and the tutorial can
// never disagree about the tiles.
const exampleVisual = TUTORIAL_LESSONS.find(
  (lesson) => lesson.id === HOW_TO_PLAY_EXAMPLE.lessonId,
)?.visual;

// The sheet is a route, so leaving it is a navigation, and the layout closes
// the tutorial on every navigation. Land on the board first, let that settle,
// then open the tutorial over it.
async function playTutorial() {
  await navigateTo('/', { replace: true });
  await nextTick();
  openTutorial();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeHowToPlay();
  }
}

// Immediate: a visitor who lands on /how-to-play arrives with the sheet
// already open, so there is no change to wait for.
watch(
  isHowToPlayOpen,
  (open) => {
    if (!import.meta.client) return;

    if (open) {
      window.addEventListener('keydown', onKeydown);
    } else {
      window.removeEventListener('keydown', onKeydown);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', onKeydown);
  }
});
</script>

<template>
  <div
    v-if="isHowToPlayOpen"
    class="sheet-backdrop"
    @click.self="closeHowToPlay"
  >
    <section
      ref="dialog"
      class="sheet-card"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-help-title"
      :aria-label="COPY.ariaLabel"
    >
      <div class="sheet-header">
        <div>
          <p class="eyebrow">{{ COPY.eyebrow }}</p>
          <!-- The sheet is the whole subject of /how-to-play, so its title is
               that page's one h1. The board page drops its own while this is
               open. -->
          <h1
            id="game-help-title"
            data-dialog-initial-focus
            tabindex="-1"
          >
            {{ UI_COPY.boardFooter.helpTitle
            }}<span class="sr-only"> GoldRoad</span>
          </h1>
        </div>

        <button
          type="button"
          class="sheet-close"
          :aria-label="COPY.close"
          @click="closeHowToPlay"
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
      </div>

      <p class="sheet-intro">{{ COPY.intro }}</p>

      <button
        type="button"
        class="sheet-button sheet-button--primary"
        @click="playTutorial"
      >
        {{ COPY.startTutorial }}
      </button>

      <article class="help-section">
        <h3>{{ COPY.sections.howToPlay.title }}</h3>
        <ul>
          <li v-for="item in COPY.sections.howToPlay.items" :key="item">
            {{ item }}
          </li>
        </ul>
      </article>

      <article class="help-section">
        <h3>{{ COPY.sections.tools.title }}</h3>
        <ul>
          <li v-for="item in COPY.sections.tools.items" :key="item">
            {{ item }}
          </li>
        </ul>
      </article>

      <article class="help-section">
        <h3>{{ COPY.sections.keyboard.title }}</h3>
        <ul>
          <li v-for="item in COPY.sections.keyboard.items" :key="item">
            {{ item }}
          </li>
        </ul>
      </article>

      <!-- Folded so the reference stays short mid-road. Native details keep
           the text in the page for search and need no script. -->
      <div class="help-more">
        <details v-if="exampleVisual" class="help-fold">
          <summary>
            <h3>{{ HOW_TO_PLAY_EXAMPLE.title }}</h3>
          </summary>
          <div
            class="help-example"
            role="img"
            :aria-label="HOW_TO_PLAY_EXAMPLE.ariaLabel"
          >
            <TutorialMiniBoard
              :from-value="exampleVisual.fromValue"
              :to-value="exampleVisual.toValue"
              :middle-value="exampleVisual.middleValue"
              :edge-type="exampleVisual.edgeType"
              :is-start="exampleVisual.isStart"
              :is-end="exampleVisual.isEnd"
            />
          </div>
          <p v-for="text in HOW_TO_PLAY_EXAMPLE.paragraphs" :key="text">
            {{ text }}
          </p>
        </details>

        <details
          v-for="section in HOW_TO_PLAY_MORE"
          :key="section.id"
          class="help-fold"
        >
          <summary>
            <h3>{{ section.title }}</h3>
          </summary>
          <p v-for="text in section.paragraphs" :key="text">{{ text }}</p>
          <ul v-if="section.items">
            <li v-for="item in section.items" :key="item">{{ item }}</li>
          </ul>
        </details>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(0 0 0 / 0.64);
  backdrop-filter: blur(6px);
}

.sheet-card {
  animation: sheet-in var(--transition-slow) both;
  position: relative;
  width: min(100%, 560px);
  max-height: min(84dvh, 720px);
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
  padding-right: 2.6rem;
}

.sheet-header h1,
.help-section h3,
.help-fold h3 {
  margin: 0;
  color: var(--color-gold);
}

/* An h1 by rank, a panel title by size: it keeps the measure the h2 it
   replaced had, so the sheet looks as it always did. */
.sheet-header h1 {
  font-size: 1.5em;
}

.sheet-header h1:focus {
  outline: none;
}

.sheet-close {
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

.sheet-close svg {
  width: var(--icon-size);
  height: var(--icon-size);
}

.sheet-close:hover {
  transform: translateY(-1px);
  color: var(--color-gold-bright);
}

.help-section {
  margin-top: 1rem;
}

.sheet-intro {
  margin: 0.8rem 0 0;
  color: var(--color-gold-bright);
  line-height: var(--line-height-base);
}

.sheet-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.85rem;
  min-height: 2.5rem;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  padding: 0 1.1rem;
  font: inherit;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.sheet-button--primary {
  color: var(--color-text-on-gold);
  background: var(--gradient-button-primary);
  box-shadow: 0 0 18px rgb(var(--color-gold-rgb) / 0.3);
}

.sheet-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.help-section ul {
  margin: 0.6rem 0 0;
  padding-left: 1.1rem;
}

.help-section p,
.help-section li {
  color: rgb(var(--color-gold-rgb) / 0.84);
  line-height: var(--line-height-base);
}

.help-section p {
  margin: 0.6rem 0 0;
}

.help-more {
  margin-top: 1rem;
  border-top: 1px solid rgb(var(--color-gold-rgb) / 0.16);
}

.help-fold {
  border-bottom: 1px solid rgb(var(--color-gold-rgb) / 0.16);
}

.help-fold summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: var(--control-size);
  padding: 0.35rem 0;
  cursor: pointer;
  list-style: none;
}

.help-fold summary::-webkit-details-marker {
  display: none;
}

/* A drawn chevron: the shipped font subsets carry no arrow glyphs. */
.help-fold summary::after {
  content: '';
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  margin-right: 0.3rem;
  border-right: 2px solid rgb(var(--color-gold-rgb) / 0.7);
  border-bottom: 2px solid rgb(var(--color-gold-rgb) / 0.7);
  transform: rotate(45deg) translate(-2px, -2px);
}

.help-fold[open] summary::after {
  transform: rotate(-135deg) translate(-2px, -2px);
}

.help-fold summary:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm, 4px);
}

.help-fold h3 {
  font-size: 1rem;
}

.help-fold p,
.help-fold li {
  color: rgb(var(--color-gold-rgb) / 0.84);
  line-height: var(--line-height-base);
}

.help-fold p {
  margin: 0 0 0.7rem;
}

.help-fold ul {
  margin: 0 0 0.7rem;
  padding-left: 1.1rem;
}

.help-example {
  display: flex;
  justify-content: center;
  padding: 0.4rem 0 0.9rem;
  overflow-x: auto;
}
</style>
