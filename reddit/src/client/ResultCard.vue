<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { context, showLoginPrompt } from '@devvit/web/client';
import { calcMedalForAttempt } from '#game/lib/gameTiers';
import type { Ballot, CommunityOptionId, CommunityPick, Medal, RoadMode, Standing } from '../shared/api';
import { postComment, postSubscribe, postVote } from './api';
import TrapMap from './TrapMap.vue';

const props = defineProps<{
  roadNo: number;
  board: { rows: number; cols: number; tiles: number[]; start: number; end: number };
  mode: RoadMode;
  commented: boolean;
  medal: Medal | null;
  attempts: number;
  hints: number;
  seconds: number | null;
  standing: Standing | null;
  ballot: Ballot | null;
  community: CommunityPick | null;
  loggedIn: boolean;
}>();
const emit = defineEmits<{ close: []; commented: []; voted: [ballot: Ballot] }>();

// The weekly vote on Sunday's road. Totals show once the player has voted.
const voting = ref<CommunityOptionId | null>(null);
const voteFailed = ref(false);

async function vote(option: CommunityOptionId) {
  if (!props.loggedIn || voting.value || props.ballot?.myVote === option) return;
  voting.value = option;
  voteFailed.value = false;
  try {
    emit('voted', (await postVote(option)).ballot);
  } catch (cause) {
    console.error('vote failed', cause);
    voteFailed.value = true;
  } finally {
    voting.value = null;
  }
}

const showTotals = computed(() => !!props.ballot && (!!props.ballot.myVote || !props.loggedIn) && props.ballot.total > 0);

function share(votes: number): number {
  const total = props.ballot?.total ?? 0;
  return total ? Math.round((votes / total) * 100) : 0;
}

const sundayLabel = computed(() => {
  if (!props.ballot) return '';
  const date = new Date(`${props.ballot.sunday}T00:00:00Z`);
  const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `Sun ${date.getUTCDate()} ${month}`;
});

// The two Reddit actions. Each is the player's own tap, never automatic.
const subreddit = context.subredditName ?? null;
const commentState = ref<'idle' | 'sending' | 'done' | 'failed'>(props.commented ? 'done' : 'idle');
const joinState = ref<'idle' | 'sending' | 'done' | 'failed'>('idle');

async function shareComment() {
  if (commentState.value === 'sending' || commentState.value === 'done') return;
  commentState.value = 'sending';
  try {
    await postComment(props.mode);
    commentState.value = 'done';
    emit('commented');
  } catch (cause) {
    console.error('comment failed', cause);
    commentState.value = 'failed';
  }
}

async function join() {
  if (joinState.value !== 'idle' && joinState.value !== 'failed') return;
  joinState.value = 'sending';
  try {
    await postSubscribe();
    joinState.value = 'done';
  } catch (cause) {
    console.error('join failed', cause);
    joinState.value = 'failed';
  }
}

const COMMENT_LABEL = {
  idle: 'Post my result as a comment',
  sending: 'Posting…',
  done: 'Result posted ✓',
  failed: 'Could not post. Try again',
} as const;


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
      <p class="eyebrow">GoldRoad #{{ roadNo }} · {{ community ? `Community road: ${community.label}` : 'Classic' }}</p>
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

        <TrapMap
          v-if="standing.trap"
          :trap="standing.trap"
          :tiles="board.tiles"
          :rows="board.rows"
          :cols="board.cols"
          :start="board.start"
          :end="board.end"
        />

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

      <section v-if="ballot" class="ballot" aria-labelledby="ballot-title">
        <h3 id="ballot-title" class="ballot-title">Shape Sunday's road</h3>
        <p class="fine">
          <template v-if="!loggedIn">Log in to vote. </template>
          One vote for {{ sundayLabel }}. You can change it until then.
        </p>
        <div class="choices">
          <button
            v-for="option in ballot.options"
            :key="option.id"
            type="button"
            class="choice"
            :class="{ 'choice--mine': ballot.myVote === option.id }"
            :disabled="!loggedIn || !!voting"
            :aria-pressed="ballot.myVote === option.id"
            :style="showTotals ? { '--share': `${share(option.votes)}%` } : undefined"
            @click="vote(option.id)"
          >
            <span class="choice-label">{{ option.label }}</span>
            <span class="choice-blurb">{{ option.blurb }}</span>
            <span v-if="showTotals" class="choice-share">{{ share(option.votes) }}%</span>
          </button>
        </div>
        <p v-if="voteFailed" class="fine">Could not save your vote. Try again.</p>
        <p v-else-if="showTotals" class="fine">{{ plural(ballot.total, 'vote', 'votes') }} so far</p>
      </section>

      <button v-if="!loggedIn" type="button" class="action action--primary" @click="showLoginPrompt()">
        Log in to save your streak and rank
      </button>

      <template v-if="loggedIn">
        <button
          type="button"
          class="action action--primary"
          :disabled="commentState === 'sending' || commentState === 'done'"
          @click="shareComment"
        >
          {{ COMMENT_LABEL[commentState] }}
        </button>
        <p v-if="commentState !== 'done'" class="fine">
          Posts from your account as a reply to the pinned comment. No route, no spoilers.
        </p>
      </template>

      <div class="pair">
        <button type="button" class="action" @click="emit('close')">See the board</button>
        <button
          v-if="loggedIn && subreddit"
          type="button"
          class="action"
          :disabled="joinState === 'sending' || joinState === 'done'"
          @click="join"
        >
          {{ joinState === 'done' ? 'Joined ✓' : joinState === 'failed' ? 'Try again' : `Join r/${subreddit}` }}
        </button>
      </div>

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
  grid-template-columns: minmax(0, 1fr);
  overflow-y: auto;
}

.card {
  width: min(100%, 420px);
  min-width: 0;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
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

.action:disabled {
  opacity: 0.6;
  cursor: default;
}

.pair {
  display: flex;
  gap: 8px;
  width: 100%;
}

.pair .action {
  flex: 1;
  min-width: 0;
  padding: 0 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fine {
  margin: -4px 0 0;
  font-size: 0.75rem;
  color: var(--color-gold-muted);
}

.action--primary {
  border-color: transparent;
  background: var(--gradient-button-primary);
  color: var(--color-text-on-gold);
}

.ballot {
  display: grid;
  gap: 6px;
  width: 100%;
}

.ballot-title {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-gold-bright);
}

.choices {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.choice {
  position: relative;
  display: grid;
  align-content: start;
  gap: 2px;
  min-height: 64px;
  padding: 8px 6px;
  overflow: hidden;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.35);
  border-radius: var(--radius-sm);
  background: linear-gradient(
    to top,
    rgb(var(--color-gold-rgb) / 0.18) var(--share, 0%),
    rgb(var(--color-gold-rgb) / 0.05) var(--share, 0%)
  );
  color: var(--color-gold);
  font: inherit;
  cursor: pointer;
}

.choice:disabled {
  cursor: default;
}

.choice--mine {
  border-color: var(--color-gold-bright);
  box-shadow: inset 0 0 0 1px var(--color-gold-bright);
}

.choice-label {
  font-weight: 800;
  font-size: 0.88rem;
}

.choice-blurb {
  font-size: 0.72rem;
  line-height: 1.2;
  color: var(--color-gold-muted);
}

.choice-share {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--color-gold-bright);
}

.next {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-gold-muted);
}
</style>
