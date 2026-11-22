<script setup lang="ts">
// DRAFT for review. Not linked from the site yet. Remove the noindex line when it is approved.
const description =
  'What GoldRoad stores on your device, what it syncs through iCloud, what it sends to our server, and how to turn it off.';

useSeoMeta({
  title: 'Privacy – GoldRoad',
  description,
  ogTitle: 'GoldRoad privacy',
  ogDescription: description,
  robots: 'noindex',
});

const updated = 'November 2026';
</script>

<template>
  <div class="shell">
    <div class="container">
      <header class="page-header">
        <h1>Privacy</h1>
        <p class="subtitle">
          GoldRoad has no accounts, no ads and no tracking. This page says what
          the app and the website keep, and why.
        </p>
        <p class="updated">Last updated {{ updated }}</p>
      </header>

      <section class="card">
        <p class="eyebrow">Short version</p>
        <ul class="privacy-list">
          <li>We do not ask for your name, email, phone number or location.</li>
          <li>Your streaks, medals and saved boards stay on your device.</li>
          <li>
            On iPhone, your history can sync between your own devices through
            your iCloud account. We cannot read it.
          </li>
          <li>
            The daily road sends anonymous play stats with a random player ID.
            You can turn this off.
          </li>
          <li>We do not sell data or share it with advertisers.</li>
        </ul>
      </section>

      <section class="card">
        <p class="eyebrow">On your device</p>
        <h2>What the app keeps</h2>
        <ul class="privacy-list">
          <li>
            Your daily history: for each road and mode, the number of tries,
            whether you solved it, hints used and solve time.
          </li>
          <li>
            Your current boards, so you can close the app and continue later.
          </li>
          <li>Which Past Roads you have solved.</li>
          <li>
            Your settings: sound, haptics, reminder, and the play stats switch.
          </li>
          <li>
            A random player ID. It is made on your device and is not linked to
            your Apple ID, your name or your device ID.
          </li>
          <li>
            The Home Screen widget reads your streak and the next road time from
            a shared area on the same device.
          </li>
        </ul>
        <p>
          On the website, the same kind of data is kept in your browser’s local
          storage.
        </p>
      </section>

      <section class="card">
        <p class="eyebrow">iCloud</p>
        <h2>History sync</h2>
        <p>
          If you are signed in to iCloud, the iPhone app copies your daily
          history and your Past Roads marks to iCloud key-value storage, so your
          other devices with the same Apple ID can show them. This data goes to
          Apple under your own iCloud account. We do not receive it and cannot
          see it. To stop it, turn off iCloud for GoldRoad in the iPhone
          Settings app.
        </p>
      </section>

      <section class="card">
        <p class="eyebrow">Our server</p>
        <h2>Anonymous play stats</h2>
        <p>
          When you play the live daily road, the app tells our server when you
          start and when you solve it exactly. Each message holds your random
          player ID, the road number, the mode (Classic or Expedition) and a
          session ID. A solve also holds your try number, the number of moves,
          hints used and solve time.
        </p>
        <p>
          We use this only to show community numbers, such as how many players
          solved a road and how many tries it took. Practice, Past Roads, and
          replays are never sent.
        </p>
        <p>
          <strong>To turn it off</strong> on iPhone, open Settings in GoldRoad
          and turn off <em>Share anonymous play stats</em>. When it is off, the
          app sends no play stats.
        </p>
      </section>

      <section class="card">
        <p class="eyebrow">Hints</p>
        <h2>Live hint requests</h2>
        <p>
          A hint on the daily road is worked out by our server. When you tap
          Hint, the app sends the road number, the mode, your try number, your route so far, your
          random player ID and a session ID. The server sends back the next
          steps. Hints work even when play stats are off, because the hint
          cannot be made without this request. We do not save hint requests as
          play stats.
        </p>
        <p>
          To stop abuse, the server limits how many hints one player ID and one
          network address can ask for in a short time. Our hosting provider
          (Cloudflare) handles the network address for this limit. Error logs
          can hold a short part of the player ID.
        </p>
      </section>

      <section class="card">
        <p class="eyebrow">Keeping and deleting</p>
        <h2>Retention and deletion</h2>
        <ul class="privacy-list">
          <li>
            Data on your device stays until you delete the app (or clear your
            browser’s site data on the web).
          </li>
          <li>
            iCloud data stays in your iCloud account. You can turn off iCloud
            for GoldRoad at any time.
          </li>
          <li>
            Play stats on our server are kept to build community numbers.
            <!-- REVIEW: state the real retention period here, for example
                 "for up to 2 years", once it is decided. There is no automatic
                 deletion job today. -->
          </li>
          <li>
            Because play stats are not linked to you, we cannot find them from
            your name or email. If you want your play stats deleted, email us
            and we will help you find your player ID.
          </li>
        </ul>
      </section>

      <section class="card">
        <p class="eyebrow">Children</p>
        <p>
          GoldRoad is suitable for all ages and does not knowingly collect
          personal information from anyone, including children.
        </p>
      </section>

      <section class="card">
        <p class="eyebrow">Contact</p>
        <p>
          Questions or requests:
          <a href="mailto:hello@playgoldroad.com?subject=%5BGoldRoad%5D%20Privacy"
            >hello@playgoldroad.com</a
          >. If this policy changes, we will update this page and the date at
          the top.
        </p>
      </section>
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

.updated {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.7);
  font-size: var(--font-size-caption);
}

.eyebrow {
  margin: 0;
  font-size: var(--font-size-caption);
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(var(--color-gold-rgb) / 0.75);
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

.card p,
.privacy-list {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.82);
  line-height: var(--line-height-base);
}

.card a {
  color: var(--color-gold);
}

.privacy-list {
  padding-left: 1.2rem;
  display: grid;
  gap: 0.5rem;
}

.privacy-list li::marker {
  color: rgb(var(--color-gold-rgb) / 0.6);
}

@media (max-width: 480px) {
  .shell {
    padding: 1rem;
  }
}
</style>
