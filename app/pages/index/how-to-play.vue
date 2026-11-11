<script setup lang="ts">
import { HOW_TO_PLAY_SEO } from '../../content/howToPlayContent';

// A child of the board page: /how-to-play is the board with the rules sheet
// open over it. That gives the rules an address to link to and to index,
// while a road in progress stays mounted underneath.
useSeoMeta({
  title: HOW_TO_PLAY_SEO.title,
  description: HOW_TO_PLAY_SEO.description,
  ogTitle: HOW_TO_PLAY_SEO.title,
  ogDescription: HOW_TO_PLAY_SEO.description,
});
</script>

<template>
  <GameHelpSheet />
</template>
