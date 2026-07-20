<script setup lang="ts">
import { calcMedalForAttempt } from '../../lib/gameTiers';
import type { CommunityRoadStats, Medal, PuzzleType } from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';
import {
  buildRoadResultShareText,
  useRoadResultShare,
} from '../composables/useRoadResultShare';
import {
  hasCommunitySample,
  hasPercentileSample,
  topPercent,
} from '../utils/statsPresentation';

const localStats = useLocalPlayerStats();
const localProgress = useLocalGameProgress();
const statsApi = useStatsApi();
const roadResultShare = useRoadResultShare();
const { countdown: nextRoadCountdown, newRoadReady } = useNextRoadCountdown();

const summary = localStats.summary;
const recentDays = localStats.recentDays;

const communityOverview = ref<Awaited<
  ReturnType<typeof statsApi.getOverview>
> | null>(null);
const communityError = ref<string | null>(null);
const loading = ref(true);

const selectedMode = ref<PuzzleType>('classic');
const showFieldDetail = ref(false);

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

function formatRunCount(attempts: number): string {
  return UI_COPY.celebration.attemptLabel(attempts);
}

function formatDurationMs(value: number | null): string {
  if (value === null) return '–';
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0
    ? `${minutes}m ${String(seconds).padStart(2, '0')}s`
    : `${seconds}s`;
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
// Streaks (always visible): Classic is the day's baseline challenge, so the
// Classic streak IS the daily streak. Expedition's harder optional streak
// rides along in the same card.
// ---------------------------------------------------------------------------

const streakCard = computed(() => {
  const current = summary.value.currentClassicStreak;
  const best = summary.value.bestClassicStreak;
  const expeditionCurrent = summary.value.currentExpeditionStreak;
  const expeditionBest = summary.value.bestExpeditionStreak;
  const isBest = current > 0 && current >= best;

  return {
    current,
    lit: current > 0,
    headline: current > 0 ? `${current}-day streak` : 'No streak yet',
    classicLine:
      current > 0
        ? `Classic best ${best} day${best === 1 ? '' : 's'}${isBest ? ' · current best' : ''}`
        : null,
    prompt: current > 0 ? null : 'Solve today’s road to light the flame.',
    expeditionLine:
      expeditionCurrent > 0 || expeditionBest > 0
        ? `Expedition streak ${expeditionCurrent} day${expeditionCurrent === 1 ? '' : 's'} · best ${expeditionBest}`
        : null,
  };
});

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
    // The gold block previews the exact text Share now sends — v1's trick.
    const shareLines =
      gameNo === null
        ? []
        : buildRoadResultShareText({
            gameNo,
            puzzleType: selectedMode.value,
            attempts: result.attempts,
            solved: true,
            solveTimeMs: result.solveTimeMs,
            hintsUsed: result.hintsUsed,
          }).text.split('\n');

    return {
      state: 'solved' as const,
      eyebrow: 'Today’s road',
      title: 'Yay! You got to the finish 🎉',
      shareLines,
    };
  }

  return {
    state: 'inprogress' as const,
    eyebrow: 'Today’s road',
    title: gameNo ? `Road ${gameNo}` : 'Today’s road',
    detail: `Umm… you haven’t solved it yet. The solve is still out there after ${formatRunCount(result.attempts)}.`,
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
    hasCommunitySample(yesterdayField.value!),
);

const yesterdayPlayerAttempts = computed(() => {
  const result = yesterdayResult.value;
  return result?.solved ? result.attempts : null;
});

const yesterdayHeadline = computed(() => {
  const field = yesterdayField.value;
  const gameNo = yesterdayGameNo.value;
  if (!field) return null;

  if (field.plays <= 0) {
    return `No community results were recorded for Road ${gameNo}.`;
  }

  return `${field.solveRate}% of the roadgoers who walked down Road ${gameNo} reached the finish.`;
});

