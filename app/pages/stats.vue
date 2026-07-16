<script setup lang="ts">
import { calcMedalForAttempt } from '../../lib/gameTiers';
import type { CommunityRoadStats, Medal, PuzzleType } from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';
import { useRoadResultShare } from '../composables/useRoadResultShare';
import type { HistogramBar } from '../components/StatsTriesHistogram.vue';

const localStats = useLocalPlayerStats();
const localProgress = useLocalGameProgress();
const statsApi = useStatsApi();
const roadResultShare = useRoadResultShare();

const summary = localStats.summary;
const recentDays = localStats.recentDays;

const communityOverview = ref<Awaited<
  ReturnType<typeof statsApi.getOverview>
> | null>(null);
const communityError = ref<string | null>(null);
const loading = ref(true);

const selectedMode = ref<PuzzleType>('classic');
const showFieldDetail = ref(false);
const COMMUNITY_SAMPLE_MIN = 5;

const todayShare = ref<{ busy: boolean; feedback: FeedbackMessage | null }>({
  busy: false,
  feedback: null,
});
type FeedbackMessage = { kind: 'success' | 'error'; message: string };

type PlayerRoadResult = {
  attempts: number;
  solved: boolean;
  hintsUsed: number;
  solveTimeMs: number | null;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatModeLabel(mode: PuzzleType): string {
  return mode === 'classic'
    ? UI_COPY.boardHeader.classic
    : UI_COPY.boardHeader.expedition;
}

function formatMedal(medal: Medal | null): string {
  return medal ? UI_COPY.boardHeader.medals[medal] : UI_COPY.boardHeader.solvedBadge;
}

function formatRunCount(attempts: number): string {
  return UI_COPY.celebration.attemptLabel(attempts);
}

function formatDurationMs(value: number | null): string {
  if (value === null) return '—';
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0
    ? `${minutes}m ${String(seconds).padStart(2, '0')}s`
    : `${seconds}s`;
}

function toPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

// ---------------------------------------------------------------------------
// Per-game local results (durable history keyed by gameNo + mode)
// ---------------------------------------------------------------------------

const resultsByGame = computed(() => {
  const map = new Map<string, PlayerRoadResult>();

  for (const day of recentDays.value) {
    (['classic', 'expedition'] as const).forEach((mode) => {
      const record = day.modes[mode];
      if (record) {
        map.set(`${mode}:${day.gameNo}`, record);
      }
    });
  }

  return map;
});

function playerResult(
  gameNo: number | null,
  mode: PuzzleType,
): PlayerRoadResult | null {
  if (gameNo === null) return null;
  return resultsByGame.value.get(`${mode}:${gameNo}`) ?? null;
}

function medalOf(result: PlayerRoadResult | null): Medal | null {
  if (!result) return null;
  return calcMedalForAttempt(result.attempts, result.solved);
}

/**
 * Which histogram bucket the player's own attempt lands in.
 * 0 first · 1 second · 2 third · 3 four-plus · 4 unsolved · -1 not played.
 */
function bucketOf(result: PlayerRoadResult | null): number {
  if (!result || (result.attempts === 0 && !result.solved)) return -1;
  if (result.solved) {
    if (result.attempts <= 1) return 0;
    if (result.attempts === 2) return 1;
    if (result.attempts === 3) return 2;
    return 3;
  }
  return 4;
}

// ---------------------------------------------------------------------------
// Community tries distribution
// ---------------------------------------------------------------------------

function bucketCounts(stat: CommunityRoadStats): number[] {
  const late = Math.max(stat.exactSolves - stat.gold - stat.silver - stat.bronze, 0);
  const dnf = Math.max(stat.plays - stat.exactSolves, 0);
  return [stat.gold, stat.silver, stat.bronze, late, dnf];
}

function buildTriesBars(
  stat: CommunityRoadStats,
  playerBucket: number,
): HistogramBar[] {
  const captions = ['First attempt', 'Second attempt', 'Third attempt', '4+ attempts', 'Still going'];
  const labels = ['1', '2', '3', '4+', 'DNF'];

  return bucketCounts(stat).map((count, index) => ({
    key: String(index),
    label: labels[index]!,
    caption: captions[index]!,
    count,
    isPlayer: index === playerBucket,
  }));
}

/**
 * v1's "top X%": the share of the whole field that did as well as or better
 * than the player, the player included. Smaller is better.
 */
function topPercent(stat: CommunityRoadStats, playerBucket: number): number {
  if (playerBucket < 0 || stat.plays <= 0) return 0;
  const counts = bucketCounts(stat);
  const atOrBetter = counts
    .slice(0, playerBucket + 1)
    .reduce((sum, value) => sum + value, 0);
  return Math.max(1, toPercent(atOrBetter, stat.plays));
}

// ---------------------------------------------------------------------------
// Medals (cross-mode, always visible) with the +1 moment
// ---------------------------------------------------------------------------

const todayGameNo = computed(
  () =>
    communityOverview.value?.currentGameNo ??
    localProgress.currentRoadContext.value.currentGameNo ??
    null,
);

/** Medals earned on today's road, per tier, across both modes. */
const medalsEarnedToday = computed<Record<Medal, number>>(() => {
  const earned: Record<Medal, number> = { gold: 0, silver: 0, bronze: 0 };
  const gameNo = todayGameNo.value;
  if (gameNo === null) return earned;

  (['classic', 'expedition'] as const).forEach((mode) => {
    const medal = medalOf(playerResult(gameNo, mode));
    if (medal) earned[medal] += 1;
  });

  return earned;
});

const medalTiles = computed(() =>
  (['gold', 'silver', 'bronze'] as const).map((tier, index) => ({
    key: tier,
    label: UI_COPY.boardHeader.medals[tier],
    sub: `${index + 1} attempt${index === 0 ? '' : 's'}`,
    count: summary.value.medalCounts[tier],
    earnedToday: medalsEarnedToday.value[tier],
  })),
);

// ---------------------------------------------------------------------------
// Today's road (the player's own result — no community data for a road
// still in progress)
// ---------------------------------------------------------------------------

const todayResult = computed(() =>
  playerResult(todayGameNo.value, selectedMode.value),
);

const todayCard = computed(() => {
  const result = todayResult.value;
  const gameNo = todayGameNo.value;

  if (!result || (result.attempts === 0 && !result.solved)) {
    return {
      state: 'unplayed' as const,
      eyebrow: 'Today’s road',
      title: gameNo ? `Road ${gameNo} is waiting` : 'Today’s road is waiting',
      detail:
        selectedMode.value === 'classic'
          ? 'Chart today’s Classic road to start your streak.'
          : 'Solve Classic, then take on today’s Expedition.',
    };
  }

  if (result.solved) {
    const medal = medalOf(result);
    return {
      state: 'solved' as const,
      eyebrow: 'Today’s road · solved',
      title: gameNo ? `Road ${gameNo}` : 'Today’s road',
      badge: formatMedal(medal),
      medal,
      chips: [
        formatRunCount(result.attempts),
        result.solveTimeMs !== null ? formatDurationMs(result.solveTimeMs) : null,
        result.hintsUsed > 0
          ? `${result.hintsUsed} hint${result.hintsUsed === 1 ? '' : 's'}`
          : null,
      ].filter((chip): chip is string => Boolean(chip)),
    };
  }

  return {
    state: 'inprogress' as const,
    eyebrow: 'Today’s road · in progress',
    title: gameNo ? `Road ${gameNo}` : 'Today’s road',
    detail: `${formatRunCount(result.attempts)} in${result.hintsUsed > 0 ? ` · ${result.hintsUsed} hint${result.hintsUsed === 1 ? '' : 's'}` : ''}. The solve is still out there.`,
  };
});

// ---------------------------------------------------------------------------
// Yesterday's road — the completed field, told v1's way
// ---------------------------------------------------------------------------

const yesterdayGameNo = computed(
  () => communityOverview.value?.yesterday.gameNo ?? null,
);

const yesterdayField = computed<CommunityRoadStats | null>(
  () => communityOverview.value?.yesterday[selectedMode.value] ?? null,
);

const yesterdayResult = computed(() =>
  playerResult(yesterdayGameNo.value, selectedMode.value),
);

const showYesterdayHistogram = computed(
  () =>
    Boolean(yesterdayField.value) &&
    yesterdayField.value!.plays >= COMMUNITY_SAMPLE_MIN,
);

const yesterdayBars = computed<HistogramBar[]>(() => {
  const field = yesterdayField.value;
  if (!field) return [];
  return buildTriesBars(field, bucketOf(yesterdayResult.value));
});

const yesterdayHeadline = computed(() => {
  const field = yesterdayField.value;
  const gameNo = yesterdayGameNo.value;
  if (!field || field.plays <= 0) return null;

  if (field.plays < COMMUNITY_SAMPLE_MIN) {
    return `Only ${field.plays} result${field.plays === 1 ? '' : 's'} posted for Road ${gameNo} — too small a field for a fair comparison.`;
  }

  return `${field.solveRate}% of the roadgoers who walked down Road ${gameNo} reached the finish.`;
});

const yesterdayPlayerLine = computed(() => {
  const field = yesterdayField.value;
  const result = yesterdayResult.value;
  if (!field || field.plays < COMMUNITY_SAMPLE_MIN) return null;

  if (result?.solved) {
    const top = topPercent(field, bucketOf(result));
    return `You got to the finish in ${formatRunCount(result.attempts)} — in the top ${top}% of the field.`;
  }

  if (result && result.attempts > 0) {
    return 'You walked it too — the finish stayed out of reach that day.';
  }

  return 'Walk down today’s road and come back tomorrow to see how you fared against the field.';
});

const yesterdayBehaviorRows = computed(() => {
  const field = yesterdayField.value;
  if (!field) return [];

  const rows = [
    `${field.behavior.hintUseRate}% reached for a hint · ${field.behavior.totalHints} hints in all`,
  ];

  if (field.behavior.averageSolveTimeMs !== null) {
    rows.push(`Field solve time averaged ${formatDurationMs(field.behavior.averageSolveTimeMs)}`);
  }
  if (field.behavior.averageDeadEndCount !== null) {
    rows.push(
      `Around ${field.behavior.averageDeadEndCount} dead end${field.behavior.averageDeadEndCount === 1 ? '' : 's'} per run on average`,
    );
  }

  return rows;
});

// ---------------------------------------------------------------------------
// Your stats — the v1 key-value record, mode-scoped
// ---------------------------------------------------------------------------

const modeSummary = computed(() => summary.value.modeBreakdown[selectedMode.value]);
const hasModeHistory = computed(() => modeSummary.value.sessionsPlayed > 0);

const recordRows = computed(() => {
  const stats = modeSummary.value;
  const dayWord = (count: number) => `${count} day${count === 1 ? '' : 's'}`;
  const roadWord = (count: number) => `${count} road${count === 1 ? '' : 's'}`;

  return [
    { key: 'streak', label: 'Current streak', value: dayWord(stats.currentStreak) },
    { key: 'bestStreak', label: 'Longest streak', value: dayWord(stats.bestStreak) },
    { key: 'played', label: 'Total treads', value: roadWord(stats.sessionsPlayed) },
    { key: 'solves', label: 'Total finishes', value: roadWord(stats.exactSolves) },
    { key: 'rate', label: 'Completion', value: `${stats.solveRate}%` },
    { key: 'avgAttempts', label: 'Average attempts', value: stats.averageSolvedAttempts },
    { key: 'avgTime', label: 'Average solve time', value: formatDurationMs(stats.averageSolveTimeMs) },
    { key: 'bestTime', label: 'Best solve time', value: formatDurationMs(stats.bestSolveTimeMs) },
    { key: 'hints', label: 'Hints used', value: String(stats.totalHints) },
  ];
});

function badgeClass(medal: Medal | null, solved: boolean) {
  return {
    'badge--solved': solved,
    'badge--gold': medal === 'gold',
    'badge--silver': medal === 'silver',
    'badge--bronze': medal === 'bronze',
  };
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

function scheduleFeedbackClear(target: { feedback: FeedbackMessage | null }) {
  window.setTimeout(() => {
    target.feedback = null;
  }, 3200);
}

async function shareTodayResult() {
  const result = todayResult.value;
  const gameNo = todayGameNo.value;
  if (!result || gameNo === null || todayShare.value.busy) return;

  todayShare.value.busy = true;
  try {
    const outcome = await roadResultShare.shareRoadResult({
      gameNo,
      puzzleType: selectedMode.value,
      attempts: result.attempts,
      solved: result.solved,
      solveTimeMs: result.solveTimeMs,
      hintsUsed: result.hintsUsed,
    });
    if (outcome.outcome === 'cancelled' || !outcome.message) return;
    todayShare.value.feedback = {
      kind: outcome.outcome === 'unavailable' ? 'error' : 'success',
      message: outcome.message,
    };
    scheduleFeedbackClear(todayShare.value);
  } finally {
    todayShare.value.busy = false;
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(async () => {
  localProgress.load();
  localStats.load();

  const preferred = localProgress.currentRoadContext.value.selectedMode;
  if (preferred === 'classic' || preferred === 'expedition') {
    selectedMode.value = preferred;
  }

  try {
    communityOverview.value = await statsApi.getOverview();
  } catch {
    communityError.value = 'Community comparison is unavailable right now.';
  }

  loading.value = false;
});
</script>

<template>
  <div class="shell">
    <div class="container">
      <header class="page-header">
        <p class="eyebrow">Your road so far</p>
        <h1>Stats</h1>
      </header>

      <!-- 1 · Medals: cross-mode, always visible, with the +1 moment -->
      <section class="panel panel--medals" aria-label="Medals earned">
        <div class="medal-grid">
          <div
            v-for="tier in medalTiles"
            :key="tier.key"
            class="medal-tile"
            :class="`medal-tile--${tier.key}`"
          >
            <span
              v-if="tier.earnedToday > 0"
              class="medal-increment"
              :aria-label="`${tier.earnedToday} earned today`"
            >
              +{{ tier.earnedToday }}
            </span>
            <span class="medal-disc" aria-hidden="true">{{ tier.count }}</span>
            <span class="medal-name">{{ tier.label }}</span>
            <span class="medal-sub">{{ tier.sub }}</span>
            <span class="sr-only">
              {{ tier.count }} {{ tier.label }} medal{{ tier.count === 1 ? '' : 's' }}
            </span>
          </div>
        </div>
      </section>

      <!-- Global mode toggle: scopes every section below -->
      <div class="mode-switch" role="tablist" aria-label="Choose a mode">
        <button
          v-for="mode in (['classic', 'expedition'] as const)"
          :key="mode"
          type="button"
          role="tab"
          class="mode-switch-btn"
          :class="{ 'is-active': selectedMode === mode }"
          :aria-selected="selectedMode === mode"
          @click="selectedMode = mode"
        >
          {{ formatModeLabel(mode) }}
        </button>
      </div>

      <section v-if="loading" class="panel panel--loading">
        <p>Gathering your roads…</p>
      </section>

      <template v-else>
        <!-- 2 · Today's road: the player's own result and share -->
        <section class="panel panel--today">
          <div class="today-lead">
            <p class="eyebrow">{{ todayCard.eyebrow }}</p>
            <div class="today-title-row">
              <h2>{{ todayCard.title }}</h2>
              <span
                v-if="todayCard.state === 'solved'"
                class="badge badge--featured"
                :class="badgeClass(todayCard.medal ?? null, true)"
              >
                {{ todayCard.badge }}
              </span>
            </div>

            <div v-if="todayCard.state === 'solved'" class="chip-row">
              <span v-for="chip in todayCard.chips" :key="chip" class="chip">
                {{ chip }}
              </span>
            </div>
            <p v-else class="today-detail">{{ todayCard.detail }}</p>

            <div class="today-actions">
              <button
                v-if="todayCard.state === 'solved'"
                type="button"
                class="btn btn--primary"
                :disabled="todayShare.busy"
                @click="shareTodayResult"
              >
                {{ todayShare.busy ? 'Preparing…' : 'Share today’s result' }}
              </button>
              <NuxtLink v-else to="/" class="btn btn--primary">
                Play today’s road
              </NuxtLink>
              <p
                v-if="todayShare.feedback"
                class="feedback"
                :class="{ 'feedback--error': todayShare.feedback.kind === 'error' }"
                aria-live="polite"
              >
                {{ todayShare.feedback.message }}
              </p>
            </div>
          </div>
        </section>

        <!-- 3 · Yesterday's road: the completed field's global story -->
        <section
          v-if="yesterdayField && yesterdayField.plays > 0"
          class="panel panel--field"
        >
          <div class="section-head">
            <p class="eyebrow">Yesterday’s road · global stats</p>
            <h2>Road {{ yesterdayGameNo }} · {{ formatModeLabel(selectedMode) }}</h2>
          </div>

          <StatsTriesHistogram
            v-if="showYesterdayHistogram"
            :bars="yesterdayBars"
            player-tag="You"
          />

          <div class="field-story">
            <p v-if="yesterdayHeadline" class="field-headline">
              {{ yesterdayHeadline }}
            </p>
            <p v-if="yesterdayPlayerLine" class="field-player-line">
              {{ yesterdayPlayerLine }}
            </p>
          </div>

          <button
            v-if="showYesterdayHistogram && yesterdayBehaviorRows.length"
            type="button"
            class="text-toggle"
            @click="showFieldDetail = !showFieldDetail"
          >
            {{ showFieldDetail ? 'Hide field detail' : 'How the field played it' }}
          </button>
          <ul v-if="showFieldDetail" class="field-detail">
            <li v-for="row in yesterdayBehaviorRows" :key="row">{{ row }}</li>
          </ul>
        </section>

        <p v-else-if="communityError" class="community-note">
          {{ communityError }}
        </p>

        <!-- 4 · Your stats: the v1 key-value record -->
        <section v-if="hasModeHistory" class="panel panel--record">
          <div class="section-head">
            <p class="eyebrow">All-time · {{ formatModeLabel(selectedMode) }}</p>
            <h2>Your stats</h2>
          </div>

          <dl class="record-list">
            <div v-for="row in recordRows" :key="row.key" class="record-row">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>
        </section>

        <section v-else class="panel panel--empty">
          <h2>No {{ formatModeLabel(selectedMode) }} history yet</h2>
          <p>
            Play a {{ formatModeLabel(selectedMode) }} road and your medals and
            stats fill in here.
          </p>
          <NuxtLink to="/" class="btn btn--primary">Play today’s road</NuxtLink>
        </section>

        <!-- 5 · Past roads entry -->
        <section class="panel panel--explore">
          <p class="explore-lead">Keep walking &amp; improving</p>
          <NuxtLink to="/games" class="btn btn--ghost">Play past roads</NuxtLink>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.shell {
  min-height: calc(100dvh - 60px);
  padding: clamp(0.9rem, 2.5vw, 1.4rem);
}

.container {
  max-width: 640px;
  margin: 0 auto;
  display: grid;
  gap: clamp(1rem, 2.5vw, 1.5rem);
}

.page-header {
  display: grid;
  gap: 0.2rem;
}

.page-header h1 {
  margin: 0;
  font-size: clamp(2rem, 6vw, 2.6rem);
  color: var(--color-gold-bright);
  line-height: 1.05;
}

.eyebrow {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(var(--color-gold-rgb) / 0.6);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* ── Medals ───────────────────────────────────────────────── */
.panel--medals {
  padding: clamp(1rem, 3vw, 1.3rem);
}

.medal-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.7rem;
}

.medal-tile {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.3rem;
  padding: 1rem 0.6rem 0.85rem;
  border-radius: var(--radius-md);
  background: rgb(0 0 0 / 0.22);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.14);
}

.medal-disc {
  display: grid;
  place-items: center;
  width: 3.4rem;
  height: 3.4rem;
  border-radius: var(--radius-circle);
  font-size: 1.35rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  box-shadow:
    0 6px 14px rgb(0 0 0 / 0.35),
    inset 0 1px 0 rgb(255 255 255 / 0.35);
}

.medal-tile--gold .medal-disc {
  background: var(--gradient-tile-done);
  color: var(--color-text-on-gold);
}

.medal-tile--silver .medal-disc {
  background: var(--gradient-medal-silver);
  color: var(--color-text-on-silver);
}

.medal-tile--bronze .medal-disc {
  background: var(--gradient-medal-bronze);
  color: var(--color-text-on-bronze);
}

.medal-name {
  font-size: 0.92rem;
  font-weight: 800;
  color: var(--color-gold-bright);
}

.medal-tile--silver .medal-name {
  color: var(--color-medal-silver-muted);
}

.medal-tile--bronze .medal-name {
  color: var(--color-medal-bronze-bright);
}

.medal-sub {
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgb(var(--color-gold-rgb) / 0.55);
}

.medal-increment {
  position: absolute;
  top: 0.45rem;
  right: 0.5rem;
  padding: 0.14rem 0.42rem;
  border-radius: var(--radius-full);
  background: var(--color-success);
  color: var(--color-text-on-success);
  font-size: 0.76rem;
  font-weight: 900;
  animation: rise-in var(--transition-slow) both;
}

/* ── Mode switch ──────────────────────────────────────────── */
.mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem;
  padding: 0.3rem;
  border-radius: var(--radius-full);
  background: rgb(0 0 0 / 0.28);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.16);
}

.mode-switch-btn {
  padding: 0.6rem 1rem;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  background: transparent;
  color: rgb(var(--color-gold-rgb) / 0.72);
  font: inherit;
  font-size: 0.96rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.mode-switch-btn:hover {
  color: var(--color-gold-bright);
}

.mode-switch-btn.is-active {
  color: var(--color-text-on-gold);
  background: var(--gradient-button-primary);
  box-shadow: 0 0 16px rgb(var(--color-gold-rgb) / 0.28);
}

/* ── Panels ───────────────────────────────────────────────── */
.panel {
  display: grid;
  gap: 1rem;
  padding: clamp(1.1rem, 3vw, 1.5rem);
  border-radius: var(--radius-lg);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
}

.panel--loading,
.panel--empty {
  justify-items: center;
  text-align: center;
  color: rgb(var(--color-gold-rgb) / 0.8);
}

.panel--empty h2 {
  margin: 0;
  color: var(--color-gold-bright);
}

.panel--empty p {
  margin: 0;
  max-width: 40ch;
  color: rgb(var(--color-gold-rgb) / 0.76);
}

.panel h2 {
  margin: 0;
  color: var(--color-gold-bright);
  font-size: 1.3rem;
}

.section-head {
  display: grid;
  gap: 0.2rem;
}

/* ── Today panel ──────────────────────────────────────────── */
.today-lead {
  display: grid;
  gap: 0.55rem;
}

.today-title-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
}

.today-detail {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.82);
  line-height: var(--line-height-base);
  font-size: 1rem;
}

