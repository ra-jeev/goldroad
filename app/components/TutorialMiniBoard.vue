<script setup lang="ts">
import type { EdgeType } from '../../shared/types/game';
import GameTile from './GameTile.vue';
import RoadGlyph from './RoadGlyph.vue';

const props = defineProps<{
  fromValue: number;
  toValue: number;
  edgeType: EdgeType | 'open';
  isStart?: boolean;
  isEnd?: boolean;
  modifierLabel?: string;
}>();
</script>

<template>
  <div class="mini-board" aria-hidden="true">
    <GameTile
      :value="fromValue"
      :is-start="Boolean(isStart)"
      :is-end="false"
      :is-current="false"
      :is-active="false"
      :is-done="false"
      :is-hinted="false"
      disabled
    />

    <span class="mini-road">
      <RoadGlyph :type="edgeType" state="default" />
      <span v-if="modifierLabel" class="modifier-label">
        {{ modifierLabel }}
      </span>
    </span>

    <GameTile
      :value="toValue"
      :is-start="false"
      :is-end="Boolean(isEnd)"
      :is-current="false"
      :is-active="false"
      :is-done="false"
      :is-hinted="false"
      disabled
    />
  </div>
</template>

<style scoped>
.mini-board {
  --tile-size: 42px;
  --tile-gap: 0;

  display: grid;
  grid-template-columns: var(--tile-size) 3.4rem var(--tile-size);
  align-items: center;
  justify-content: center;
  min-width: 9.5rem;
}

.mini-road {
  position: relative;
  display: grid;
  place-items: center;
  height: 18px;
  margin: 0 0.25rem;
}

.modifier-label {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 0.25rem);
  transform: translateX(-50%);
  color: var(--color-gold-bright);
  font-size: 0.72rem;
  font-weight: 900;
}
</style>
