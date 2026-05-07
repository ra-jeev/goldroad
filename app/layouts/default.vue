<script setup lang="ts">
const showMobileMenu = ref(false);
const route = useRoute();
const currentRoadLabel = useState<string | null>(
  'current-road-label',
  () => null,
);
const { openHowToPlay, closeHowToPlay } = useHowToPlaySheet();

watch(
  () => route.fullPath,
  () => {
    closeHowToPlay();
    closeMobileMenu();
  },
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
              aria-label="Open navigation menu"
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
            </button>

            <div v-if="showMobileMenu" class="menu-panel">
              <NuxtLink to="/games" class="menu-link" @click="closeMobileMenu">
                Past Games
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </header>

    <slot />

    <GameHelpSheet />
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
  background: rgb(var(--color-gold-rgb) / 0.05);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgb(var(--color-gold-rgb) / 0.15);
}

.header-content {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0.8rem 1.3rem;
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
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-gold);
  letter-spacing: -0.02em;
}

.road-chip {
  margin: 0;
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-full);
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
  font-weight: 500;
  padding: 0.4rem 0.8rem;
  border-radius: var(--radius-md);
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
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-full);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
  background: rgb(var(--color-gold-rgb) / 0.06);
  color: rgb(var(--color-gold-rgb) / 0.78);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.icon-button svg {
  width: 1.1rem;
  height: 1.1rem;
}

.icon-button:hover,
.icon-button[aria-expanded='true'] {
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
  border-radius: var(--radius-lg);
  background: var(--gradient-card-overlay);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.24);
  box-shadow: var(--shadow-xl);
}

.menu-link {
  display: block;
  padding: 0.75rem 0.9rem;
  border-radius: var(--radius-md);
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