.today-actions {
  display: grid;
  gap: 0.4rem;
  justify-items: start;
}

/* ── Chips & badges ───────────────────────────────────────── */
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  padding: 0.28rem 0.65rem;
  border-radius: var(--radius-full);
  background: rgb(0 0 0 / 0.24);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.22);
  color: rgb(var(--color-gold-rgb) / 0.86);
  font-size: 0.88rem;
  font-weight: 800;
}

.badge {
  padding: 0.24rem 0.6rem;
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.08);
  color: rgb(var(--color-gold-rgb) / 0.8);
  font-size: 0.78rem;
  font-weight: 800;
  white-space: nowrap;
}

.badge--solved {
  color: var(--color-active);
  background: rgb(var(--color-active-rgb) / 0.12);
  border: 1px solid rgb(var(--color-active-rgb) / 0.24);
}

.badge--gold {
  color: var(--color-gold-bright);
  background: rgb(var(--color-gold-rgb) / 0.16);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.32);
}

.badge--silver {
  color: var(--color-medal-silver-light);
  background: rgb(var(--color-medal-silver-rgb) / 0.12);
  border: 1px solid rgb(var(--color-medal-silver-rgb) / 0.28);
}

.badge--bronze {
  color: var(--color-medal-bronze-bright);
  background: rgb(var(--color-medal-bronze-rgb) / 0.14);
  border: 1px solid rgb(var(--color-medal-bronze-rgb) / 0.3);
}

