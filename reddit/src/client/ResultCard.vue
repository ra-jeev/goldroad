<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { context, showLoginPrompt } from '@devvit/web/client';
import { calcMedalForAttempt } from '#game/lib/gameTiers';
import type { Ballot, CommunityOptionId, CommunityPick, Medal, RoadMode, Standing } from '../shared/api';
import { postComment, postSubscribe, postVote } from './api';
import TrapMap from './TrapMap.vue';
import { localDayTime } from './localTime';

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
  /** Classic is solved and Expedition is not: offer it. */
  expeditionOpen?: boolean;
}>();
const emit = defineEmits<{ close: []; commented: []; voted: [ballot: Ballot]; expedition: [] }>();

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

// The vote closes when Sunday's road is made: 23:30 UTC on Saturday.
const voteCloses = computed(() =>
  props.ballot ? localDayTime(Date.parse(`${props.ballot.sunday}T00:00:00Z`) - 30 * 60 * 1000) : '',
);

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

// The same words as the streak flair on Reddit.
const streakLine = computed(() => {
  const streak = props.standing?.streak ?? 0;
  return streak < 1 ? null : `${streak}-day streak`;
});

const summary = computed(() =>
  [
    plural(props.attempts, 'try', 'tries'),
    plural(props.hints, 'hint', 'hints'),
    props.seconds === null ? null : duration(props.seconds),
  ]
    .filter(Boolean)
    .join(' · '),
);

// The trap map is off until there are enough players to make it useful.
const SHOW_TRAP = false;

// Board, trap and vote share one panel. Only one shows at a time.
type Tab = 'board' | 'trap' | 'vote';
const tabs = computed(() => {
  const list: { id: Tab; label: string }[] = [];
  if (props.standing?.counted && props.standing.rows.length) list.push({ id: 'board', label: 'Leaderboard' });
  if (SHOW_TRAP && props.standing?.trap) list.push({ id: 'trap', label: 'Trap' });
  if (props.ballot) list.push({ id: 'vote', label: 'Vote' });
  return list;
});
const tab = ref<Tab | null>(null);
const activeTab = computed(() => tabs.value.find((item) => item.id === tab.value)?.id ?? tabs.value[0]?.id ?? null);

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
  () => [props.standing, activeTab.value],
  async () => {
    await nextTick();
    const panel = list.value?.parentElement;
    const own = list.value?.querySelector<HTMLElement>('.row--me');
    if (panel && own) panel.scrollTop = own.offsetTop - panel.clientHeight / 2;
  },
  { immediate: true },
);

