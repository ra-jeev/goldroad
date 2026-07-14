<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { UI_COPY } from '../content/uiCopy';

const { isHowToPlayOpen, closeHowToPlay } = useHowToPlaySheet();
const { openTutorial } = useTutorialFlow();
const COPY = UI_COPY.helpSheet;
const dialog = ref<HTMLElement | null>(null);

useDialogFocusTrap(isHowToPlayOpen, dialog);

function playTutorial() {
  closeHowToPlay();
  openTutorial();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeHowToPlay();
  }
}

watch(isHowToPlayOpen, (open) => {
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
          <p class="eyebrow">{{ UI_COPY.boardFooter.openHelp }}</p>
          <h2 id="game-help-title">{{ UI_COPY.boardFooter.helpTitle }}</h2>
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
              stroke-width="2"
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
          <li
            v-for="item in COPY.sections.howToPlay.items"
            :key="item"
          >
            {{ item }}
          </li>
        </ul>
      </article>

      <article class="help-section">
        <h3>{{ COPY.sections.tools.title }}</h3>
        <ul>
          <li
            v-for="item in COPY.sections.tools.items"
            :key="item"
          >
            {{ item }}
          </li>
        </ul>
      </article>

      <article class="help-section">
        <h3>{{ COPY.sections.about.title }}</h3>
        <p>{{ COPY.sections.about.body }}</p>
      </article>

      <article class="help-section">
        <h3>{{ COPY.sections.updates.title }}</h3>
        <ul>
          <li
            v-for="item in COPY.sections.updates.items"
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

.sheet-header h2,
.help-section h3 {
  margin: 0;
  color: var(--color-gold);
}

.sheet-close {
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

.sheet-close svg {
  width: 1.05rem;
  height: 1.05rem;
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
  min-height: 3rem;
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
</style>
