<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { UI_COPY } from '../content/uiCopy';

const { isNavDrawerOpen, closeNavDrawer } = useNavDrawer();
const { openHowToPlay } = useHowToPlaySheet();
const { hasUnseenUpdate } = useUpdatesNotice();
const COPY = UI_COPY.navDrawer;
const dialog = ref<HTMLElement | null>(null);

useDialogFocusTrap(isNavDrawerOpen, dialog);

function showHowToPlay() {
  closeNavDrawer();
  openHowToPlay();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeNavDrawer();
  }
}

watch(isNavDrawerOpen, (open) => {
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
    v-if="isNavDrawerOpen"
    class="drawer-backdrop"
    @click.self="closeNavDrawer"
  >
    <aside
      ref="dialog"
      class="drawer-panel"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      :aria-label="COPY.ariaLabel"
    >
      <div class="drawer-header">
        <p class="drawer-title">{{ COPY.title }}</p>
        <button
          type="button"
          class="drawer-close"
          :aria-label="COPY.close"
          @click="closeNavDrawer"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6 6 18"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="3"
            />
          </svg>
        </button>
      </div>

      <nav class="drawer-nav">
        <NuxtLink to="/stats" class="drawer-link" @click="closeNavDrawer">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 19V9m7 10V5m7 14v-7M3 19.5h18"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
            />
          </svg>
          {{ COPY.stats }}
        </NuxtLink>

        <button type="button" class="drawer-link" @click="showHowToPlay">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M9.2 9a2.8 2.8 0 1 1 5.23 1.4c-.33.5-.86.92-1.4 1.3c-.78.56-1.53 1.1-1.53 2.3m.01 3h.01M22 12a10 10 0 1 1-20 0a10 10 0 0 1 20 0Z"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
            />
          </svg>
          {{ COPY.howToPlay }}
        </button>

        <NuxtLink to="/games" class="drawer-link" @click="closeNavDrawer">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 7h16M4 12h16M4 17h10"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="2.5"
            />
          </svg>
          {{ COPY.pastRoads }}
        </NuxtLink>

        <NuxtLink to="/about" class="drawer-link" @click="closeNavDrawer">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 16v-5m0-3h.01M22 12a10 10 0 1 1-20 0a10 10 0 0 1 20 0Z"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
            />
          </svg>
          {{ COPY.about }}
          <span
            v-if="hasUnseenUpdate"
            class="drawer-dot"
            aria-hidden="true"
          />
        </NuxtLink>

        <!-- Leaves the app for the player's mail client, so it is a plain
             link rather than a route, and the drawer closes behind it. -->
        <a
          class="drawer-link"
          :href="UI_COPY.contact.feedbackMailto"
          @click="closeNavDrawer"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 7.5h18v11H3zM3 8l9 6 9-6"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
            />
          </svg>
          {{ COPY.feedback }}
        </a>
      </nav>
    </aside>
  </div>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  justify-content: end;
  background: rgb(6 3 0 / 0.62);
  backdrop-filter: blur(3px);
  animation: drawer-fade 160ms ease;
}

.drawer-panel {
  display: flex;
  flex-direction: column;
  width: min(320px, 84vw);
  height: 100dvh;
  padding: 0.9rem 0.85rem calc(1rem + env(safe-area-inset-bottom));
  background: var(--gradient-card-overlay);
  border-left: 1px solid rgb(var(--color-gold-rgb) / 0.24);
  box-shadow: var(--shadow-xl);
  animation: drawer-slide 220ms ease;
  overflow-y: auto;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.25rem 0.35rem 0.9rem;
  border-bottom: 1px solid rgb(var(--color-gold-rgb) / 0.16);
}

.drawer-title {
  margin: 0;
  color: var(--color-gold-bright);
  font-family: var(--font-display, inherit);
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.drawer-close {
  width: var(--control-size);
  height: var(--control-size);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
  border-radius: 8px;
  background: rgb(var(--color-gold-rgb) / 0.06);
  color: rgb(var(--color-gold-rgb) / 0.78);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.drawer-close:hover {
  color: var(--color-gold);
  background: rgb(var(--color-gold-rgb) / 0.12);
  border-color: rgb(var(--color-gold-rgb) / 0.3);
}

.drawer-close svg {
  width: var(--icon-size);
  height: var(--icon-size);
}

.drawer-nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding-top: 0.6rem;
}

.drawer-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.85rem 0.9rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgb(var(--color-gold-rgb) / 0.86);
  font: inherit;
  font-size: var(--font-size-control);
  font-weight: 600;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.drawer-link svg {
  width: var(--icon-size);
  height: var(--icon-size);
  flex: 0 0 var(--icon-size);
}

.drawer-link:hover {
  background: rgb(var(--color-gold-rgb) / 0.1);
  color: var(--color-gold);
}

.drawer-dot {
  width: 9px;
  height: 9px;
  border-radius: var(--radius-circle);
  background: var(--color-gold-bright);
}

@keyframes drawer-fade {
  from {
    opacity: 0;
  }
}

@keyframes drawer-slide {
  from {
    transform: translateX(100%);
  }
}
</style>