// Escape closes the card, the same as the close button.
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

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
      <button type="button" class="close" aria-label="Close and see the board" @click="emit('close')">✕</button>
      <p class="eyebrow">
        GoldRoad #{{ roadNo }} · {{ mode === 'classic' ? 'Classic' : 'Expedition' }}<template v-if="community">
          · {{ community.label }}</template>
      </p>
      <h2 id="result-headline" class="headline">
        <span class="medal" aria-hidden="true">{{ medal ? MEDAL_ICON[medal] : '✨' }}</span>
        {{ headline }}
      </h2>
      <p class="summary">{{ summary }}</p>

      <p v-if="standing && !standing.counted" class="note">Practice road. It does not count.</p>
      <p v-else-if="standing && (rankLine || streakLine)" class="standing">
        <span v-if="rankLine">{{ rankLine }}</span>
        <span v-if="streakLine" class="streak">🔥 {{ streakLine }}</span>
      </p>

      <button v-if="!loggedIn" type="button" class="action action--primary" @click="showLoginPrompt()">
        Log in to save your streak and rank
      </button>
      <button
        v-else
        type="button"
        class="action action--primary"
        :disabled="commentState === 'sending' || commentState === 'done'"
        @click="shareComment"
      >
        {{ COMMENT_LABEL[commentState] }}
      </button>

      <button v-if="expeditionOpen" type="button" class="action" @click="emit('expedition')">
        Continue to Expedition
      </button>

      <div v-if="tabs.length" class="tabbed">
        <div v-if="tabs.length > 1" class="tabs" role="tablist" aria-label="Today on this road">
          <button
            v-for="item in tabs"
            :id="`tab-${item.id}`"
            :key="item.id"
            type="button"
            role="tab"
            class="tab"
            :class="{ 'tab--active': activeTab === item.id }"
            :aria-selected="activeTab === item.id"
            :aria-controls="`panel-${item.id}`"
            @click="tab = item.id"
          >
            {{ item.label }}
          </button>
        </div>

        <div :id="`panel-${activeTab}`" class="panel" role="tabpanel" :aria-labelledby="`tab-${activeTab}`">
          <ol v-if="activeTab === 'board'" ref="list" class="board" aria-label="Today's leaderboard">
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

          <TrapMap
            v-else-if="activeTab === 'trap' && standing?.trap"
            :trap="standing.trap"
            :tiles="board.tiles"
            :rows="board.rows"
            :cols="board.cols"
            :start="board.start"
            :end="board.end"
          />

          <div v-else-if="activeTab === 'vote' && ballot" class="ballot">
            <p class="ballot-title">Shape Sunday's road, {{ sundayLabel }}</p>
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
                <span class="choice-text">
                  <span class="choice-label">{{ option.label }}</span>
                  <span class="choice-blurb">{{ option.blurb }}</span>
                </span>
                <span v-if="showTotals" class="choice-share">{{ share(option.votes) }}%</span>
              </button>
            </div>
            <p class="fine">
              <template v-if="voteFailed">Could not save your vote. Try again.</template>
              <template v-else-if="!loggedIn">Log in to vote.</template>
              <template v-else-if="!ballot.myVote">One vote. You can change it until {{ voteCloses }}.</template>
              <template v-else>{{ plural(ballot.total, 'vote', 'votes') }} so far</template>
            </p>
          </div>
        </div>
      </div>

      <div class="next">
        <p class="next-label">Next road in</p>
        <p class="next-time">{{ nextRoad }}</p>
        <button
          v-if="loggedIn && subreddit"
          type="button"
          class="link"
          :disabled="joinState === 'sending' || joinState === 'done'"
          @click="join"
        >
          {{ joinState === 'done' ? 'Joined ✓' : joinState === 'failed' ? 'Try again' : `Join r/${subreddit}` }}
        </button>
      </div>
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
  position: relative;
  width: min(100%, 420px);
  min-width: 0;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  justify-items: center;
  padding: 18px 16px 16px;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.4);
  border-radius: var(--radius-lg, 16px);
  background: var(--gradient-bg-main);
  color: var(--color-gold);
  text-align: center;
  box-shadow: 0 -8px 32px rgb(0 0 0 / 0.5);
}

.close {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-gold-muted);
  font: inherit;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
}

.close:hover,
.close:focus-visible {
  background: rgb(var(--color-gold-rgb) / 0.12);
  color: var(--color-gold-bright);
}

.eyebrow {
  margin: 0;
  padding: 0 36px;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-gold-muted);
}

.medal {
  margin-right: 4px;
  font-size: 1.6rem;
  vertical-align: -0.15em;
}

.headline {
  margin: 0;
  font-size: 1.35rem;
  color: var(--color-gold-bright);
}

.summary {
  margin: -6px 0 0;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-gold);
}

.tabbed {
  display: grid;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.25);
  border-radius: var(--radius-full);
}

.tab {
  flex: 1;
  min-height: 32px;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-gold-muted);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.tab--active {
  background: rgb(var(--color-gold-rgb) / 0.16);
  color: var(--color-gold-bright);
}

/* One height for every tab, so the card does not jump. */
.panel {
  height: min(240px, 34vh);
  overflow-y: auto;
  display: grid;
  align-content: start;
}

.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-gold);
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.link:disabled {
  cursor: default;
  text-decoration: none;
}

.standing {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 4px 14px;
  font-weight: 700;
  line-height: 1.4;
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
  font-size: 0.9rem;
  color: var(--color-gold-bright);
}

.choices {
  display: grid;
  gap: 6px;
}

.choice {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 8px 12px;
  overflow: hidden;
  text-align: left;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.35);
  border-radius: var(--radius-sm);
  background: linear-gradient(
    to right,
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

.choice-text {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 1px;
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
  display: grid;
  justify-items: center;
  gap: 2px;
  font-size: 0.85rem;
  color: var(--color-gold-muted);
}

.next-label {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.next-time {
  margin: 0 0 4px;
  font-size: 1.9rem;
  font-weight: 800;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--color-gold-bright);
}
</style>
