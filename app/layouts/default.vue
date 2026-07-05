<script setup lang="ts">
const showMobileMenu = ref(false);
const route = useRoute();
const currentRoadLabel = useState<string | null>(
  'current-road-label',
  () => null,
);
const { muted, toggleMuted } = useGoldroadLocalState();
const { openHowToPlay, closeHowToPlay } = useHowToPlaySheet();
const { closeTutorial } = useTutorialFlow();
const {
  showNotice: showV1Notice,
  check: checkV1Notice,
  dismissNotice: dismissV1Notice,
} = useV1ReturningPlayerNotice();

onMounted(() => {
  void checkV1Notice();
});

watch(
  () => route.fullPath,
  () => {
    closeHowToPlay();
    closeTutorial();
    closeMobileMenu();

    if (route.path === '/about') {
      dismissV1Notice();
    }
  },
  { immediate: true },
);

function closeMobileMenu() {
  showMobileMenu.value = false;
}
</script>

<template>
  <div class="app-root">
    <header class="app-header">
      <div class="header-content">
        <div class="header-brand">
          <NuxtLink to="/" class="logo" @click="closeMobileMenu">
            <span class="logo-text">Goldroad</span>
          </NuxtLink>

          <p v-if="currentRoadLabel" class="road-chip">
            {{ currentRoadLabel }}
          </p>
        </div>

        <div class="header-actions">
          <NuxtLink
            to="/stats"
            class="nav-link nav-link--compact"
            @click="closeMobileMenu"
          >
            Stats
          </NuxtLink>

          <button
            class="icon-button"
            :aria-label="muted ? 'Unmute sounds' : 'Mute sounds'"
            :aria-pressed="muted"
            @click="toggleMuted"
          >
            <svg v-if="!muted" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 9.5v5h3.8L13 19V5L7.8 9.5H4Z"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <path
                d="M16 9a4.5 4.5 0 0 1 0 6M18.4 6.6a8 8 0 0 1 0 10.8"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-width="1.8"
              />
            </svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 9.5v5h3.8L13 19V5L7.8 9.5H4Z"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <path
                d="m17 9 4 4m0-4-4 4"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-width="1.8"
              />
            </svg>
          </button>

          <button
            class="icon-button"
            aria-label="Open How to Play"
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
                stroke-width="1.8"
              />
            </svg>
          </button>

          <div class="menu-shell">
            <button
              class="icon-button"
              :aria-expanded="showMobileMenu"
              :aria-label="
                showV1Notice
                  ? 'Open navigation menu — updates available'
                  : 'Open navigation menu'
              "
              @click="showMobileMenu = !showMobileMenu"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-width="1.8"
                />
              </svg>
              <span v-if="showV1Notice" class="notification-dot" aria-hidden="true" />
            </button>

            <div v-if="showMobileMenu" class="menu-panel">
              <NuxtLink to="/games" class="menu-link" @click="closeMobileMenu">
                Past Games
              </NuxtLink>
              <NuxtLink to="/about" class="menu-link" @click="closeMobileMenu">
                About
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </header>

    <slot />

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
  background:
    linear-gradient(180deg, rgb(31 17 4 / 0.88), rgb(20 11 3 / 0.72));
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

.road-chip {
  margin: 0;
  padding: 0.28rem 0.62rem;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.22);
  background: rgb(var(--color-gold-rgb) / 0.08);
  color: rgb(var(--color-gold-rgb) / 0.86);
  font-size: 0.84rem;
  font-weight: 700;
}

.nav-link {
  text-decoration: none;
  color: var(--color-gold-muted);
  font-size: 0.95rem;
  font-weight: 750;
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  transition: all var(--transition-fast);
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.nav-link--compact {
  padding-inline: 0.75rem;
}

.nav-link:hover {
  color: var(--color-gold);
  background: rgb(var(--color-gold-rgb) / 0.1);
}

.nav-link.router-link-active {
  color: var(--color-gold);
  background: rgb(var(--color-gold-rgb) / 0.15);
}

.icon-button {
  position: relative;
  width: 2.32rem;
  height: 2.32rem;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
  background: rgb(var(--color-gold-rgb) / 0.06);
  color: rgb(var(--color-gold-rgb) / 0.78);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
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
  width: 1.1rem;
  height: 1.1rem;
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
  display: block;
  padding: 0.75rem 0.9rem;
  border-radius: 6px;
  text-decoration: none;
  color: rgb(var(--color-gold-rgb) / 0.86);
  font-weight: 600;
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

  .road-chip {
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-content {
    padding: 0.8rem 0.9rem;
  }

  .nav-link--compact {
    padding-inline: 0.55rem;
  }

  .menu-panel {
    width: min(220px, calc(100vw - 1.8rem));
  }
}
</style>
