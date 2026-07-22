<script setup lang="ts">
import { calcMedalForAttempt } from '../../lib/gameTiers';
import type { CommunityRoadStats, Medal, PuzzleType } from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';
import { useRoadResultShare } from '../composables/useRoadResultShare';
import {
  hasCommunitySample,
  hasPercentileSample,
  formatFieldBehaviorRows,
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

const streakMode = ref<PuzzleType>('classic');
const yesterdayMode = ref<PuzzleType>('classic');
const recordMode = ref<PuzzleType>('classic');
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
    sub: `${index + 1} ${index === 0 ? 'TRY' : 'TRIES'}`,
    count: summary.value.medalCounts[tier],
    earnedToday: medalsEarnedToday.value[tier],
  })),
);

// ---------------------------------------------------------------------------
// Streaks are mode-scoped and sit directly below the mode selector.
// ---------------------------------------------------------------------------

const streakCard = computed(() => {
  const isClassic = streakMode.value === 'classic';
  const current = isClassic
    ? summary.value.currentClassicStreak
    : summary.value.currentExpeditionStreak;
  const best = isClassic
    ? summary.value.bestClassicStreak
    : summary.value.bestExpeditionStreak;
  const isBest = current > 0 && current >= best;

  return {
    lit: current > 0,
    headline: current > 0 ? `${current}-day streak` : 'No streak yet',
    detail:
      current > 0
        ? `Best ${best} day${best === 1 ? '' : 's'}${isBest ? ' · current best' : ''}`
        : null,
    prompt:
      current > 0
        ? null
        : `Solve today’s ${formatModeLabel(streakMode.value)} road to light the flame.`,
  };
});

// ---------------------------------------------------------------------------
// Today's road (the player's own result — no community data for a road
// still in progress)
// ---------------------------------------------------------------------------

const todayClassicResult = computed(() =>
  playerResult(todayGameNo.value, 'classic'),
);
const todayExpeditionResult = computed(() =>
  playerResult(todayGameNo.value, 'expedition'),
);

const todaySolvedRows = computed(() =>
  (['classic', 'expedition'] as const).flatMap((mode) => {
    const result =
      mode === 'classic'
        ? todayClassicResult.value
        : todayExpeditionResult.value;
    if (!result?.solved) return [];

    const details = [formatRunCount(result.attempts)];
    const time = formatDurationMs(result.solveTimeMs);
    if (result.solveTimeMs !== null) details.push(time);
    if (result.hintsUsed > 0) {
      details.push(
        `${result.hintsUsed} hint${result.hintsUsed === 1 ? '' : 's'}`,
      );
    }

    return [{
      mode,
      label: formatModeLabel(mode),
      medal: medalOf(result),
      details,
    }];
  }),
);

const todayCard = computed(() => {
  const gameNo = todayGameNo.value;
  const classic = todayClassicResult.value;
  const solvedRows = todaySolvedRows.value;
  const solvedCount = solvedRows.length;

  if (solvedCount === 0) {
    return {
      state: 'unplayed' as const,
      eyebrow: 'Today’s road',
      title: gameNo ? `Road ${gameNo} is waiting` : 'Today’s road is waiting',
      detail:
        classic && classic.attempts > 0
          ? `The solve is still out there after ${formatRunCount(classic.attempts)}.`
          : 'Chart today’s Classic road to start your streak.',
    };
  }

  if (solvedCount === 2) {
    return {
      state: 'both-solved' as const,
      eyebrow: 'Today’s road',
      title: 'Both roads conquered.',
      detail: 'Share the full day, or come back for tomorrow’s road.',
    };
  }

  const solvedMode = solvedRows[0]!.mode;
  const solvedLabel = formatModeLabel(solvedMode);
  const remainingLabel = formatModeLabel(
    solvedMode === 'classic' ? 'expedition' : 'classic',
  );
  return {
    state: 'one-solved' as const,
    eyebrow: 'Today’s road',
    title: `${solvedLabel} conquered.`,
    detail: `${remainingLabel} is waiting when you’re ready.`,
  };
});

