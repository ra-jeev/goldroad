<script setup lang="ts">
const showMobileMenu = ref(false)
const showAbout = ref(false)
const route = useRoute()
const currentRoadLabel = useState<string | null>('current-road-label', () => null)

watch(() => route.fullPath, () => {
  closeAbout()
  closeMobileMenu()
})

function closeAbout() {
  showAbout.value = false
}

function closeMobileMenu() {
  showMobileMenu.value = false
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

          <p v-if="currentRoadLabel" class="road-chip">{{ currentRoadLabel }}</p>
        </div>

        <div class="header-actions">
          <NuxtLink to="/stats" class="nav-link nav-link--compact" @click="closeMobileMenu">
            Stats
          </NuxtLink>

          <button
            class="icon-button"
            aria-label="About Goldroad"
            @click="showAbout = true; closeMobileMenu()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 17v-5m0-4h.01M22 12a10 10 0 1 1-20 0a10 10 0 0 1 20 0Z"
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

    <NuxtPage />

    <!-- About Dialog -->
    <div v-if="showAbout" class="overlay-backdrop" @click.self="closeAbout">
      <section class="overlay-card" aria-label="About Goldroad">
        <div class="overlay-header">
          <button class="close-btn" aria-label="Close" @click="closeAbout">✕</button>
          <div>
            <p class="eyebrow">Info</p>
            <h2>About Goldroad</h2>
          </div>
        </div>
        <div class="overlay-body">
          <p>Goldroad is a daily puzzle game where you navigate a grid to collect coins and reach the destination.</p>
          <p>Each day brings a new challenge. Plan your route carefully to maximize your score!</p>
        </div>
      </section>
    </div>
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

/* About Dialog Styles */
.overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.75);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  z-index: 200;
  padding: 1rem;
}

.overlay-card {
  width: min(100%, 500px);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  background: var(--gradient-card-overlay);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.38);
  box-shadow: var(--shadow-xl);
}

.overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-gold-muted);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  order: 2;
}

.close-btn:hover {
  color: var(--color-gold);
  background: rgb(var(--color-gold-rgb) / 0.1);
}

.eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-gold-muted);
  margin: 0;
}

.overlay-card h2 {
  font-size: 1.5rem;
  margin: 0.25rem 0 0;
  color: var(--color-gold);
}

.overlay-body {
  color: var(--color-gold-muted);
  line-height: 1.6;
}

.overlay-body p {
  margin: 0 0 1rem;
}

.overlay-body p:last-child {
  margin-bottom: 0;
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