const yesterdayPlayerLine = computed(() => {
  const field = yesterdayField.value;
  const result = yesterdayResult.value;
  if (!field) return null;

  if (result?.solved) {
    if (!hasPercentileSample(field)) {
      return `You got to the finish in ${formatRunCount(result.attempts)}. No community comparison was recorded for this road.`;
    }
    const top = topPercent(field, result.attempts);
    return `You got to the finish in ${formatRunCount(result.attempts)}, in the top ${top}% of the field.`;
  }

  if (result && result.attempts > 0) {
    return 'You walked it too, but the finish stayed out of reach that day.';
  }

  return field.plays > 0
    ? `You did not finish Road ${yesterdayGameNo.value}.`
    : null;
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
      `Around ${field.behavior.averageDeadEndCount} dead end${field.behavior.averageDeadEndCount === 1 ? '' : 's'} per attempt on average`,
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
  const roadWord = (count: number) => `${count} road${count === 1 ? '' : 's'}`;

  return [
    { key: 'played', label: 'Total treads', value: roadWord(stats.sessionsPlayed) },
    { key: 'solves', label: 'Total finishes', value: roadWord(stats.exactSolves) },
    { key: 'rate', label: 'Completion', value: `${stats.solveRate}%` },
    { key: 'avgAttempts', label: 'Average attempts', value: stats.averageSolvedAttempts },
    { key: 'avgTime', label: 'Average solve time', value: formatDurationMs(stats.averageSolveTimeMs) },
    { key: 'bestTime', label: 'Best solve time', value: formatDurationMs(stats.bestSolveTimeMs) },
    { key: 'hints', label: 'Hints used', value: String(stats.totalHints) },
  ];
});

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
      <section class="medal-grid" aria-label="Medals earned">
        <div
          v-for="tier in medalTiles"
          :key="tier.key"
          class="medal-card"
        >
          <span
            v-if="tier.earnedToday > 0"
            class="medal-increment"
            :aria-label="`${tier.earnedToday} earned today`"
          >
            +{{ tier.earnedToday }}
          </span>
          <span
            class="medal-stat"
            :class="{ 'medal-stat--bumped': tier.earnedToday > 0 }"
            aria-hidden="true"
          >
            <MedalIcon :tier="tier.key" class="medal-art" />
            <span class="medal-multiply">x</span>
            <span class="medal-count">{{ tier.count }}</span>
          </span>
          <span class="medal-sub">{{ tier.sub }}</span>
          <span class="sr-only">
            {{ tier.count }} {{ tier.label }} medal{{ tier.count === 1 ? '' : 's' }}
          </span>
        </div>
      </section>

      <!-- Streaks: the daily (Classic) streak leads, Expedition rides along -->
      <section class="panel streak-card" aria-label="Streaks">
        <div class="streak-flame-col" :class="{ 'streak-flame-col--lit': streakCard.lit }">
          <svg
            class="streak-flame"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="#ff9d2e"
              d="M12 2c.7 3.2-.6 5-2.2 6.7C8.1 10.5 6.5 12.3 6.5 15a5.5 5.5 0 0 0 11 0c0-1.5-.5-2.9-1.2-4.2-.3.9-.8 1.6-1.6 2.1.3-3-1-6.6-2.7-8.4A7.6 7.6 0 0 0 12 2Z"
            />
            <path
              fill="#ffce31"
              d="M12 21a3.4 3.4 0 0 1-3.4-3.4c0-1.6 1-2.5 1.9-3.5.7-.8 1.3-1.5 1.5-2.6 1.2 1.2 3.4 3.7 3.4 6.1A3.4 3.4 0 0 1 12 21Z"
            />
          </svg>
        </div>
        <div class="streak-text">
          <strong class="streak-headline">{{ streakCard.headline }}</strong>
          <p v-if="streakCard.prompt" class="streak-sub">
            {{ streakCard.prompt }}
          </p>
          <div v-else class="streak-details">
            <span v-if="streakCard.classicLine">{{ streakCard.classicLine }}</span>
            <span v-if="streakCard.expeditionLine">{{ streakCard.expeditionLine }}</span>
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
          <p class="eyebrow">{{ todayCard.eyebrow }}</p>
          <h2 class="today-title">{{ todayCard.title }}</h2>

          <div v-if="todayCard.state === 'solved'" class="today-result">
            <span
              v-for="(line, index) in todayCard.shareLines"
              :key="line"
              class="today-result-line"
              :class="{ 'today-result-line--lead': index === 0 }"
            >
              {{ line }}
            </span>
          </div>
          <p v-else class="today-detail">{{ todayCard.detail }}</p>

          <button
            v-if="todayCard.state === 'solved'"
            type="button"
            class="btn btn--primary"
            :disabled="todayShare.busy"
            @click="shareTodayResult"
          >
            {{ todayShare.busy ? 'Preparing…' : 'Share now' }}
          </button>
          <NuxtLink v-else to="/" class="btn btn--primary">
            Play now
          </NuxtLink>
          <p
            v-if="todayShare.feedback"
            class="feedback"
            :class="{ 'feedback--error': todayShare.feedback.kind === 'error' }"
            aria-live="polite"
          >
            {{ todayShare.feedback.message }}
          </p>

          <!-- Always visible: after a solve it's the wait for tomorrow,
               before one it's the time left to walk today's road. At UTC
               midnight it becomes a passive link — the live page performs
               the authoritative fetch on arrival. -->
          <p class="next-road-line">
            <template v-if="newRoadReady">
              A new road is available ·
              <NuxtLink to="/" class="next-road-link">Play now</NuxtLink>
            </template>
            <template v-else>Next road in {{ nextRoadCountdown }}</template>
          </p>
        </section>

        <!-- 3 · Yesterday's road: the completed field's global story -->
        <section
          v-if="yesterdayGameNo !== null && yesterdayField"
          class="panel panel--field"
        >
          <div class="section-head">
            <p class="eyebrow">Yesterday’s road · global stats</p>
            <h2>Road {{ yesterdayGameNo }} · {{ formatModeLabel(selectedMode) }}</h2>
          </div>

          <StatsTriesHistogram
            v-if="showYesterdayHistogram && yesterdayField"
            :distribution="yesterdayField.solvedAttempts"
            :player-attempts="yesterdayPlayerAttempts"
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

