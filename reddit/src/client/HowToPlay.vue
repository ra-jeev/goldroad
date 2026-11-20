<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import TutorialMiniBoard from '#game/app/components/TutorialMiniBoard.vue';
import { TUTORIAL_LESSONS } from '#game/app/content/tutorialContent';
import type { RoadMode } from '../shared/api';

const props = defineProps<{ mode: RoadMode }>();
const emit = defineEmits<{ close: [] }>();

// The website's own lessons. Classic has no toll or bonus lanes, so those two
// are left out of it. Expedition adds them first, then the rest. The keyboard
// lesson shows only where there is a keyboard.
const LANE_LESSONS = ['toll-road', 'bonus-road'];
const hasKeyboard = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
const basics = TUTORIAL_LESSONS.filter(
  (lesson) => !LANE_LESSONS.includes(lesson.id) && (hasKeyboard || lesson.id !== 'keyboard'),
);
const lanes = TUTORIAL_LESSONS.filter((lesson) => LANE_LESSONS.includes(lesson.id));
const lessons = props.mode === 'expedition' ? [...lanes, ...basics] : basics;

const start = ref<HTMLButtonElement | null>(null);

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
onMounted(() => {
  window.addEventListener('keydown', onKey);
  start.value?.focus({ preventScroll: true });
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="scrim">
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="how-title">
      <button type="button" class="close" aria-label="Close" @click="emit('close')">✕</button>
      <p class="eyebrow">How to play{{ mode === 'expedition' ? ' · Expedition' : '' }}</p>
      <h2 id="how-title" class="title">{{ mode === 'expedition' ? 'Tolls and bonuses' : 'Walk the road' }}</h2>

      <div class="lessons">
        <article v-for="lesson in lessons" :key="lesson.id" class="lesson">
          <TutorialMiniBoard
            class="lesson-visual"
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
          <div class="copy">
            <h3>{{ lesson.title }}</h3>
            <p>{{ lesson.body }}</p>
          </div>
        </article>
      </div>

      <button ref="start" type="button" class="play" @click="emit('close')">Play today's road</button>
    </section>
  </div>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  align-items: end;
  justify-items: center;
  grid-template-columns: minmax(0, 1fr);
  padding: 12px 12px max(12px, env(safe-area-inset-bottom));
  background: rgb(0 0 0 / 0.55);
}

.sheet {
  /* Smaller tiles than the board, so a lesson fits beside its text. */
  --tile-size: 32px;
  --tile-gap: 12px;
  --road-thickness: 8px;
  --control-size: 36px;
  position: relative;
  width: min(100%, 460px);
  max-height: calc(100dvh - 24px);
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 10px;
  padding: 18px 14px 14px;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.4);
  border-radius: var(--radius-lg, 16px);
  background: var(--gradient-bg-main);
  color: var(--color-gold);
  text-align: center;
  box-shadow: 0 -8px 32px rgb(0 0 0 / 0.5);
}

.close {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-gold-muted);
  font: inherit;
  font-size: 1.1rem;
  cursor: pointer;
}

.close:hover,
.close:focus-visible {
  background: rgb(var(--color-gold-rgb) / 0.12);
  color: var(--color-gold-bright);
}

.eyebrow {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-gold-muted);
}

.title {
  margin: -4px 0 0;
  font-size: 1.35rem;
  color: var(--color-gold-bright);
}

.lessons {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  /* Room for the start and flag badges, which sit outside their tiles. */
  padding-top: 6px;
}

.lesson {
  display: grid;
  grid-template-columns: 8.5rem minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.14);
  border-radius: var(--radius-md, 12px);
  background: rgb(var(--color-gold-rgb) / 0.06);
  text-align: left;
}

.lesson-visual {
  justify-self: center;
}

.copy {
  display: grid;
  gap: 3px;
}

.copy h3 {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-gold);
}

.copy p {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.35;
  color: rgb(var(--color-gold-rgb) / 0.8);
}

.play {
  min-height: 44px;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--gradient-button-primary);
  color: var(--color-text-on-gold);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
</style>
