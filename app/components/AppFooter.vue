<script setup lang="ts">
import { UI_COPY } from '../content/uiCopy';

// Rendered by the default layout, so it sits on every page. On the board
// pages the game shell already fills the viewport, which leaves this below
// the fold where it costs the game nothing.
</script>

<template>
  <footer class="contact-footer">
    <p>
      <!-- The glyph is the brand mark, so the word "X" would only repeat it.
           The link's aria-label carries the name for screen readers. -->
      Follow GoldRoad on
      <a
        href="https://x.com/thegoldroad"
        target="_blank"
        rel="noreferrer"
        aria-label="GoldRoad on X, @thegoldroad"
      >
        <svg class="x-glyph" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M18.9 2.3h3.4l-7.5 8.5 8.8 11.6h-6.9l-5.4-7-6.2 7H1.7l8-9.1L1.3 2.3h7l4.9 6.4zm-1.2 18h1.9L6.6 4.2H4.5z"
          />
        </svg>
        <span>@thegoldroad</span>
      </a>
    </p>
    <p>
      Made with ❤️ &amp; ☕, by
      <a href="https://x.com/ra_jeeves" target="_blank" rel="noreferrer">
        @ra_jeeves
      </a>
    </p>
    <p>
      For feedback, or anything else,
      <a :href="UI_COPY.contact.generalMailto">get in touch</a>.
    </p>
  </footer>
</template>

<style scoped>
/* Standing in the layout rather than inside a page's container, this owns
   its own measure and edge padding so the copy never runs to the screen
   edge on a phone. */
.contact-footer {
  display: grid;
  gap: 0.5rem;
  max-width: 720px;
  margin: 0 auto;
  padding: 1.4rem clamp(0.9rem, 3vw, 1.45rem) 1.8rem;
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

.contact-footer a:has(.x-glyph) {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
}

.x-glyph {
  width: 0.82em;
  height: 0.82em;
  fill: currentColor;
  /* Baseline-aligned flex puts the glyph box's baseline at its bottom edge,
     which rides high next to the text; nudge it back onto the x-height. */
  transform: translateY(0.06em);
}
</style>
