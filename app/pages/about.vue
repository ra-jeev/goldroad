<script setup lang="ts">
type UpdateEntry = {
  date: string;
  title: string;
  body: string[];
};

// Newest first. Append future entries to the top of this list.
const updates: UpdateEntry[] = [
  {
    date: 'Jul 2026',
    title: 'GoldRoad v2: a fresh start',
    body: [
      "GoldRoad is starting over. Road numbering has restarted from the beginning, so today's road is a new #1, not a continuation of the old count.",
      'There are no more accounts, sign-in, or notifications. Your personal history and streaks now live only in your browser, on this device.',
      'This is a clean break from the old server-side history. Old streaks and saved progress could not be carried over into the new model, so they could not be preserved.',
      "If you played the original GoldRoad, thank you for walking the old roads with me. I hope you enjoy starting fresh on this one just as much.",
    ],
  },
];
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
          Build a path from the start tile to the exit tile without
          retracing your steps. A puzzle is
          <strong>solved</strong> only when you reach the exit with your
          score exactly on the target &mdash; not more, not less.
        </p>
        <p>
          Solve on your first attempt and you earn gold. Second attempt is
          silver, third is bronze. Keep trying past that and it still counts
          as solved &mdash; just without a medal. Hints are always available
          if you get stuck; they guide you back onto the road home without
          any penalty.
        </p>
      </section>

      <section class="card">
        <p class="eyebrow">Updates</p>
        <h2>What's changed</h2>
        <div class="updates-list">
          <article v-for="entry in updates" :key="entry.date" class="update-entry">
            <div class="update-head">
              <strong class="update-date">{{ entry.date }}</strong>
              <h3>{{ entry.title }}</h3>
            </div>
            <p v-for="(paragraph, index) in entry.body" :key="index">
              {{ paragraph }}
            </p>
          </article>
        </div>
      </section>

      <section class="card">
        <p class="eyebrow">Privacy</p>
        <h2>Plain language, no fine print</h2>
        <ul class="privacy-list">
          <li>
            Your personal history &mdash; streaks, medals, and past roads
            &mdash; lives only on your device, in your browser's local
            storage. Nothing that identifies you ever leaves it.
          </li>
          <li>
            The server keeps only anonymous, aggregated gameplay analytics:
            attempts, hints used, and solve times, keyed to a random
            anonymous id generated on your device. This is what powers
            global comparison on the stats page and helps tune future
            puzzles.
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
  font-size: 2.5rem;
  color: var(--color-gold);
  margin: 0 0 0.5rem;
}

.subtitle {
  color: var(--color-gold-muted);
  font-size: 1.1rem;
  margin: 0;
}

.card {
  display: grid;
  gap: 0.75rem;
  padding: 1.4rem 1.5rem;
  border-radius: var(--radius-lg);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
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

.updates-list {
  display: grid;
  gap: 1.2rem;
}

.update-entry {
  display: grid;
  gap: 0.5rem;
  padding-top: 1.2rem;
  border-top: 1px solid rgb(var(--color-gold-rgb) / 0.14);
}

.update-entry:first-child {
  padding-top: 0;
  border-top: none;
}

.update-head {
  display: grid;
  gap: 0.2rem;
}

.update-date {
  color: rgb(var(--color-gold-rgb) / 0.7);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.update-entry h3 {
  margin: 0;
  color: var(--color-gold-bright);
  font-size: 1.1rem;
}

.update-entry p {
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
    font-size: 2rem;
  }

  .card {
    padding: 1.2rem 1.1rem;
  }
}
</style>
