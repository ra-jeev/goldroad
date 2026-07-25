<script setup lang="ts">
import { onClickOutside } from '@vueuse/core';

const showMobileMenu = ref(false);
const menuShell = ref<HTMLElement | null>(null);
const route = useRoute();
const currentRoadLabel = useState<string | null>(
  'current-road-label',
  () => null,
);
const { muted, toggleMuted } = useGoldroadLocalState();
// The persistent shell owns sound loading so page navigation cannot dispose of
// the preloaded sound bank.
useSoundEffects();
const { openHowToPlay, closeHowToPlay } = useHowToPlaySheet();
const { closeTutorial } = useTutorialFlow();
// Acknowledgment of the latest update is owned by the About page itself,
// which needs to capture the pre-acknowledgment state to show its own
// unread marker exactly once.
const { hasUnseenUpdate } = useUpdatesNotice();

watch(
  () => route.fullPath,
  () => {
    closeHowToPlay();
    closeTutorial();
    closeMobileMenu();
  },
  { immediate: true },
);

function closeMobileMenu() {
  showMobileMenu.value = false;
}

onClickOutside(menuShell, closeMobileMenu);
</script>

<template>
  <div class="app-root">
    <header class="app-header">
      <div class="header-content">
        <div class="header-brand">
          <NuxtLink to="/" class="logo" @click="closeMobileMenu">
            <span class="logo-text">GoldRoad</span>
          </NuxtLink>

          <p v-if="currentRoadLabel" class="road-label">
            {{ currentRoadLabel }}
          </p>
        </div>

        <div class="header-actions">
          <button
            class="icon-button"
            :aria-label="muted ? 'Unmute sounds' : 'Mute sounds'"
            :aria-pressed="muted"
            :title="muted ? 'Unmute sounds' : 'Mute sounds'"
            :data-tooltip="muted ? 'Unmute' : 'Mute'"
            @click="toggleMuted"
          >
            <svg v-if="!muted" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 9.5v5h3.8L13 19V5L7.8 9.5H4Z"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
              />
              <path
                d="M16 9a4.5 4.5 0 0 1 0 6M18.4 6.6a8 8 0 0 1 0 10.8"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-width="3"
              />
            </svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 9.5v5h3.8L13 19V5L7.8 9.5H4Z"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
              />
              <path
                d="m17 9 4 4m0-4-4 4"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-width="3"
              />
            </svg>
          </button>

          <NuxtLink
            to="/stats"
            class="icon-button header-direct-action"
            aria-label="View stats"
            title="Stats"
            data-tooltip="Stats"
            @click="closeMobileMenu"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 19V9m7 10V5m7 14v-7M3 19.5h18"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
              />
            </svg>
          </NuxtLink>

          <button
            class="icon-button header-direct-action"
            aria-label="Open How to Play"
            title="How to play"
            data-tooltip="How to play"
            @click="
              openHowToPlay();
              closeMobileMenu();
            "
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9.2 9a2.8 2.8 0 1 1 5.23 1.4c-.33.5-.86.92-1.4 1.3c-.78.56-1.53 1.1-1.53 2.3m.01 3h.01M22 12a10 10 0 1 1-20 0a10 10 0 0 1 20 0Z"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
              />
            </svg>
          </button>

          <div ref="menuShell" class="menu-shell">
            <button
              class="icon-button"
              :aria-expanded="showMobileMenu"
              :aria-label="
                hasUnseenUpdate
                  ? 'Open navigation menu (update available)'
                  : 'Open navigation menu'
              "
              title="Menu"
              data-tooltip="Menu"
              @click="showMobileMenu = !showMobileMenu"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-width="3"
                />
              </svg>
              <span
                v-if="hasUnseenUpdate"
                class="notification-dot"
                aria-hidden="true"
              />
            </button>

            <div v-if="showMobileMenu" class="menu-panel">
              <NuxtLink
                to="/stats"
                class="menu-link menu-link--mobile"
                @click="closeMobileMenu"
              >
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
                Stats
              </NuxtLink>
              <button
                type="button"
                class="menu-link menu-link--mobile"
                @click="
                  openHowToPlay();
                  closeMobileMenu();
                "
              >
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
                How to Play
              </button>
              <NuxtLink to="/games" class="menu-link" @click="closeMobileMenu">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 7h16M4 12h16M4 17h10"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-width="2.5"
                  />
                </svg>
                Past Roads
              </NuxtLink>
              <NuxtLink to="/about" class="menu-link menu-link--update" @click="closeMobileMenu">
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
                About
                <span
                  v-if="hasUnseenUpdate"
                  class="notification-dot notification-dot--inline"
                  aria-hidden="true"
                />
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </header>

    <slot />

    <AppFooter />

    <GameHelpSheet />
    <TutorialDialog />
  </div>
