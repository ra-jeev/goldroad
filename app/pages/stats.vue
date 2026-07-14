<script setup lang="ts">
import { calcMedalForAttempt } from '../../lib/gameTiers';
import type { CommunityRoadStats, Medal, PuzzleType } from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';
import { useRoadResultShare } from '../composables/useRoadResultShare';
import type { HistogramBar } from '../components/StatsTriesHistogram.vue';
import {
  RECENT_ARCHIVE_DAY_LIMIT,
  hasDeepArchiveRoads,
} from '../../shared/utils/archive';

const localStats = useLocalPlayerStats();
const localProgress = useLocalGameProgress();
const statsApi = useStatsApi();
const gamesApi = useGamesApi();
const roadResultShare = useRoadResultShare();

const summary = localStats.summary;
const recentDays = localStats.recentDays;

const communityOverview = ref<Awaited<
  ReturnType<typeof statsApi.getOverview>
> | null>(null);
const communityError = ref<string | null>(null);
const loading = ref(true);

const selectedMode = ref<PuzzleType>('classic');
const showAllTimeDetail = ref(false);
const showFieldDetail = ref(false);
const showFullHistory = ref(false);
const HISTORY_PREVIEW_COUNT = 8;

const todayShare = ref<{ busy: boolean; feedback: FeedbackMessage | null }>({
  busy: false,
  feedback: null,
});
const latestShare = ref<{ busy: boolean; feedback: FeedbackMessage | null }>({
  busy: false,
  feedback: null,
});
const findingRandomRoad = ref(false);
const randomRoadError = ref<string | null>(null);

type FeedbackMessage = { kind: 'success' | 'error'; message: string };

type PlayerRoadResult = {
  attempts: number;
  solved: boolean;
  hintsUsed: number;
  solveTimeMs: number | null;
  updatedAt: string;
};

type ShareableRoadResult = PlayerRoadResult & {
  day: string;
  gameNo: number;
  puzzleType: PuzzleType;
};

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatModeLabel(mode: PuzzleType): string {
  return mode === 'classic'
    ? UI_COPY.boardHeader.classic
    : UI_COPY.boardHeader.expedition;
}

