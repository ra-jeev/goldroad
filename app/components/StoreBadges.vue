<script setup lang="ts">
// The official store badges, served from public/badges so a visit makes no
// request to Apple or Google. Apple and Google ask that the artwork is not
// changed, so only the height is set here.
defineProps<{ label?: string }>();

const APP_STORE_URL = 'https://apps.apple.com/app/id6838678223';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.playgoldroad.android';
</script>

<template>
  <div class="store-badges">
    <p v-if="label" class="store-badges-label">{{ label }}</p>
    <div class="store-badges-row">
      <a :href="APP_STORE_URL" target="_blank" rel="noreferrer">
        <img src="/badges/app-store.svg" alt="Download on the App Store" width="120" height="40" />
      </a>
      <a :href="PLAY_STORE_URL" target="_blank" rel="noreferrer">
        <img class="play-badge" src="/badges/google-play.png" alt="Get it on Google Play" width="646" height="250" />
      </a>
    </div>
  </div>
</template>

<style scoped>
.store-badges {
  display: grid;
  gap: 0.6rem;
  justify-items: center;
}

.store-badges-label {
  margin: 0;
}

.store-badges-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
}

.store-badges-row a {
  display: block;
  line-height: 0;
}

.store-badges-row img {
  height: 40px;
  width: auto;
}

/* Google's badge PNG carries clear space of 41 px around a 168 px tall badge.
   Scale it so the badge itself is 40 px tall, like Apple's, and pull the
   clear space back in so the two line up. */
.store-badges-row .play-badge {
  height: calc(40px * 250 / 168);
  margin: calc(-40px * 41 / 168);
}
</style>
