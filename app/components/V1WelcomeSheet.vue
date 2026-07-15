<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { UI_COPY } from '../content/uiCopy';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  showWhatsNew: [];
  dismiss: [];
}>();

const COPY = UI_COPY.v1Welcome;
const dialog = ref<HTMLElement | null>(null);
const isOpen = computed(() => props.visible);

useDialogFocusTrap(isOpen, dialog);

function onDismiss() {
  emit('dismiss');
}

function onShowWhatsNew() {
  emit('showWhatsNew');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    onDismiss();
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (!import.meta.client) return;

    if (visible) {
      window.addEventListener('keydown', onKeydown);
    } else {
      window.removeEventListener('keydown', onKeydown);
    }
  },
);

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', onKeydown);
  }
});
</script>

<template>
  <Transition name="v1welcome">
    <div v-if="visible" class="v1welcome-scrim" @click.self="onDismiss">
      <section
        ref="dialog"
        class="v1welcome-sheet"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="v1welcome-title"
      >
        <button
          type="button"
          class="v1welcome-close"
          :aria-label="COPY.close"
          @click="onDismiss"
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

        <div class="v1welcome-body">
          <p class="v1welcome-eyebrow">{{ COPY.eyebrow }}</p>
          <h2 id="v1welcome-title" class="v1welcome-title">
            {{ COPY.title }}
          </h2>
          <p
            v-for="(paragraph, index) in COPY.body"
            :key="index"
            class="v1welcome-lede"
          >
            {{ paragraph }}
          </p>

          <div class="v1welcome-actions">
            <button
              type="button"
              class="v1welcome-button v1welcome-button--primary"
              @click="onShowWhatsNew"
            >
              {{ COPY.primaryCta }}
            </button>
            <button
              type="button"
              class="v1welcome-button v1welcome-button--ghost"
              @click="onDismiss"
            >
              {{ COPY.secondaryCta }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.v1welcome-scrim {
  position: fixed;
  inset: 0;
  z-index: 140;
  display: grid;
  align-items: end;
  justify-items: center;
  padding: clamp(0rem, 2vw, 1rem);
  background: rgb(0 0 0 / 0.66);
  backdrop-filter: blur(6px);
}

.v1welcome-sheet {
  position: relative;
  width: min(100%, 480px);
  max-height: min(92dvh, 760px);
  overflow-y: auto;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding: clamp(1.5rem, 4vw, 2rem) clamp(1.1rem, 3.5vw, 1.6rem)
    clamp(1.2rem, 3vw, 1.5rem);
  background: var(--gradient-card-completion, var(--gradient-card-overlay));
  border: 1px solid rgb(var(--color-gold-rgb) / 0.34);
  border-bottom: 0;
  box-shadow: var(--shadow-2xl);
}

@media (min-width: 560px) {
  .v1welcome-scrim {
    align-items: center;
  }

  .v1welcome-sheet {
    border-radius: var(--radius-xl);
    border-bottom: 1px solid rgb(var(--color-gold-rgb) / 0.34);
  }
}

.v1welcome-close {
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

.v1welcome-close svg {
  width: 1.05rem;
  height: 1.05rem;
}

.v1welcome-close:hover {
  transform: translateY(-1px);
  color: var(--color-gold-bright);
}

.v1welcome-body {
  display: grid;
  justify-items: center;
  gap: 0.62rem;
  text-align: center;
}

.v1welcome-eyebrow {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 800;
  color: rgb(var(--color-gold-rgb) / 0.66);
}

.v1welcome-title {
  margin: 0;
  font-size: clamp(1.5rem, 5vw, 1.85rem);
  line-height: 1.12;
  color: var(--color-gold-bright);
}

.v1welcome-lede {
  margin: 0;
  max-width: 40ch;
  color: rgb(var(--color-gold-rgb) / 0.82);
  line-height: var(--line-height-base);
}

.v1welcome-actions {
  display: grid;
  gap: 0.55rem;
  width: 100%;
  margin-top: 0.85rem;
}

.v1welcome-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  padding: 0 1.1rem;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  text-decoration: none;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.v1welcome-button--primary {
  color: var(--color-text-on-gold);
  background: var(--gradient-button-primary);
  box-shadow: 0 0 18px rgb(var(--color-gold-rgb) / 0.3);
}

.v1welcome-button--ghost {
  color: rgb(var(--color-gold-rgb) / 0.82);
  background: rgb(var(--color-gold-rgb) / 0.08);
  border-color: rgb(var(--color-gold-rgb) / 0.22);
}

.v1welcome-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.v1welcome-enter-active,
.v1welcome-leave-active {
  transition: opacity var(--transition-base);
}

.v1welcome-enter-active .v1welcome-sheet {
  transition: transform var(--transition-slow);
}

.v1welcome-enter-from,
.v1welcome-leave-to {
  opacity: 0;
}

.v1welcome-enter-from .v1welcome-sheet {
  transform: translateY(18px);
}

@media (prefers-reduced-motion: reduce) {
  .v1welcome-enter-from .v1welcome-sheet {
    transform: none;
  }
}
</style>