function formatDay(day: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`));
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
 * Which histogram bucket the player's own run lands in.
 * 0 first try · 1 second · 2 third · 3 four-plus · 4 unsolved · -1 not played.
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
  const captions = ['First run', 'Second run', 'Third run', '4+ runs', 'Still going'];
  const labels = ['1', '2', '3', '4+', 'DNF'];

  return bucketCounts(stat).map((count, index) => ({
    key: String(index),
    label: labels[index]!,
    caption: captions[index]!,
    count,
    isPlayer: index === playerBucket,
  }));
}

/** Share of the field that finished strictly worse than the player. */
function aheadPercent(stat: CommunityRoadStats, playerBucket: number): number {
  if (playerBucket < 0 || stat.plays <= 0) return 0;
  const counts = bucketCounts(stat);
  const behind = counts
    .slice(playerBucket + 1)
    .reduce((sum, value) => sum + value, 0);
  return toPercent(behind, stat.plays);
}

// ---------------------------------------------------------------------------
// Cross-mode header strip
// ---------------------------------------------------------------------------

const headerStrip = computed(() => ({
  classicStreak: summary.value.currentClassicStreak,
  expeditionStreak: summary.value.currentExpeditionStreak,
  medals: summary.value.medalCounts,
  hasHistory: summary.value.modeSessionsPlayed > 0,
}));

// ---------------------------------------------------------------------------
// Today (personal read + community centrepiece)
// ---------------------------------------------------------------------------

const modeAccentVar = computed(() => ({
  '--hist-accent-rgb':
    selectedMode.value === 'classic'
      ? 'var(--color-gold-rgb)'
      : 'var(--color-expedition-accent-rgb)',
}));

const todayGameNo = computed(
  () =>
    communityOverview.value?.current.gameNo ??
    localProgress.currentRoadContext.value.currentGameNo ??
    null,
);

const todayField = computed<CommunityRoadStats | null>(
  () => communityOverview.value?.current[selectedMode.value] ?? null,
);

const todayResult = computed(() =>
  playerResult(todayGameNo.value, selectedMode.value),
);

const todayCard = computed(() => {
  const result = todayResult.value;
  const gameNo = todayGameNo.value;

  if (!result || (result.attempts === 0 && !result.solved)) {
    return {
      state: 'unplayed' as const,
      eyebrow: 'Today',
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
      eyebrow: 'Today · solved',
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
    eyebrow: 'Today · in progress',
    title: gameNo ? `Road ${gameNo}` : 'Today’s road',
    detail: `${formatRunCount(result.attempts)} in${result.hintsUsed > 0 ? ` · ${result.hintsUsed} hint${result.hintsUsed === 1 ? '' : 's'}` : ''}. The solve is still out there.`,
  };
});

const todayHeadline = computed(() => {
  const field = todayField.value;
  const gameNo = todayGameNo.value;
  const result = todayResult.value;

  if (!field || field.plays <= 0) {
    return result?.solved
      ? 'You’re first on the board today — the field is still forming.'
      : 'Today’s road is fresh. Be one of the first to chart it.';
  }

  const bucket = bucketOf(result);

  if (result?.solved) {
    const ahead = aheadPercent(field, bucket);
    return ahead > 0
      ? `Solved in ${formatRunCount(result.attempts)} — ahead of ${ahead}% of today’s roadgoers.`
      : 'Solved and right at the front of today’s field.';
  }

  if (bucket === 4) {
    const road = gameNo ? `Road ${gameNo}` : 'this road';
    return `${field.solveRate}% of roadgoers have solved ${road} so far. Your route’s still open.`;
  }

  return `${field.solveRate}% of roadgoers have already solved today’s road.`;
});

const todayBars = computed<HistogramBar[]>(() => {
  const field = todayField.value;
  if (!field) return [];
  return buildTriesBars(field, bucketOf(todayResult.value));
});

const showTodayHistogram = computed(
  () => Boolean(todayField.value && todayField.value.plays > 0),
);

// ---------------------------------------------------------------------------
// Community comparison (yesterday's completed road)
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

const yesterdaySegments = computed(() => {
  const field = yesterdayField.value;
  if (!field || field.plays <= 0) return [];

  const counts = bucketCounts(field);
  const defs = [
    { key: 'gold', label: UI_COPY.boardHeader.medals.gold, tone: 'gold' },
    { key: 'silver', label: UI_COPY.boardHeader.medals.silver, tone: 'silver' },
    { key: 'bronze', label: UI_COPY.boardHeader.medals.bronze, tone: 'bronze' },
    { key: 'late', label: 'Later solve', tone: 'late' },
    { key: 'dnf', label: 'Unsolved', tone: 'dnf' },
  ] as const;

  return defs
    .map((def, index) => ({
      ...def,
      count: counts[index]!,
      width: toPercent(counts[index]!, field.plays),
    }))
    .filter((segment) => segment.count > 0);
});

const yesterdayHeadline = computed(() => {
  const field = yesterdayField.value;
  const result = yesterdayResult.value;
  if (!field || field.plays <= 0) return null;

  if (result?.solved) {
    const ahead = aheadPercent(field, bucketOf(result));
    return ahead > 0
      ? `You solved it in ${formatRunCount(result.attempts)} — ahead of ${ahead}% of the field.`
      : 'You solved it near the very front of the field.';
  }

  return `${field.solveRate}% of roadgoers solved yesterday’s road.`;
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
// All-time snapshot (mode-scoped)
// ---------------------------------------------------------------------------

const modeSummary = computed(() => summary.value.modeBreakdown[selectedMode.value]);

const allTimeHeadline = computed(() => {
  const stats = modeSummary.value;
  return [
    { key: 'solves', label: 'Solves', value: String(stats.exactSolves) },
    { key: 'rate', label: 'Solve rate', value: `${stats.solveRate}%` },
    { key: 'avg', label: 'Avg runs', value: stats.averageSolvedAttempts },
    { key: 'best', label: 'Best time', value: formatDurationMs(stats.bestSolveTimeMs) },
  ];
});

const allTimeDetail = computed(() => {
  const stats = modeSummary.value;
  return [
    { key: 'sessions', label: 'Roads played', value: String(stats.sessionsPlayed) },
    { key: 'streak', label: 'Best streak', value: `${stats.bestStreak} day${stats.bestStreak === 1 ? '' : 's'}` },
    { key: 'avgTime', label: 'Avg solve time', value: formatDurationMs(stats.averageSolveTimeMs) },
    { key: 'hints', label: 'Hints used', value: String(stats.totalHints) },
    { key: 'gold', label: `${UI_COPY.boardHeader.medals.gold} medals`, value: String(stats.medalCounts.gold) },
    { key: 'silver', label: `${UI_COPY.boardHeader.medals.silver} medals`, value: String(stats.medalCounts.silver) },
    { key: 'bronze', label: `${UI_COPY.boardHeader.medals.bronze} medals`, value: String(stats.medalCounts.bronze) },
  ];
});

const hasModeHistory = computed(() => modeSummary.value.sessionsPlayed > 0);

// ---------------------------------------------------------------------------
// Recent road log (mode-scoped)
// ---------------------------------------------------------------------------

const modeRoadLog = computed(() =>
  recentDays.value
    .map((day) => {
      const record = day.modes[selectedMode.value];
      if (!record || (record.attempts === 0 && !record.solved)) return null;

      const medal = medalOf(record);
      return {
        key: `${day.day}:${selectedMode.value}`,
        day: day.day,
        gameNo: day.gameNo,
        solved: record.solved,
        medal,
        result: record.solved ? formatMedal(medal) : 'Walked',
        chips: [
          formatRunCount(record.attempts),
          record.hintsUsed > 0
            ? `${record.hintsUsed} hint${record.hintsUsed === 1 ? '' : 's'}`
            : null,
          record.solveTimeMs !== null ? formatDurationMs(record.solveTimeMs) : null,
        ].filter((chip): chip is string => Boolean(chip)),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
);

const visibleRoadLog = computed(() =>
  showFullHistory.value
    ? modeRoadLog.value
    : modeRoadLog.value.slice(0, HISTORY_PREVIEW_COUNT),
);

const hiddenRoadCount = computed(() =>
  Math.max(modeRoadLog.value.length - HISTORY_PREVIEW_COUNT, 0),
);

function badgeClass(medal: Medal | null, solved: boolean) {
  return {
    'badge--solved': solved,
    'badge--gold': medal === 'gold',
    'badge--silver': medal === 'silver',
    'badge--bronze': medal === 'bronze',
  };
}

// ---------------------------------------------------------------------------
// Share & explore
// ---------------------------------------------------------------------------

const latestShareable = computed<ShareableRoadResult | null>(() => {
  const results = recentDays.value.flatMap((entry) =>
    (['classic', 'expedition'] as const).flatMap((mode) => {
      const record = entry.modes[mode];
      if (!record || record.attempts === 0) return [];
      return [
        {
          ...record,
          day: entry.day,
          gameNo: entry.gameNo,
          puzzleType: mode,
        },
      ];
    }),
  );

  results.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return results[0] ?? null;
});

const latestShareCard = computed(() => {
  const result = latestShareable.value;
  if (!result) return null;

  const medal = calcMedalForAttempt(result.attempts, result.solved);
  return {
    eyebrow: 'Latest run',
    title: `Road ${result.gameNo} · ${formatModeLabel(result.puzzleType)}`,
    status: result.solved
      ? `${formatMedal(medal)} in ${formatRunCount(result.attempts)}`
      : `${formatRunCount(result.attempts)} and still chasing it`,
    detail: [
      result.solved && result.solveTimeMs !== null
        ? formatDurationMs(result.solveTimeMs)
        : null,
      result.hintsUsed > 0
        ? `${result.hintsUsed} hint${result.hintsUsed === 1 ? '' : 's'}`
        : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(' · '),
    buttonLabel: result.solved ? 'Share this result' : `Share this ${UI_COPY.boardFooter.attemptLabel.toLowerCase()}`,
  };
});

const currentGameNo = computed(
  () =>
    communityOverview.value?.current.gameNo ??
    localProgress.currentRoadContext.value.currentGameNo ??
    null,
);

const canExploreDeepArchive = computed(() =>
  hasDeepArchiveRoads(currentGameNo.value),
);

function scheduleFeedbackClear(target: { feedback: FeedbackMessage | null }) {
  window.setTimeout(() => {
    target.feedback = null;
  }, 3200);
}

async function runShare(
  input: {
    gameNo: number;
    puzzleType: PuzzleType;
    attempts: number;
    solved: boolean;
    solveTimeMs: number | null;
    hintsUsed: number;
  },
  slot: { busy: boolean; feedback: FeedbackMessage | null },
) {
  if (slot.busy) return;
  slot.busy = true;

  try {
    const outcome = await roadResultShare.shareRoadResult(input);
    if (outcome.outcome === 'cancelled' || !outcome.message) return;
    slot.feedback = {
      kind: outcome.outcome === 'unavailable' ? 'error' : 'success',
      message: outcome.message,
    };
    scheduleFeedbackClear(slot);
  } finally {
    slot.busy = false;
  }
}

async function shareTodayResult() {
  const result = todayResult.value;
  const gameNo = todayGameNo.value;
  if (!result || gameNo === null) return;

  await runShare(
    {
      gameNo,
      puzzleType: selectedMode.value,
      attempts: result.attempts,
      solved: result.solved,
      solveTimeMs: result.solveTimeMs,
      hintsUsed: result.hintsUsed,
    },
    todayShare.value,
  );
}

async function shareLatestResult() {
  const result = latestShareable.value;
  if (!result) return;

  await runShare(
    {
      gameNo: result.gameNo,
      puzzleType: result.puzzleType,
      attempts: result.attempts,
      solved: result.solved,
      solveTimeMs: result.solveTimeMs,
      hintsUsed: result.hintsUsed,
    },
    latestShare.value,
  );
}

async function goToRandomOlderRoad() {
  if (!canExploreDeepArchive.value || findingRandomRoad.value) return;

  findingRandomRoad.value = true;
  randomRoadError.value = null;

  try {
    const response = await gamesApi.getAnotherGame(
      localProgress.playerUUID.value,
    );
    await navigateTo(`/games/${response.gameNo}`);
  } catch {
    randomRoadError.value = 'A random older road is unavailable right now.';
  } finally {
    findingRandomRoad.value = false;
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

      <!-- Cross-mode header strip: never hidden by mode scoping -->
      <section class="strip" aria-label="Across both modes">
        <div class="strip-tile">
          <span class="strip-label">Classic streak</span>
          <strong class="strip-value">{{ headerStrip.classicStreak }}</strong>
          <span class="strip-unit">
            {{ headerStrip.classicStreak ? 'days running' : 'start today' }}
          </span>
        </div>
        <div class="strip-tile">
          <span class="strip-label">Expedition streak</span>
          <strong class="strip-value">{{ headerStrip.expeditionStreak }}</strong>
          <span class="strip-unit">
            {{ headerStrip.expeditionStreak ? 'days running' : 'start today' }}
          </span>
        </div>
        <div class="strip-tile strip-tile--medals">
          <span class="strip-label">Medals earned</span>
          <div class="strip-medals">
            <span class="strip-medal strip-medal--gold">
              {{ headerStrip.medals.gold }}<em>{{ UI_COPY.boardHeader.medals.gold }}</em>
            </span>
            <span class="strip-medal strip-medal--silver">
              {{ headerStrip.medals.silver }}<em>{{ UI_COPY.boardHeader.medals.silver }}</em>
            </span>
            <span class="strip-medal strip-medal--bronze">
              {{ headerStrip.medals.bronze }}<em>{{ UI_COPY.boardHeader.medals.bronze }}</em>
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
          :class="[
            `mode-switch-btn--${mode}`,
            { 'is-active': selectedMode === mode },
          ]"
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
        <!-- 1 · Personal emotional read: today + histogram -->
        <section class="panel panel--today" :style="modeAccentVar">
          <div class="today-lead">
            <p class="eyebrow">{{ todayCard.eyebrow }}</p>
            <div class="today-title-row">
              <h2>{{ todayCard.title }}</h2>
              <span
                v-if="todayCard.state === 'solved'"
                class="badge"
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
              <NuxtLink
                v-else
                to="/"
                class="btn btn--primary"
              >
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

          <div class="today-field">
            <p class="today-headline">{{ todayHeadline }}</p>
            <StatsTriesHistogram
              v-if="showTodayHistogram"
              :bars="todayBars"
              player-tag="You"
            />
            <p v-else class="field-forming">
              The field is still forming — check back as roadgoers post their runs.
            </p>
          </div>
        </section>

        <!-- 2 · Community comparison: yesterday, kept quiet -->
        <section
          v-if="yesterdayField && yesterdayField.plays > 0"
          class="panel panel--field"
        >
          <div class="field-head">
            <div>
              <p class="eyebrow">Yesterday’s field</p>
              <h2>
                Road {{ yesterdayGameNo }} · {{ formatModeLabel(selectedMode) }}
              </h2>
            </div>
            <span class="rate-pill">{{ yesterdayField.solveRate }}% solved</span>
          </div>

          <p v-if="yesterdayHeadline" class="field-headline">
            {{ yesterdayHeadline }}
          </p>

          <div
            class="split-bar"
            role="img"
            aria-label="How yesterday’s field finished"
          >
            <span
              v-for="segment in yesterdaySegments"
              :key="segment.key"
              class="split-seg"
              :class="`split-seg--${segment.tone}`"
              :style="{ width: `${segment.width}%` }"
              :title="`${segment.label}: ${segment.count}`"
            />
          </div>
          <div class="split-legend">
            <span
              v-for="segment in yesterdaySegments"
              :key="segment.key"
              class="legend-item"
            >
              <span class="legend-dot" :class="`split-seg--${segment.tone}`" />
              {{ segment.label }} · {{ segment.count }}
            </span>
          </div>

          <button
            v-if="yesterdayBehaviorRows.length"
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

        <!-- 3 · Compressed all-time snapshot -->
        <section v-if="hasModeHistory" class="panel panel--snapshot">
          <div class="section-head">
            <p class="eyebrow">All-time · {{ formatModeLabel(selectedMode) }}</p>
            <h2>Your snapshot</h2>
          </div>

          <div class="headline-grid">
            <div v-for="stat in allTimeHeadline" :key="stat.key" class="headline-stat">
              <strong>{{ stat.value }}</strong>
              <span>{{ stat.label }}</span>
            </div>
          </div>

          <button
            type="button"
            class="text-toggle"
            @click="showAllTimeDetail = !showAllTimeDetail"
          >
            {{ showAllTimeDetail ? 'Show less' : 'More detail' }}
          </button>

          <div v-if="showAllTimeDetail" class="detail-grid">
            <div v-for="stat in allTimeDetail" :key="stat.key" class="detail-stat">
              <span>{{ stat.label }}</span>
              <strong>{{ stat.value }}</strong>
            </div>
          </div>
        </section>

        <section v-else class="panel panel--empty">
          <h2>No {{ formatModeLabel(selectedMode) }} history yet</h2>
          <p>
            Play a {{ formatModeLabel(selectedMode) }} road and your snapshot,
            medals, and road log fill in here.
          </p>
          <NuxtLink to="/" class="btn btn--primary">Play today’s road</NuxtLink>
        </section>

        <!-- 4 · Recent road log -->
        <section v-if="modeRoadLog.length" class="panel panel--log">
          <div class="section-head">
            <p class="eyebrow">{{ formatModeLabel(selectedMode) }} · newest first</p>
            <h2>Recent roads</h2>
          </div>

          <ul class="log-list">
            <li v-for="entry in visibleRoadLog" :key="entry.key" class="log-row">
              <div class="log-lead">
                <span class="log-day">{{ formatDay(entry.day) }}</span>
                <strong class="log-road">Road {{ entry.gameNo }}</strong>
              </div>
              <div class="log-result">
                <span class="badge" :class="badgeClass(entry.medal, entry.solved)">
                  {{ entry.result }}
                </span>
                <span class="log-chips">{{ entry.chips.join(' · ') }}</span>
              </div>
            </li>
          </ul>

          <button
            v-if="hiddenRoadCount"
            type="button"
            class="text-toggle"
            @click="showFullHistory = !showFullHistory"
          >
            {{
              showFullHistory
                ? 'Show fewer roads'
                : `Show ${hiddenRoadCount} older road${hiddenRoadCount === 1 ? '' : 's'}`
            }}
          </button>
        </section>

        <!-- 5 · Share & explore -->
        <section
          v-if="latestShareCard || canExploreDeepArchive"
          class="panel panel--explore"
        >
          <div class="section-head">
            <p class="eyebrow">Carry it forward</p>
            <h2>Share &amp; explore</h2>
          </div>

          <div class="explore-grid">
            <article v-if="latestShareCard" class="explore-card">
              <p class="eyebrow">{{ latestShareCard.eyebrow }}</p>
              <h3>{{ latestShareCard.title }}</h3>
              <strong class="explore-status">{{ latestShareCard.status }}</strong>
              <p v-if="latestShareCard.detail" class="explore-detail">
                {{ latestShareCard.detail }}
              </p>
              <button
                type="button"
                class="btn btn--primary"
                :disabled="latestShare.busy"
                @click="shareLatestResult"
              >
                {{ latestShare.busy ? 'Preparing…' : latestShareCard.buttonLabel }}
              </button>
              <p
                v-if="latestShare.feedback"
                class="feedback"
                :class="{ 'feedback--error': latestShare.feedback.kind === 'error' }"
                aria-live="polite"
              >
                {{ latestShare.feedback.message }}
              </p>
            </article>

            <article v-if="canExploreDeepArchive" class="explore-card">
              <p class="eyebrow">Random older road</p>
              <h3>Wander the deep archive</h3>
              <p class="explore-detail">
                Jump to a random road older than the latest
                {{ RECENT_ARCHIVE_DAY_LIMIT }}, ready for a fresh replay.
              </p>
              <div class="explore-actions">
                <button
                  type="button"
                  class="btn btn--primary"
                  :disabled="findingRandomRoad"
                  @click="goToRandomOlderRoad"
                >
                  {{ findingRandomRoad ? 'Finding a road…' : 'Play a random older road' }}
                </button>
                <NuxtLink to="/games" class="btn btn--ghost">
                  Browse archive
                </NuxtLink>
              </div>
              <p
                v-if="randomRoadError"
                class="feedback feedback--error"
                aria-live="polite"
              >
                {{ randomRoadError }}
              </p>
            </article>
          </div>
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
  max-width: 760px;
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
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(var(--color-gold-rgb) / 0.6);
}

/* ── Header strip ─────────────────────────────────────────── */
.strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.7rem;
}

.strip-tile {
  display: grid;
  gap: 0.15rem;
  align-content: start;
  padding: 0.85rem 0.95rem;
  border-radius: var(--radius-md);
  background: var(--gradient-card-metric);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
}

.strip-label {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: rgb(var(--color-gold-rgb) / 0.6);
}

.strip-value {
  font-size: 1.8rem;
  font-weight: 900;
  line-height: 1;
  color: var(--color-gold-bright);
  font-variant-numeric: tabular-nums;
}

.strip-unit {
  font-size: 0.72rem;
  color: rgb(var(--color-gold-rgb) / 0.6);
}

.strip-medals {
  display: flex;
  gap: 0.85rem;
  margin-top: 0.2rem;
}

.strip-medal {
  display: grid;
  font-size: 1.35rem;
  font-weight: 900;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
}

.strip-medal em {
  font-style: normal;
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgb(var(--color-gold-rgb) / 0.55);
}

.strip-medal--gold {
  color: var(--color-gold-bright);
}
.strip-medal--silver {
  color: var(--color-medal-silver-muted);
}
.strip-medal--bronze {
  color: var(--color-medal-bronze-bright);
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

.mode-switch-btn--classic.is-active {
  color: var(--color-text-on-gold);
  background: var(--gradient-button-primary);
  box-shadow: 0 0 16px rgb(var(--color-gold-rgb) / 0.28);
}

.mode-switch-btn--expedition.is-active {
  color: var(--color-text-on-expedition);
  background: linear-gradient(
    135deg,
    var(--color-expedition-accent-bright) 0%,
    var(--color-expedition-accent) 100%
  );
  box-shadow: 0 0 16px rgb(var(--color-expedition-accent-rgb) / 0.32);
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

.panel h3 {
  margin: 0;
  color: var(--color-gold);
  font-size: 1.05rem;
}

.section-head {
  display: grid;
  gap: 0.2rem;
}

/* ── Today panel ──────────────────────────────────────────── */
.panel--today {
  border-color: rgb(var(--hist-accent-rgb) / 0.34);
  box-shadow: 0 0 0 1px rgb(var(--hist-accent-rgb) / 0.06) inset;
}

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
}

.today-actions {
  display: grid;
  gap: 0.4rem;
  justify-items: start;
}

.today-field {
  display: grid;
  gap: 0.85rem;
  padding-top: 1rem;
  border-top: 1px solid rgb(var(--color-gold-rgb) / 0.14);
}

.today-headline {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-gold-bright);
  line-height: var(--line-height-snug);
}

.field-forming {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.66);
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
  font-size: 0.8rem;
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

/* ── Field panel ──────────────────────────────────────────── */
.panel--field {
  background: var(--gradient-card-metric);
  border-color: rgb(var(--color-gold-rgb) / 0.14);
}

.field-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.rate-pill {
  padding: 0.24rem 0.6rem;
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.1);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
  color: rgb(var(--color-gold-rgb) / 0.86);
  font-size: 0.78rem;
  font-weight: 800;
  white-space: nowrap;
}

.field-headline {
  margin: 0;
  color: var(--color-gold-bright);
  font-weight: 700;
}

.split-bar {
  display: flex;
  height: 0.85rem;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: rgb(0 0 0 / 0.3);
}

.split-seg {
  height: 100%;
}

.split-seg--gold {
  background: var(--color-gold-bright);
}
.split-seg--silver {
  background: var(--color-medal-silver-segment);
}
.split-seg--bronze {
  background: var(--color-medal-bronze-segment);
}
.split-seg--late {
  background: rgb(var(--color-gold-rgb) / 0.4);
}
.split-seg--dnf {
  background: rgb(255 255 255 / 0.12);
}

.split-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.76rem;
  color: rgb(var(--color-gold-rgb) / 0.72);
}

.legend-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: var(--radius-circle);
}

.field-detail {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.3rem;
  color: rgb(var(--color-gold-rgb) / 0.76);
  font-size: 0.9rem;
}

/* ── Snapshot ─────────────────────────────────────────────── */
.headline-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.7rem;
}

.headline-stat {
  display: grid;
  gap: 0.2rem;
  padding: 0.9rem 0.75rem;
  border-radius: var(--radius-md);
  background: rgb(var(--color-gold-rgb) / 0.06);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.14);
  text-align: center;
}

.headline-stat strong {
  font-size: 1.5rem;
  font-weight: 900;
  color: var(--color-gold-bright);
  font-variant-numeric: tabular-nums;
}

.headline-stat span {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgb(var(--color-gold-rgb) / 0.62);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.6rem;
}

.detail-stat {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border-radius: var(--radius-sm);
  background: rgb(0 0 0 / 0.2);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.12);
}

.detail-stat span {
  font-size: 0.82rem;
  color: rgb(var(--color-gold-rgb) / 0.68);
}

.detail-stat strong {
  color: var(--color-gold);
  font-variant-numeric: tabular-nums;
}

/* ── Road log ─────────────────────────────────────────────── */
.log-list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.log-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.9rem;
  border-radius: var(--radius-sm);
  background: rgb(var(--color-gold-rgb) / 0.05);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.12);
}

.log-lead {
  display: grid;
  gap: 0.15rem;
}

.log-day {
  font-size: 0.74rem;
  color: rgb(var(--color-gold-rgb) / 0.6);
}

.log-road {
  color: var(--color-gold);
}

.log-result {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
  justify-content: end;
  text-align: right;
}

.log-chips {
  font-size: 0.8rem;
  color: rgb(var(--color-gold-rgb) / 0.7);
  font-variant-numeric: tabular-nums;
}

/* ── Explore ──────────────────────────────────────────────── */
.explore-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.9rem;
}

.explore-card {
  display: grid;
  gap: 0.5rem;
  align-content: start;
  padding: 1.1rem;
  border-radius: var(--radius-md);
  background: rgb(var(--color-gold-rgb) / 0.05);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.14);
}

.explore-status {
  color: var(--color-gold-bright);
  font-size: 1.05rem;
}

.explore-detail {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.74);
  font-size: 0.9rem;
  line-height: var(--line-height-base);
}

.explore-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.2rem;
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
  font-size: 0.86rem;
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
  .strip {
    grid-template-columns: 1fr;
  }

  .strip-tile--medals {
    order: -1;
  }

  .headline-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .log-row {
    flex-direction: column;
    align-items: start;
    gap: 0.5rem;
  }

  .log-result {
    justify-content: start;
    text-align: left;
  }
}
</style>
