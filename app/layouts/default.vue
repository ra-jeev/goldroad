<script setup lang="ts">
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
const { isNavDrawerOpen, closeNavDrawer, toggleNavDrawer } = useNavDrawer();
// Acknowledgment of the latest update is owned by the About page itself,
// which needs to capture the pre-acknowledgment state to show its own
// unread marker exactly once.
const { hasUnseenUpdate } = useUpdatesNotice();

watch(
  () => route.fullPath,
  () => {
    closeHowToPlay();
    closeTutorial();
    closeNavDrawer();
  },
  { immediate: true },
);
</script>

<template>
  <div class="app-root">
    <header class="app-header">
      <div class="header-content">
        <div class="header-brand">
          <NuxtLink to="/" class="logo" @click="closeNavDrawer">
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
            @click="closeNavDrawer"
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
              closeNavDrawer();
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

          <button
            class="icon-button"
            :aria-expanded="isNavDrawerOpen"
            :aria-label="
              hasUnseenUpdate
                ? 'Open navigation menu (update available)'
                : 'Open navigation menu'
            "
            title="Menu"
            data-tooltip="Menu"
            @click="toggleNavDrawer"
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
        </div>
      </div>
    </header>

    <slot />

    <AppFooter />

    <AppNavDrawer />
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
  /* Marcellus ships only 400, so the wordmark takes its presence from size
     and letter-spacing rather than a weight the face does not have — asking
     for 700 here would synthesise a smeared bold. */
  font-size: 1.55rem;
  font-weight: 400;
  color: var(--color-gold);
  letter-spacing: 0.01em;
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
    font-weight: 800;
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

@media (max-width: 768px) {
  .header-content,
  .header-actions {
    gap: 0.55rem;
  }

  .header-brand {
    min-width: 0;
  }

  .logo-text {
    /* Same reasoning as the desktop size: at 400 the wordmark needs the extra
       size to hold rank over the bolder day label beside it. */
    font-size: 1.42rem;
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

  .header-content {
    padding: 0.8rem 0.9rem;
  }
}
</style>
