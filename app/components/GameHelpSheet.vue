<script setup lang="ts">
import { UI_COPY } from '../content/uiCopy';

const { isHowToPlayOpen, closeHowToPlay } = useHowToPlaySheet();
const { openTutorial } = useTutorialFlow();

function playTutorial() {
  closeHowToPlay();
  openTutorial();
}
</script>

<template>
  <div
    v-if="isHowToPlayOpen"
    class="sheet-backdrop"
    @click.self="closeHowToPlay"
  >
    <section class="sheet-card" aria-label="How to play">
      <div class="sheet-header">
        <div>
          <p class="eyebrow">How to Play</p>
          <h2>{{ UI_COPY.boardFooter.helpTitle }}</h2>
        </div>

        <button type="button" class="close-button" @click="closeHowToPlay">
          {{ UI_COPY.helpSheet.close }}
        </button>
      </div>

      <p class="sheet-intro">{{ UI_COPY.helpSheet.intro }}</p>

      <button
        type="button"
        class="tutorial-link"
        @click="playTutorial"
      >
        {{ UI_COPY.helpSheet.startTutorial }}
      </button>

      <article class="help-section">
        <h3>{{ UI_COPY.helpSheet.sections.howToPlay.title }}</h3>
        <ul>
          <li
            v-for="item in UI_COPY.helpSheet.sections.howToPlay.items"
            :key="item"
          >
            {{ item }}
          </li>
        </ul>
      </article>

      <article class="help-section">
        <h3>{{ UI_COPY.helpSheet.sections.tools.title }}</h3>
        <ul>
          <li
            v-for="item in UI_COPY.helpSheet.sections.tools.items"
            :key="item"
          >
            {{ item }}
          </li>
        </ul>
      </article>

      <article class="help-section">
        <h3>{{ UI_COPY.helpSheet.sections.about.title }}</h3>
        <p>{{ UI_COPY.helpSheet.sections.about.body }}</p>
      </article>

      <article class="help-section">
        <h3>{{ UI_COPY.helpSheet.sections.updates.title }}</h3>
        <ul>
          <li
            v-for="item in UI_COPY.helpSheet.sections.updates.items"
            :key="item"
          >
            {{ item }}
          </li>
        </ul>
      </article>
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
}

.sheet-header h2,
.help-section h3 {
  margin: 0;
  color: var(--color-gold);
}

.close-button {
  border: 1px solid rgb(var(--color-gold-rgb) / 0.28);
  border-radius: var(--radius-sm);
  padding: 0.7rem 0.9rem;
  color: var(--color-gold);
  background: rgb(var(--color-gold-rgb) / 0.1);
  font-weight: 700;
  cursor: pointer;
}

.help-section {
  margin-top: 1rem;
}

.sheet-intro {
  margin: 0.8rem 0 0;
  color: var(--color-gold-bright);
  line-height: var(--line-height-base);
}

.tutorial-link {
  display: inline-flex;
  margin-top: 0.85rem;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.34);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.9rem;
  color: var(--color-gold-bright);
  background: rgb(var(--color-gold-rgb) / 0.16);
  font: inherit;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
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
</style>
