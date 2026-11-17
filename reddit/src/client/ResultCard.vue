<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { showLoginPrompt } from '@devvit/web/client';
import { calcMedalForAttempt } from '#game/lib/gameTiers';
import type { Medal, Standing } from '../shared/api';

const props = defineProps<{
  roadNo: number;
  medal: Medal | null;
  attempts: number;
  hints: number;
  seconds: number | null;
  standing: Standing | null;
  loggedIn: boolean;
}>();
defineEmits<{ close: [] }>();

const MEDAL_ICON: Record<Medal, string> = { gold: '🥇', silver: '🥈', bronze: '🥉' };

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function duration(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const headline = computed(() => {
  const name = props.medal ? `${props.medal[0]!.toUpperCase()}${props.medal.slice(1)}` : 'Solved';
  return `${name} on the ${ordinal(props.attempts)} try`;
});

const rankLine = computed(() => {
  const standing = props.standing;
  if (!standing?.rank) return null;
  return `#${standing.rank} of ${standing.players} today`;
});

const streakLine = computed(() => {
  const streak = props.standing?.streak ?? 0;
  if (streak < 1) return null;
  return streak === 1 ? 'Day 1 of your road' : `${streak}-day road`;
});

/** Rows with a gap marker where the list jumps (top 10, then the player). */
const rows = computed(() =>
  (props.standing?.rows ?? []).map((row, i, all) => ({
    ...row,
    gapBefore: i > 0 && row.rank - all[i - 1]!.rank > 1,
    medal: calcMedalForAttempt(row.attempts, true),
  })),
);

// Keep the player's own row in view when it is below the top 10.
const list = ref<HTMLOListElement | null>(null);
watch(
  () => props.standing,
  async () => {
    await nextTick();
    const own = list.value?.querySelector<HTMLElement>('.row--me');
    if (list.value && own) list.value.scrollTop = own.offsetTop - list.value.clientHeight / 2;
  },
  { immediate: true },
);

// The next road comes at 00:00 UTC.
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 30_000)));
onBeforeUnmount(() => clearInterval(timer));

const nextRoad = computed(() => {
  const next = new Date(now.value);
  next.setUTCHours(24, 0, 0, 0);
  const minutes = Math.max(1, Math.ceil((next.getTime() - now.value) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
});
</script>

<template>
  <div class="scrim">
    <section class="card" role="dialog" aria-modal="true" aria-labelledby="result-headline">
      <p class="eyebrow">GoldRoad #{{ roadNo }} · Classic</p>
      <p class="medal" aria-hidden="true">{{ medal ? MEDAL_ICON[medal] : '✨' }}</p>
      <h2 id="result-headline" class="headline">{{ headline }}</h2>

      <dl class="numbers">
        <div>
          <dt>Tries</dt>
          <dd>{{ attempts }}</dd>
        </div>
        <div>
          <dt>Hints</dt>
          <dd>{{ hints }}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{{ seconds === null ? '–' : duration(seconds) }}</dd>
        </div>
      </dl>

      <template v-if="standing">
        <p v-if="!standing.counted" class="note">
          Practice road. It does not count for your streak or the board.
        </p>
        <p v-else class="standing">
          <span v-if="rankLine">{{ rankLine }}</span>
          <span v-if="streakLine" class="streak">🔥 {{ streakLine }}</span>
        </p>

        <ol v-if="rows.length" ref="list" class="board" aria-label="Today's leaderboard">
          <li
            v-for="row in rows"
            :key="row.rank"
            class="row"
            :class="{ 'row--me': row.me, 'row--gap': row.gapBefore }"
          >
            <span class="rank">{{ row.rank }}</span>
            <span class="row-medal" aria-hidden="true">{{ row.medal ? MEDAL_ICON[row.medal] : '' }}</span>
            <span class="who">
              <span class="name">u/{{ row.name }}</span>
              <span class="detail">
                {{ plural(row.attempts, 'try', 'tries') }}<template v-if="row.hints">
                  · {{ plural(row.hints, 'hint', 'hints') }}</template>
              </span>
            </span>
            <span class="time">{{ duration(row.seconds) }}</span>
          </li>
        </ol>
      </template>

      <button v-if="!loggedIn" type="button" class="action action--primary" @click="showLoginPrompt()">
        Log in to save your streak and rank
      </button>

      <button type="button" class="action" @click="$emit('close')">See the board</button>

      <p class="next">Next road in {{ nextRoad }}</p>
    </section>
  </div>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  align-items: end;
  justify-items: center;
  padding: 12px 12px max(12px, env(safe-area-inset-bottom));
  background: rgb(0 0 0 / 0.55);
  overflow-y: auto;
}

.card {
  width: min(100%, 420px);
  display: grid;
  gap: 10px;
  justify-items: center;
  padding: 18px 16px 14px;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.4);
  border-radius: var(--radius-lg, 16px);
  background: var(--gradient-bg-main);
  color: var(--color-gold);
  text-align: center;
  box-shadow: 0 -8px 32px rgb(0 0 0 / 0.5);
}

.eyebrow {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-gold-muted);
}

.medal {
  margin: 0;
  font-size: 2.75rem;
  line-height: 1;
}

.headline {
  margin: 0;
  font-size: 1.4rem;
  color: var(--color-gold-bright);
}

.numbers {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: 100%;
  margin: 0;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.3);
  border-radius: var(--radius-sm);
  background: var(--gradient-card-metric);
}

.numbers div {
  padding: 6px 4px;
}

.numbers div + div {
  border-left: 1px solid rgb(var(--color-gold-rgb) / 0.2);
}

.numbers dt {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-gold-muted);
}

.numbers dd {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.standing {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 14px;
  font-weight: 700;
  color: var(--color-gold-bright);
}

.streak {
  color: var(--color-gold);
}

.note {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-gold-muted);
}

.board {
  position: relative;
  width: 100%;
  max-height: 34vh;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  text-align: left;
}

.row {
  display: grid;
  grid-template-columns: 1.8em 1.4em minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.row--gap {
  margin-top: 10px;
  position: relative;
}

.row--gap::before {
  content: '⋯';
  position: absolute;
  top: -13px;
  left: 0;
  right: 0;
  text-align: center;
  color: var(--color-gold-muted);
  font-size: 0.8rem;
}

.row--me {
  background: rgb(var(--color-gold-rgb) / 0.16);
  color: var(--color-gold-bright);
  font-weight: 700;
}

.rank {
  color: var(--color-gold-muted);
}

.row-medal {
  font-size: 1.05rem;
  line-height: 1;
}

.who {
  display: grid;
  min-width: 0;
  line-height: 1.25;
}

.time {
  font-weight: 700;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail {
  font-size: 0.78rem;
  color: var(--color-gold-muted);
}

.action {
  width: 100%;
  min-height: 44px;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.5);
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.08);
  color: var(--color-gold);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.action--primary {
  border-color: transparent;
  background: var(--gradient-button-primary);
  color: var(--color-text-on-gold);
}

.next {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-gold-muted);
}
</style>