/* v1's stats page centered everything; headers and content follow suit. */
.page-header {
  display: grid;
  gap: 0.2rem;
  justify-items: center;
  text-align: center;
}

.page-header h1 {
  margin: 0;
  font-size: clamp(2rem, 6vw, 2.6rem);
  color: var(--color-gold-bright);
  line-height: 1.05;
}

.eyebrow {
  margin: 0;
  font-size: var(--font-size-caption);
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

/* ── Medals — v1's three cards: medal art × count ─────────── */
.medal-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.8rem;
}

.medal-card {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.45rem;
  padding: 1rem 0.6rem 0.85rem;
  border-radius: var(--radius-lg);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
}

.medal-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.medal-art {
  font-size: 2.1rem;
  filter: drop-shadow(0 3px 6px rgb(0 0 0 / 0.4));
}

.medal-multiply {
  color: var(--color-gold-dark);
  font-size: 0.95rem;
  font-weight: 700;
}

.medal-count {
  font-size: 1.4rem;
  font-weight: 900;
  color: var(--color-gold-bright);
  font-variant-numeric: tabular-nums;
}

.medal-sub {
  font-size: var(--font-size-caption);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgb(var(--color-gold-rgb) / 0.55);
}

/* v1's golden "+1": plain gold text, top-right of the medal card. */
.medal-increment {
  position: absolute;
  top: 0.4rem;
  right: 0.5rem;
  color: gold;
  font-size: var(--font-size-caption);
  font-weight: 800;
  animation: rise-in var(--transition-slow) both;
  animation-delay: 260ms;
}

.medal-stat--bumped {
  animation: medal-bump 620ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: 180ms;
}