</template>

<style scoped>
.app-root {
  min-height: 100dvh;
  background: var(--gradient-bg-main);
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: linear-gradient(180deg, rgb(31 17 4 / 0.88), rgb(20 11 3 / 0.72));
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgb(var(--color-gold-rgb) / 0.18);
  box-shadow: 0 12px 30px rgb(0 0 0 / 0.24);
}

.header-content {
  max-width: 1040px;
  margin: 0 auto;
  padding: 0.68rem clamp(0.85rem, 2.5vw, 1.45rem);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.2rem;
}

.header-brand,
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.logo {
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logo-text {
  font-size: 1.42rem;
  font-weight: 700;
  color: var(--color-gold);
  letter-spacing: 0;
}

.road-label {
  flex-shrink: 0;
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.78);
  font-size: var(--font-size-caption);
  font-weight: 700;
}

.icon-button {
  position: relative;
  width: var(--control-size);
  height: var(--control-size);
  border-radius: 8px;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
  background: rgb(var(--color-gold-rgb) / 0.06);
  color: rgb(var(--color-gold-rgb) / 0.78);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  text-decoration: none;
  transition: all var(--transition-fast);
}

@media (hover: hover) {
  .icon-button[data-tooltip]::after {
    content: attr(data-tooltip);
    position: absolute;
    top: calc(100% + 0.48rem);
    left: 50%;
    z-index: 5;
    transform: translate(-50%, -0.15rem);
    padding: 0.3rem 0.5rem;
    border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
    border-radius: 6px;
    background: rgb(20 11 3 / 0.97);
    box-shadow: var(--shadow-sm);
    color: var(--color-gold-bright);
    font-size: var(--font-size-caption);
    font-weight: 750;
    line-height: 1;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition:
      opacity var(--transition-fast),
      transform var(--transition-fast);
  }

  .icon-button[data-tooltip]:hover::after,
  .icon-button[data-tooltip]:focus-visible::after {
    transform: translate(-50%, 0);
    opacity: 1;
  }

  .icon-button[aria-expanded='true']::after {
    display: none;
  }
}

.notification-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 9px;
  height: 9px;
  border-radius: var(--radius-circle);
  background: var(--color-gold-bright);
  box-shadow:
    0 0 0 2px rgb(20 11 3 / 0.92),
    var(--shadow-glow-gold-soft);
}

.icon-button svg {
  width: var(--icon-size);
  height: var(--icon-size);
}

.icon-button:hover,
.icon-button[aria-expanded='true'],
.icon-button[aria-pressed='true'] {
  color: var(--color-gold);
  background: rgb(var(--color-gold-rgb) / 0.12);
  border-color: rgb(var(--color-gold-rgb) / 0.3);
}

.menu-shell {
  position: relative;
}

.menu-panel {
  position: absolute;
  top: calc(100% + 0.55rem);
  right: 0;
  width: 180px;
  padding: 0.45rem;
  border-radius: 8px;
  background: var(--gradient-card-overlay);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.24);
  box-shadow: var(--shadow-xl);
}

.menu-link {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.75rem 0.9rem;
  border-radius: 6px;
  text-decoration: none;
  color: rgb(var(--color-gold-rgb) / 0.86);
  background: transparent;
  border: 0;
  width: 100%;
  font: inherit;
  font-size: var(--font-size-control);
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.menu-link svg {
  width: var(--icon-size);
  height: var(--icon-size);
  flex: 0 0 var(--icon-size);
}

.menu-link--mobile {
  display: none;
}

.notification-dot--inline {
  position: static;
  box-shadow: none;
}

.menu-link:hover {
  background: rgb(var(--color-gold-rgb) / 0.1);
}

@media (max-width: 768px) {
  .header-content,
  .header-actions {
    gap: 0.55rem;
  }

  .header-brand {
    min-width: 0;
  }

  .logo-text {
    font-size: 1.3rem;
  }

  .road-label {
    max-width: min(42vw, 145px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-direct-action {
    display: none;
  }

  .menu-link--mobile {
    display: flex;
  }

  .header-content {
    padding: 0.8rem 0.9rem;
  }

  .menu-panel {
    width: min(220px, calc(100vw - 1.8rem));
  }
}
</style>
