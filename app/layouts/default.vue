<script setup lang="ts">
const showMobileMenu = ref(false)
const showAbout = ref(false)

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
        <NuxtLink to="/" class="logo" @click="closeMobileMenu">
          <span class="logo-text">Goldroad</span>
        </NuxtLink>

        <button
          class="menu-toggle"
          :aria-expanded="showMobileMenu"
          aria-label="Toggle navigation menu"
          @click="showMobileMenu = !showMobileMenu"
        >
          <span class="menu-icon" />
        </button>

        <nav class="nav" :class="{ 'nav--open': showMobileMenu }">
          <NuxtLink to="/" class="nav-link" @click="closeMobileMenu">
            Today's Road
          </NuxtLink>
          <NuxtLink to="/games" class="nav-link" @click="closeMobileMenu">
            Past Games
          </NuxtLink>
          <NuxtLink to="/stats" class="nav-link" @click="closeMobileMenu">
            Stats
          </NuxtLink>
          <button class="nav-link nav-button" @click="showAbout = true; closeMobileMenu()">
            About
          </button>
        </nav>
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
  gap: 2rem;
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

.menu-toggle {
  display: none;
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  color: var(--color-gold);
}

.menu-icon {
  display: block;
  width: 24px;
  height: 2px;
  background: currentColor;
  position: relative;
}

.menu-icon::before,
.menu-icon::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 2px;
  background: currentColor;
  left: 0;
}

.menu-icon::before {
  top: -7px;
}

.menu-icon::after {
  bottom: -7px;
}

.nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
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

.nav-link:hover {
  color: var(--color-gold);
  background: rgb(var(--color-gold-rgb) / 0.1);
}

.nav-link.router-link-active {
  color: var(--color-gold);
  background: rgb(var(--color-gold-rgb) / 0.15);
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
  .menu-toggle {
    display: block;
  }

  .nav {
    position: fixed;
    top: 60px;
    right: 0;
    bottom: 0;
    width: min(280px, 80vw);
    background: var(--color-bg-base);
    border-left: 1px solid rgb(var(--color-gold-rgb) / 0.2);
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    padding: 1rem;
    transform: translateX(100%);
    transition: transform var(--transition-normal);
  }

  .nav--open {
    transform: translateX(0);
  }

  .nav-link {
    padding: 0.8rem 1rem;
    text-align: left;
  }

  .header-content {
    padding: 0.8rem 0.9rem;
  }
}
</style>