@keyframes medal-bump {
  0% {
    transform: scale(1);
  }

  40% {
    transform: scale(1.22);
  }

  100% {
    transform: scale(1);
  }
}

/* ── Streaks — flame column beside the numbers ────────────── */
.panel.streak-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  text-align: left;
  padding: clamp(0.9rem, 2.5vw, 1.15rem) clamp(1.1rem, 3vw, 1.5rem);
}

.streak-flame-col {
  display: grid;
  place-items: center;
  width: var(--control-size);
  height: var(--control-size);
  border-radius: var(--radius-circle);
  background: rgb(0 0 0 / 0.25);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.16);
}

.streak-flame {
  width: var(--icon-size);
  height: var(--icon-size);
  filter: grayscale(1) opacity(0.4);
}

.streak-flame-col--lit {
  border-color: rgb(255 157 46 / 0.4);
  box-shadow: 0 0 14px rgb(255 157 46 / 0.22);
}

.streak-flame-col--lit .streak-flame {
  filter: drop-shadow(0 0 8px rgb(255 157 46 / 0.45));
}

.streak-text {
  display: grid;
  gap: 0.18rem;
}

.streak-headline {
  font-size: 1.3rem;
  font-weight: 900;
  color: var(--color-gold-bright);
  line-height: 1.1;
}

.streak-sub {
  margin: 0;
  font-size: var(--font-size-caption);
  color: rgb(var(--color-gold-rgb) / 0.7);
}

.streak-details {
  display: grid;
  gap: 0.12rem;
  font-size: var(--font-size-caption);
  font-weight: 700;
  color: var(--color-gold-muted);
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
  justify-items: center;
  text-align: center;
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

/* ── Today panel — centered, with v1's gold result block ──── */
.panel--today {
  justify-items: center;
  text-align: center;
  gap: 0.8rem;
}

.panel--today h2.today-title {
  font-size: 1.15rem;
}

.today-result {
  display: grid;
  gap: 0.35rem;
  padding: 1rem 2.2rem;
  border-radius: var(--radius-md);
  background: rgb(var(--color-gold-rgb) / 0.12);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.32);
  color: var(--color-gold-bright);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05);
  line-height: 1.4;
}

.today-result-line {
  font-size: 0.96rem;
  font-weight: 700;
}

.today-result-line--lead {
  font-size: 1.05rem;
  font-weight: 900;
}

.today-detail {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.82);
  line-height: var(--line-height-base);
  font-size: 1rem;
  max-width: 38ch;
}

.next-road-line {
  margin: 0;
  font-size: var(--font-size-caption);
  font-weight: 700;
  color: rgb(var(--color-gold-rgb) / 0.66);
  font-variant-numeric: tabular-nums;
}

.next-road-link {
  color: var(--color-gold-bright);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

/* ── Yesterday's field ────────────────────────────────────── */
.panel--field {
  background: var(--gradient-card-metric);
  border-color: rgb(var(--color-gold-rgb) / 0.14);
}

/* v1 centered its global-stats copy under the graph; keep that read. */
.field-story {
  display: grid;
  gap: 0.45rem;
  text-align: center;
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
  justify-self: center;
  text-align: left;
}

/* ── Your stats record ────────────────────────────────────── */
/* v1's two-column record: key right-aligned, value left-aligned. */
.record-list {
  margin: 0;
  display: grid;
  gap: 0;
  width: 100%;
}

.record-row {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  padding: 0.34rem 0;
}

.record-row dt {
  width: 50%;
  text-align: right;
  color: rgb(var(--color-gold-rgb) / 0.72);
  font-size: 0.94rem;
}

.record-row dd {
  width: 50%;
  margin: 0;
  color: var(--color-gold-bright);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-align: left;
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
  font-size: var(--font-size-control);
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
  justify-self: center;
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
  font-size: var(--font-size-caption);
  font-weight: 700;
  color: rgb(var(--color-solved-rgb) / 0.9);
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
}
</style>