.badge--featured {
  display: inline-grid;
  place-items: center;
  min-width: 4.25rem;
  min-height: 4.25rem;
  padding: 0.55rem;
  border-radius: var(--radius-circle);
  font-size: 0.86rem;
  text-align: center;
  box-shadow: 0 6px 16px rgb(0 0 0 / 0.28);
}

/* ── Yesterday's field ────────────────────────────────────── */
.panel--field {
  background: var(--gradient-card-metric);
  border-color: rgb(var(--color-gold-rgb) / 0.14);
}

.field-story {
  display: grid;
  gap: 0.45rem;
}

.field-headline {
  margin: 0;
  color: var(--color-gold-bright);
  font-weight: 700;
  line-height: var(--line-height-snug);
}

.field-player-line {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.82);
  line-height: var(--line-height-base);
}

.field-detail {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.3rem;
  color: rgb(var(--color-gold-rgb) / 0.76);
  font-size: 0.9rem;
}

/* ── Your stats record ────────────────────────────────────── */
.record-list {
  margin: 0;
  display: grid;
  gap: 0.4rem;
}

.record-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.55rem 0.2rem;
  border-bottom: 1px solid rgb(var(--color-gold-rgb) / 0.1);
}

.record-row:last-child {
  border-bottom: 0;
}

