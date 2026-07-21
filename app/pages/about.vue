<script setup lang="ts">
import { UPDATES as updates } from '../content/updates';

const localState = useGoldroadLocalState();
const { hasUnseenUpdate, acknowledgeLatestUpdate } = useUpdatesNotice();

// Capture the unread state before acknowledging, so the "new" marker shows
// on the visit that reads the update and is gone on every visit after.
const showUnreadDot = ref(false);
onMounted(() => {
  localState.load();
  showUnreadDot.value = hasUnseenUpdate.value;
  acknowledgeLatestUpdate();
});
</script>

<template>
  <div class="shell">
    <div class="container">
      <header class="page-header">
        <h1>About GoldRoad</h1>
        <p class="subtitle">
          What GoldRoad is, what changed, and how your data is handled.
        </p>
      </header>

      <section class="updates-panel" aria-label="What's new">
        <div class="updates-head">
          <p class="eyebrow">Updates</p>
          <h2>What's new</h2>
        </div>

        <div class="updates-timeline">
          <article
            v-for="(entry, index) in updates"
            :key="entry.date"
            class="update-entry"
            :class="{ 'update-entry--latest': index === 0 }"
          >
            <div class="update-body">
              <div class="update-meta">
                <span v-if="index === 0" class="update-badge">Latest</span>
                <span class="update-date">{{ entry.date }}</span>
                <span
                  v-if="index === 0 && showUnreadDot"
                  class="update-unread"
                  aria-label="New update"
                />
              </div>
              <h3>{{ entry.title }}</h3>
              <p v-for="(paragraph, pIndex) in entry.body" :key="pIndex">
                {{ paragraph }}
              </p>
            </div>
          </article>
        </div>
      </section>

      <section class="card">
        <p class="eyebrow">About</p>
        <h2>A daily road, walked one tile at a time</h2>
        <p>
          GoldRoad is a daily route puzzle. Every day brings one road with two
          puzzles on it: <strong>Classic</strong>, the main daily challenge,
          and <strong>Expedition</strong>, which unlocks once you solve
          Classic.
        </p>
        <p>
          Build a path from your footprints to the finish flag without
          retracing your steps. A puzzle is
          <strong>solved</strong> only when you reach the finish with your
          score exactly on the target: not more, not less.
        </p>
        <p>
          Solve on your first try and you earn gold. Second try is silver,
          third is bronze. Keep trying past that and it still counts
          as solved, just without a medal. Hints are always available
          if you get stuck; they guide you back onto the road home without
          any penalty.
        </p>
      </section>

      <section class="card">
        <p class="eyebrow">Privacy</p>
        <h2>Plain language, no fine print</h2>
        <ul class="privacy-list">
          <li>
            Your personal history (streaks, medals, and past roads) lives
            only on your device, in your browser's local storage. Nothing
            that identifies you ever leaves it.
          </li>
          <li>
            The server stores one gameplay row per road you play, per mode,
            keyed to a random id generated on your device, the day it
            generated that id, and nothing else that identifies you. Each
            row records whether you started or solved. A solved row also holds
            your final try number, hints used, and solve time for that
            road. These are the raw rows the stats page's community numbers
            are built from, not a separate aggregated copy.
          </li>
          <li>
            Archived (Past Roads) play never reaches the server at all.
            Hints and solves there are computed on your device and change
            nothing on the server, ever.
          </li>
          <li>There are no accounts and no email collection.</li>
          <li>There is no tracking beyond that anonymous gameplay id.</li>
          <li>There are no ads.</li>
        </ul>
      </section>

      <footer class="contact-footer">
        <p>
          Follow GoldRoad on Twitter
          <a
            href="https://twitter.com/thegoldroad"
            target="_blank"
            rel="noreferrer"
          >@thegoldroad</a>
        </p>
        <p>
          Made with ❤️ &amp; coffee, by
          <a
            href="https://twitter.com/ra_jeeves"
            target="_blank"
            rel="noreferrer"
          >@ra_jeeves</a>
        </p>
        <p>
          For feedback, or anything else,
          <a href="mailto:i.rarsh@gmail.com?subject=[GoldRoad]">get in touch</a>.
        </p>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.shell {
  min-height: calc(100dvh - 60px);
  padding: 1.3rem;
}