const todayShareButtonLabel = computed(() => {
  if (todayShare.value.busy) return 'Preparing…';
  if (todaySolvedRows.value.length === 2) return 'Share the day';
  return `Share ${todaySolvedRows.value[0]?.label ?? 'result'}`;
});

const todayPlayButtonLabel = computed(() => {
  const solvedMode = todaySolvedRows.value[0]?.mode;
  if (!solvedMode) return 'Play Classic';
  return solvedMode === 'classic' ? 'Play Expedition' : 'Play Classic';
});

// ---------------------------------------------------------------------------
// Yesterday's road — the completed field, told v1's way
// ---------------------------------------------------------------------------

const yesterdayGameNo = computed(
  () => communityOverview.value?.yesterday.gameNo ?? null,
);

const yesterdayField = computed<CommunityRoadStats | null>(
  () => communityOverview.value?.yesterday[yesterdayMode.value] ?? null,
);

const yesterdayResult = computed(() =>
  playerResult(yesterdayGameNo.value, yesterdayMode.value),
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

  // No local result at all: the player never walked yesterday's road.
  // That's an invitation, not a failure to report.
  return field.plays > 0
    ? 'Walk down today’s road and come back tomorrow to see how you fared against the field.'
    : null;
});

const yesterdayBehaviorRows = computed(() => {
  const field = yesterdayField.value;
  if (!field) return [];
  return formatFieldBehaviorRows(
    field,
    yesterdayResult.value?.solveTimeMs ?? null,
    (value) => formatDurationMs(value),
  );
});

// ---------------------------------------------------------------------------
// Your stats — the v1 key-value record, mode-scoped
// ---------------------------------------------------------------------------

const modeSummary = computed(() => summary.value.modeBreakdown[recordMode.value]);
const hasModeHistory = computed(() => modeSummary.value.sessionsPlayed > 0);