.record-row dt {
  color: rgb(var(--color-gold-rgb) / 0.72);
  font-size: 0.94rem;
}

.record-row dd {
  margin: 0;
  color: var(--color-gold-bright);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* ── Explore ──────────────────────────────────────────────── */
.panel--explore {
  justify-items: center;
  text-align: center;
  gap: 0.7rem;
}

.explore-lead {
  margin: 0;
  color: var(--color-gold-bright);
  font-weight: 800;
  font-size: 1.05rem;
}

/* ── Buttons, toggles, feedback ───────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.6rem 1.05rem;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  font: inherit;
  font-size: 0.94rem;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.btn--primary {
  color: var(--color-text-on-gold);
  background: var(--gradient-button-primary);
  box-shadow: 0 0 16px rgb(var(--color-gold-rgb) / 0.22);
}

.btn--ghost {
  color: rgb(var(--color-gold-rgb) / 0.84);
  background: rgb(var(--color-gold-rgb) / 0.08);
  border-color: rgb(var(--color-gold-rgb) / 0.22);
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.btn:disabled {
  opacity: 0.7;
  cursor: wait;
}

.text-toggle {
  justify-self: start;
  padding: 0.3rem 0;
  border: 0;
  background: none;
  color: rgb(var(--color-gold-rgb) / 0.82);
  font: inherit;
  font-weight: 800;
  font-size: 0.9rem;
  cursor: pointer;
  border-bottom: 1px solid rgb(var(--color-gold-rgb) / 0.32);
}

.text-toggle:hover {
  color: var(--color-gold-bright);
}

.feedback {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 700;
  color: rgb(var(--color-active-rgb) / 0.9);
}

.feedback--error {
  color: rgb(248 113 113 / 0.95);
}

.community-note {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.7);
  font-size: 0.9rem;
}

@media (max-width: 560px) {
  .medal-grid {
    gap: 0.5rem;
  }

  .medal-disc {
    width: 2.9rem;
    height: 2.9rem;
    font-size: 1.15rem;
  }
}
</style>
