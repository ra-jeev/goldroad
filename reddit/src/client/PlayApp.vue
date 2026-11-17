<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { RoadResponse } from '../shared/api';
import { fetchRoad } from './api';

const state = ref<RoadResponse | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    state.value = await fetchRoad();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
});
</script>

<template>
  <main class="play">
    <p v-if="error" class="status" role="alert">Could not load the road. {{ error }}</p>
    <p v-else-if="!state" class="status">Loading the road…</p>
    <template v-else>
      <header class="header">
        <h1>GoldRoad #{{ state.road.roadNo }}</h1>
        <p>Target {{ state.road.target }}</p>
      </header>
      <div
        class="board"
        :style="{ gridTemplateColumns: `repeat(${state.road.board.cols}, auto)` }"
      >
        <span
          v-for="(value, id) in state.road.board.tiles"
          :key="id"
          class="tile"
          :class="{ start: id === state.road.board.start, end: id === state.road.board.end }"
        >{{ value }}</span>
      </div>
    </template>
  </main>
</template>

<style scoped>
.play {
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
}

.header {
  text-align: center;
}

.header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.header p {
  margin: 0.25rem 0 0;
  color: var(--color-gold);
  font-weight: 700;
}

.board {
  display: grid;
  gap: 10px;
}

.tile {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 3px solid var(--color-gold);
  font-variant-numeric: tabular-nums;
}

.tile.start,
.tile.end {
  background: var(--color-gold);
  color: var(--color-text-on-gold);
}

.status {
  color: var(--color-gold-muted);
}
</style>