const recordRows = computed(() => {
  const stats = modeSummary.value;
  const roadWord = (count: number) => `${count} road${count === 1 ? '' : 's'}`;

  return [
    { key: 'played', label: 'Total treads', value: roadWord(stats.sessionsPlayed) },
    { key: 'solves', label: 'Total finishes', value: roadWord(stats.exactSolves) },
    { key: 'rate', label: 'Completion', value: `${stats.solveRate}%` },
    { key: 'avgAttempts', label: 'Average tries', value: stats.averageSolvedAttempts },
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
  const gameNo = todayGameNo.value;
  const rows = todaySolvedRows.value;
  if (rows.length === 0 || gameNo === null || todayShare.value.busy) return;

  todayShare.value.busy = true;
  try {
    const outcome = rows.length === 2
      ? await roadResultShare.shareDayResult({
          gameNo,
          classic: todayClassicResult.value,
          expedition: todayExpeditionResult.value,
        })
      : await roadResultShare.shareRoadResult({
          gameNo,
          puzzleType: rows[0]!.mode,
          attempts:
            rows[0]!.mode === 'classic'
              ? todayClassicResult.value!.attempts
              : todayExpeditionResult.value!.attempts,
          solved: true,
          solveTimeMs:
            rows[0]!.mode === 'classic'
              ? todayClassicResult.value!.solveTimeMs
              : todayExpeditionResult.value!.solveTimeMs,
          hintsUsed:
            rows[0]!.mode === 'classic'
              ? todayClassicResult.value!.hintsUsed
              : todayExpeditionResult.value!.hintsUsed,
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
    streakMode.value = preferred;
    yesterdayMode.value = preferred;
    recordMode.value = preferred;
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
          <span class="medal-stat" aria-hidden="true">
            <MedalIcon :tier="tier.key" class="medal-art" />
            <span class="medal-multiply">x</span>
            <span
              class="medal-count"
              :class="{ 'medal-count--bumped': tier.earnedToday > 0 }"
            >{{ tier.count }}</span>
          </span>
          <span class="medal-sub">{{ tier.sub }}</span>
          <span class="sr-only">
            {{ tier.count }} {{ tier.label }} medal{{ tier.count === 1 ? '' : 's' }}
          </span>
        </div>
      </section>

      <section
        class="panel streak-card"
        :aria-label="`${formatModeLabel(streakMode)} streak`"
      >
        <StatsModeSwitch v-model="streakMode" label="Choose streak mode" />
        <div class="streak-content">
          <div class="streak-flame-col" :class="{ 'streak-flame-col--lit': streakCard.lit }">
            <svg class="streak-flame" viewBox="0 0 24 24" aria-hidden="true">
              <path
                class="streak-flame-outer"
                d="M12 2c.7 3.2-.6 5-2.2 6.7C8.1 10.5 6.5 12.3 6.5 15a5.5 5.5 0 0 0 11 0c0-1.5-.5-2.9-1.2-4.2-.3.9-.8 1.6-1.6 2.1.3-3-1-6.6-2.7-8.4A7.6 7.6 0 0 0 12 2Z"
              />
              <path
                class="streak-flame-inner"
                d="M12 21a3.4 3.4 0 0 1-3.4-3.4c0-1.6 1-2.5 1.9-3.5.7-.8 1.3-1.5 1.5-2.6 1.2 1.2 3.4 3.7 3.4 6.1A3.4 3.4 0 0 1 12 21Z"
              />
            </svg>
          </div>
          <div class="streak-text">
            <strong class="streak-headline">{{ streakCard.headline }}</strong>
            <p v-if="streakCard.prompt" class="streak-sub">{{ streakCard.prompt }}</p>
            <p v-else class="streak-sub">{{ streakCard.detail }}</p>
          </div>
        </div>
      </section>

      <section v-if="loading" class="panel panel--loading">
        <p>Gathering your roads…</p>
      </section>

      <template v-else>
        <!-- 2 · Today's road: the player's own result and share -->
        <section class="panel panel--today">
          <p class="eyebrow">{{ todayCard.eyebrow }}</p>
          <h2 class="today-title">{{ todayCard.title }}</h2>

          <div v-if="todaySolvedRows.length" class="today-result">
            <div
              v-for="row in todaySolvedRows"
              :key="row.mode"
              class="today-result-row"
            >
              <span class="today-result-icon">
                <MedalIcon
                  v-if="row.medal"
                  :tier="row.medal"
                  class="today-result-medal"
                />
                <span v-else aria-hidden="true">✓</span>
              </span>
              <span class="today-result-copy">
                <strong>{{ row.label }}</strong>
                <span>{{ row.details.join(' · ') }}</span>
              </span>
            </div>
          </div>
          <p class="today-detail">{{ todayCard.detail }}</p>

          <button
            v-if="todaySolvedRows.length"
            type="button"
            class="btn btn--primary"
            :disabled="todayShare.busy"
            @click="shareTodayResult"
          >
            {{ todayShareButtonLabel }}
          </button>
          <NuxtLink
            v-if="todayCard.state !== 'both-solved'"
            to="/"
            class="btn"
            :class="todaySolvedRows.length ? 'btn--ghost' : 'btn--primary'"
          >
            {{ todayPlayButtonLabel }}
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
        <section v-if="yesterdayGameNo !== null" class="panel panel--field">
          <div class="section-head">
            <p class="eyebrow">Yesterday’s road · global stats</p>
            <h2>Road {{ yesterdayGameNo }}</h2>
          </div>

          <StatsModeSwitch v-model="yesterdayMode" label="Choose yesterday’s mode" />

          <StatsTriesHistogram
            v-if="showYesterdayHistogram && yesterdayField"
            :distribution="yesterdayField.solvedAttempts"
            :player-attempts="yesterdayPlayerAttempts"
          />

          <div
            v-if="yesterdayHeadline || yesterdayPlayerLine"
            class="field-story"
          >
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
          <ul
            v-if="showFieldDetail && yesterdayBehaviorRows.length"
            class="field-detail"
          >
            <li v-for="row in yesterdayBehaviorRows" :key="row">{{ row }}</li>
          </ul>

          <p v-if="!yesterdayField" class="community-note">
            No {{ formatModeLabel(yesterdayMode) }} comparison is available for this road.
          </p>
        </section>

        <p v-else-if="communityError" class="community-note">
          {{ communityError }}
        </p>

        <!-- 4 · Your stats: the v1 key-value record -->
        <section class="panel panel--record">
          <div class="section-head">
            <p class="eyebrow">All-time</p>
            <h2>Your stats</h2>
          </div>

          <StatsModeSwitch v-model="recordMode" label="Choose all-time stats mode" />

          <dl v-if="hasModeHistory" class="record-list">
            <div v-for="row in recordRows" :key="row.key" class="record-row">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>
          <div v-else class="record-empty">
            <h3>No {{ formatModeLabel(recordMode) }} history yet</h3>
            <p>
              Play a {{ formatModeLabel(recordMode) }} road and your stats fill
              in here.
            </p>
            <NuxtLink to="/" class="btn btn--primary">Play today’s road</NuxtLink>
          </div>
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
  white-space: nowrap;
}

/* v1's golden "+1": plain gold text, top-right of the medal card. */
.medal-increment {
  position: absolute;
  top: 0.4rem;
  right: 0.5rem;
  color: var(--color-gold-bright);
  font-size: var(--font-size-caption);
  font-weight: 800;
  animation: rise-in var(--transition-slow) both;
  animation-delay: 260ms;
}

.medal-count--bumped {
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
  gap: 0.9rem;
  padding: clamp(0.9rem, 2.5vw, 1.15rem) clamp(1.1rem, 3vw, 1.5rem);
}

.streak-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  text-align: left;
}

.streak-flame-col {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-circle);
  background: rgb(0 0 0 / 0.25);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.16);
}

.streak-flame {
  width: 1.85rem;
  height: 1.85rem;
  color: var(--color-gold-dark);
  filter: grayscale(1) opacity(0.4);
}

.streak-flame-outer {
  fill: currentColor;
}

.streak-flame-inner {
  fill: var(--color-gold-bright);
}

.streak-flame-col--lit {
  border-color: rgb(var(--color-gold-rgb) / 0.4);
  box-shadow: 0 0 14px rgb(var(--color-gold-rgb) / 0.22);
}

.streak-flame-col--lit .streak-flame {
  color: var(--color-gold);
  filter: drop-shadow(0 0 8px rgb(var(--color-gold-rgb) / 0.45));
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

.panel--loading {
  justify-items: center;
  text-align: center;
  color: rgb(var(--color-gold-rgb) / 0.8);
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
  width: min(100%, 26rem);
  padding: 0.2rem 0.85rem;
  border-radius: var(--radius-md);
  background: rgb(var(--color-gold-rgb) / 0.12);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.32);
  color: var(--color-gold-bright);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05);
}

.today-result-row {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr);
  align-items: center;
  gap: 0.7rem;
  padding: 0.65rem 0;
  text-align: left;
}

.today-result-row + .today-result-row {
  border-top: 1px solid rgb(var(--color-gold-rgb) / 0.16);
}

.today-result-icon {
  display: inline-grid;
  place-items: center;
  color: var(--color-gold-bright);
  font-size: 1.35rem;
  font-weight: 800;
}

.today-result-medal {
  font-size: 1.8rem;
}

.today-result-copy {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.today-result-copy strong {
  color: var(--color-gold-bright);
  line-height: 1.15;
}

.today-result-copy span {
  color: rgb(var(--color-gold-rgb) / 0.72);
  font-size: var(--font-size-caption);
  font-weight: 650;
  line-height: 1.35;
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

.record-empty {
  display: grid;
  justify-items: center;
  gap: 0.8rem;
  color: rgb(var(--color-gold-rgb) / 0.76);
}

.record-empty h3,
.record-empty p {
  margin: 0;
}

.record-empty h3 {
  color: var(--color-gold-bright);
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

  .medal-card {
    padding-inline: 0.35rem;
  }

  .medal-sub {
    font-size: 0.68rem;
    letter-spacing: 0.025em;
  }
}
</style>