.container {
  max-width: 720px;
  margin: 0 auto;
  display: grid;
  gap: 1.5rem;
}

.page-header {
  margin-bottom: 0.5rem;
  display: grid;
  gap: 0.45rem;
}

.page-header h1 {
  font-size: var(--font-size-3xl);
  color: var(--color-gold);
  margin: 0 0 0.5rem;
}

.subtitle {
  color: var(--color-gold-muted);
  font-size: var(--font-size-lg);
  margin: 0;
}

.eyebrow {
  margin: 0;
  font-size: var(--font-size-caption);
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(var(--color-gold-rgb) / 0.6);
}

.card {
  display: grid;
  gap: 0.75rem;
  padding: 1.4rem 1.5rem;
  border-radius: var(--radius-lg);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
  box-shadow: var(--shadow-lg);
}

.card h2 {
  margin: 0;
  color: var(--color-gold);
  font-size: 1.3rem;
}

.card p {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.82);
  line-height: var(--line-height-base);
}

/* ── Updates — its own featured section, a timeline rather than a card
   list, so the newest entry reads as an event, not a filed-away note ── */
.updates-panel {
  display: grid;
  gap: 1.1rem;
  padding: 1.5rem 1.5rem 1.6rem;
  border-radius: var(--radius-lg);
  background: var(--gradient-card-hero);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.3);
  box-shadow: var(--shadow-xl);
}

.updates-head {
  display: grid;
  gap: 0.2rem;
}

.updates-head h2 {
  margin: 0;
  color: var(--color-gold-bright);
  font-size: 1.4rem;
}

.updates-timeline {
  display: grid;
  gap: 1.2rem;
}

.update-entry + .update-entry {
  padding-top: 1.2rem;
  border-top: 1px solid rgb(var(--color-gold-rgb) / 0.14);
}

.update-body {
  display: grid;
  gap: 0.4rem;
}

/* Unread marker: glows on the visit that reads the update, gone after. */
.update-unread {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: var(--radius-circle);
  background: var(--color-gold-bright);
  box-shadow: var(--shadow-glow-gold-soft);
  animation: rise-in var(--transition-slow) both;
}

.update-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.update-badge {
  padding: 0.14rem 0.5rem;
  border-radius: var(--radius-full);
  background: var(--gradient-button-primary);
  color: var(--color-text-on-gold);
  font-size: var(--font-size-caption);
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.update-date {
  color: rgb(var(--color-gold-rgb) / 0.62);
  font-size: var(--font-size-caption);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.update-body h3 {
  margin: 0;
  color: var(--color-gold-bright);
  font-size: 1.12rem;
}

.update-body p {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.82);
  line-height: var(--line-height-base);
}

.privacy-list {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.6rem;
  color: rgb(var(--color-gold-rgb) / 0.82);
  line-height: var(--line-height-base);
}

.privacy-list li::marker {
  color: rgb(var(--color-gold-rgb) / 0.6);
}

.contact-footer {
  display: grid;
  gap: 0.5rem;
  padding: 1.2rem 0.2rem 0.4rem;
  text-align: center;
  color: rgb(var(--color-gold-rgb) / 0.76);
}

.contact-footer p {
  margin: 0;
}

.contact-footer a {
  color: var(--color-gold);
  font-weight: 700;
  text-decoration: none;
}

.contact-footer a:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .shell {
    padding: 0.9rem;
  }

  .page-header h1 {
    font-size: var(--font-size-3xl);
  }

  .card,
  .updates-panel {
    padding: 1.2rem 1.1rem;
  }
}
</style>
