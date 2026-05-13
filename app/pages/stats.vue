<script setup lang="ts">
import { calcMedalForAttempt } from '../../lib/gameTiers';
import type {
  CommunityRoadStats,
  Medal,
  PuzzleType,
} from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';
import { useRoadResultShare } from '../composables/useRoadResultShare';
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
const yesterdayMode = ref<PuzzleType>('classic');
const HISTORY_PREVIEW_COUNT = 14;
const showFullHistory = ref(false);
const sharingLatestResult = ref(false);
const findingRandomRoad = ref(false);
const randomRoadError = ref<string | null>(null);
const shareFeedback = ref<{
  kind: 'success' | 'error';
  message: string;
} | null>(null);

type ComparisonCard = {
  key: string;
  modeLabel: string;
  gameNo: number;
  localStatus: string;
  localDetail: string;
  globalHeadline: string;
  globalDetail: string;
  globalMedals: string;
  globalBehavior: string;
  comparisonHeadline: string;
  comparisonDetail: string;
};

type YesterdayComparisonCard = ComparisonCard & {
  behaviorRows: string[];
};

type HistoryModeRecord = {
  attempts: number;
  solved: boolean;
  hintsUsed: number;
  solveTimeMs: number | null;
  updatedAt: string;
};

type ShareableRoadResult = HistoryModeRecord & {
  day: string;
  gameNo: number;
  puzzleType: PuzzleType;
};

function formatDay(day: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`));
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatModeLabel(mode: PuzzleType): string {
  return mode === 'classic' ? 'Classic' : 'Expedition';
}

function hintTotal(progress: { hintsUsed: number }): number {
  return progress.hintsUsed;
}

function formatAttemptLabel(attempts: number): string {
  return `${attempts} attempt${attempts === 1 ? '' : 's'}`;
}

function toPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function formatMedal(medal: Medal | null): string {
  return medal ? UI_COPY.boardHeader.medals[medal] : 'Solved';
}

function formatAverage(value: number | null, digits = 1): string {
  if (value === null) return '—';
  return value.toFixed(digits).replace(/\.0$/, '');
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

function getHistoryModeMedal(record: HistoryModeRecord): Medal | null {
  return calcMedalForAttempt(record.attempts, record.solved);
}

function formatHistoryModeResult(record: HistoryModeRecord): string {
  if (!record.solved) return 'Tried';
  return formatMedal(getHistoryModeMedal(record));
}

function historyModeBadgeClass(record: HistoryModeRecord) {
  const medal = getHistoryModeMedal(record);

  return {
    'mode-badge--solved': record.solved,
    'mode-badge--gold': medal === 'gold',
    'mode-badge--silver': medal === 'silver',
    'mode-badge--bronze': medal === 'bronze',
  };
}

function hasShareableResult(record: HistoryModeRecord): boolean {
  return record.attempts > 0;
}

function formatShareResultStatus(result: ShareableRoadResult): string {
  const medal = calcMedalForAttempt(result.attempts, result.solved);

  if (result.solved) {
    return `${formatMedal(medal)} in ${formatAttemptLabel(result.attempts)}`;
  }

  return `${formatAttemptLabel(result.attempts)} and still chasing the exact solve`;
}

function formatShareResultDetail(result: ShareableRoadResult): string {
  const parts = [
    result.solved && result.solveTimeMs !== null
      ? `Solve time ${formatDurationMs(result.solveTimeMs)}`
      : null,
    result.hintsUsed > 0
      ? `${result.hintsUsed} hint${result.hintsUsed === 1 ? '' : 's'}`
      : null,
    `Last played ${formatTimestamp(result.updatedAt)}`,
  ].filter((value): value is string => Boolean(value));

  return parts.join(' · ');
}

function describeLocalStatus(globalStat: CommunityRoadStats) {
  const progress = localProgress.getGameProgress(
    globalStat.gameNo,
    globalStat.puzzleType,
  );
  const hints = hintTotal(progress);
  const medal = calcMedalForAttempt(progress.attempts, progress.solved);

  if (progress.solved) {
    return {
      status: formatMedal(medal),
      detail: `Solved in ${progress.attempts} attempt${progress.attempts === 1 ? '' : 's'} · ${hints} hint${hints === 1 ? '' : 's'}${progress.solveTimeMs !== null ? ` · ${formatDurationMs(progress.solveTimeMs)}` : ''}`,
    };
  }

  if (progress.attempts > 0 || hints > 0) {
    return {
      status: `Attempt ${progress.attempts || 1}`,
      detail: `${hints} hint${hints === 1 ? '' : 's'}${progress.guidePath.length ? ' · retry guide ready' : ''}`,
    };
  }

  return {
    status: 'Unplayed',
    detail: 'No local runs recorded yet',
  };
}

function buildComparisonInsight(globalStat: CommunityRoadStats) {
  const progress = localProgress.getGameProgress(
    globalStat.gameNo,
    globalStat.puzzleType,
  );
  const medal = calcMedalForAttempt(progress.attempts, progress.solved);

  if (globalStat.plays === 0) {
    return {
      headline: 'No community runs recorded yet',
      detail:
        'This road has not posted enough anonymous analytics to compare against yet.',
    };
  }

  const exactSolveRate = toPercent(globalStat.exactSolves, globalStat.plays);
  const unfinishedRuns = Math.max(globalStat.plays - globalStat.exactSolves, 0);
  const silverOrBetter = Math.min(
    globalStat.gold + globalStat.silver,
    globalStat.plays,
  );
  const bronzeOrBetter = Math.min(
    silverOrBetter + globalStat.bronze,
    globalStat.plays,
  );
  const nonMedalSolves = Math.max(
    globalStat.exactSolves -
      globalStat.gold -
      globalStat.silver -
      globalStat.bronze,
    0,
  );

  if (progress.solved) {
    if (medal === 'gold') {
      return {
        headline: `Ahead of ${toPercent(globalStat.plays - globalStat.gold, globalStat.plays)}% of recorded runs`,
        detail: `${toPercent(globalStat.gold, globalStat.plays)}% of runs have also landed Gold so far.`,
      };
    }

    if (medal === 'silver') {
      return {
        headline: `Ahead of ${toPercent(globalStat.plays - silverOrBetter, globalStat.plays)}% of recorded runs`,
        detail: `${toPercent(silverOrBetter, globalStat.plays)}% of runs have reached Silver or better so far.`,
      };
    }

    if (medal === 'bronze') {
      return {
        headline: `Ahead of ${toPercent(globalStat.plays - bronzeOrBetter, globalStat.plays)}% of recorded runs`,
        detail: `${toPercent(bronzeOrBetter, globalStat.plays)}% of runs have reached the medal band so far.`,
      };
    }

    return {
      headline: `Ahead of ${toPercent(unfinishedRuns, globalStat.plays)}% of recorded runs`,
      detail: `${toPercent(nonMedalSolves, globalStat.plays)}% of runs exact-solve outside the medal band.`,
    };
  }

  if (progress.attempts > 0 || hintTotal(progress) > 0) {
    return {
      headline: `${100 - exactSolveRate}% of recorded runs are still unsolved`,
      detail: `${exactSolveRate}% of runs exact-solve this road so far.`,
    };
  }

  return {
    headline: `${exactSolveRate}% exact solve rate so far`,
    detail: `${toPercent(unfinishedRuns, globalStat.plays)}% of recorded runs have not exact-solved this road yet.`,
  };
}

function buildBehaviorRows(globalStat: CommunityRoadStats): string[] {
  const rows = [
    `${globalStat.behavior.hintUsers} hint user${globalStat.behavior.hintUsers === 1 ? '' : 's'} · ${globalStat.behavior.totalHints} total hints`,
    `First hint avg: attempt ${formatAverage(globalStat.behavior.averageAttemptsBeforeFirstHint)} · move ${formatAverage(globalStat.behavior.averageFirstHintMoveIndex)}`,
    `Avg dead ends ${formatAverage(globalStat.behavior.averageDeadEndCount)} · wrong exits ${formatAverage(globalStat.behavior.averageWrongExitCount)}`,
  ];

  if (globalStat.behavior.averageSolveTimeMs !== null) {
    rows.push(
      `Avg solve time ${formatDurationMs(globalStat.behavior.averageSolveTimeMs)}`,
    );
  }

  return rows;
}

function toComparisonCard(globalStat: CommunityRoadStats): ComparisonCard {
  const local = describeLocalStatus(globalStat);
  const comparison = buildComparisonInsight(globalStat);

  return {
    key: `${globalStat.puzzleType}:${globalStat.gameNo}`,
    modeLabel: formatModeLabel(globalStat.puzzleType),
    gameNo: globalStat.gameNo,
    localStatus: local.status,
    localDetail: local.detail,
    globalHeadline: `${globalStat.solveRate}% exact solve rate`,
    globalDetail: `${globalStat.plays} play${globalStat.plays === 1 ? '' : 's'} · ${globalStat.exactSolves} exact solve${globalStat.exactSolves === 1 ? '' : 's'}`,
    globalMedals: `${globalStat.gold} gold · ${globalStat.silver} silver · ${globalStat.bronze} bronze`,
    globalBehavior: `${globalStat.behavior.hintUseRate}% used hints · ${globalStat.behavior.totalHints} total hints`,
    comparisonHeadline: comparison.headline,
    comparisonDetail: comparison.detail,
  };
}

const currentComparisonCards = computed<ComparisonCard[]>(() => {
  const current = communityOverview.value?.current;
  if (!current) return [];

  return (['classic', 'expedition'] as const)
    .map((mode) => current[mode])
    .filter((entry): entry is CommunityRoadStats => Boolean(entry))
    .map((entry) => toComparisonCard(entry));
});

const yesterdayAvailableModes = computed<PuzzleType[]>(() => {
  const yesterday = communityOverview.value?.yesterday;
  if (!yesterday) return [];

  return (['classic', 'expedition'] as const).filter((mode) =>
    Boolean(yesterday[mode]),
  );
});

watchEffect(() => {
  const availableModes = yesterdayAvailableModes.value;
  if (!availableModes.length) return;
  if (!availableModes.includes(yesterdayMode.value)) {
    yesterdayMode.value = availableModes[0]!;
  }
});

const yesterdayComparisonCard = computed<YesterdayComparisonCard | null>(() => {
  const yesterday = communityOverview.value?.yesterday;
  if (!yesterday || yesterday.gameNo === null) return null;

  const selectedEntry =
    yesterday[yesterdayMode.value] ??
    (yesterdayAvailableModes.value.length
      ? yesterday[yesterdayAvailableModes.value[0]!]
      : null);
  if (!selectedEntry) return null;

  return {
    ...toComparisonCard(selectedEntry),
    behaviorRows: buildBehaviorRows(selectedEntry),
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

const latestShareableResult = computed<ShareableRoadResult | null>(() => {
  const shareableResults = recentDays.value
    .flatMap((entry) => {
      const results: ShareableRoadResult[] = [];

      if (entry.modes.classic && hasShareableResult(entry.modes.classic)) {
        results.push({
          ...entry.modes.classic,
          day: entry.day,
          gameNo: entry.gameNo,
          puzzleType: 'classic',
        });
      }

      if (
        entry.modes.expedition &&
        hasShareableResult(entry.modes.expedition)
      ) {
        results.push({
          ...entry.modes.expedition,
          day: entry.day,
          gameNo: entry.gameNo,
          puzzleType: 'expedition',
        });
      }

      return results;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return shareableResults[0] ?? null;
});

const latestShareSummary = computed(() => {
  const result = latestShareableResult.value;
  if (!result) return null;

  return {
    eyebrow: 'Latest attempted result',
    title: `Road ${result.gameNo} · ${formatModeLabel(result.puzzleType)}`,
    status: formatShareResultStatus(result),
    detail: formatShareResultDetail(result),
    buttonLabel: result.solved ? 'Share latest result' : 'Share latest attempt',
  };
});

watch(shareFeedback, (nextFeedback, _previousFeedback, onCleanup) => {
  if (!nextFeedback) return;

  const timer = window.setTimeout(() => {
    shareFeedback.value = null;
  }, 3200);

  onCleanup(() => {
    window.clearTimeout(timer);
  });
});

async function shareLatestResult() {
  const result = latestShareableResult.value;
  if (!result || sharingLatestResult.value) return;

  sharingLatestResult.value = true;

  try {
    const shareResult = await roadResultShare.shareRoadResult({
      gameNo: result.gameNo,
      puzzleType: result.puzzleType,
      attempts: result.attempts,
      solved: result.solved,
      solveTimeMs: result.solveTimeMs,
      hintsUsed: result.hintsUsed,
    });

    if (shareResult.outcome === 'cancelled' || !shareResult.message) {
      return;
    }

    shareFeedback.value = {
      kind: shareResult.outcome === 'unavailable' ? 'error' : 'success',
      message: shareResult.message,
    };
  } finally {
    sharingLatestResult.value = false;
  }
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

const modeSummaryCards = computed(() =>
  (['classic', 'expedition'] as const).map((mode) => ({
    key: mode,
    label: formatModeLabel(mode),
    stats: summary.value.modeBreakdown[mode],
  })),
);

const hiddenHistoryCount = computed(() =>
  Math.max(recentDays.value.length - HISTORY_PREVIEW_COUNT, 0),
);

const visibleRecentDays = computed(() =>
  showFullHistory.value
    ? recentDays.value
    : recentDays.value.slice(0, HISTORY_PREVIEW_COUNT),
);

const historyToggleLabel = computed(() => {
  if (showFullHistory.value) {
    return 'Show fewer roads';
  }

  return `Show ${hiddenHistoryCount.value} older road${hiddenHistoryCount.value === 1 ? '' : 's'}`;
});

onMounted(async () => {
  localProgress.load();
  localStats.load();

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
        <h1>Your Stats</h1>
        <p class="subtitle">
          Local progress, medals, streaks, and hint usage across your recent
          roads.
        </p>
      </header>

      <section v-if="loading" class="empty-state">
        <h2>Loading stats…</h2>
      </section>

      <template v-else>
        <section v-if="currentComparisonCards.length" class="compare-section">
          <div class="compare-header">
            <div>
              <h2>Today Against The Field</h2>
              <p>
                These global counts come from anonymous per-road analytics for
                the current active roads.
              </p>
            </div>
          </div>

          <div class="compare-grid">
            <article
              v-for="card in currentComparisonCards"
              :key="card.key"
              class="compare-card"
            >
              <div class="compare-card-top">
                <div>
                  <p class="compare-eyebrow">{{ card.modeLabel }}</p>
                  <h3>Road {{ card.gameNo }}</h3>
                </div>
                <span class="compare-rate">{{ card.globalHeadline }}</span>
              </div>

              <div class="compare-columns">
                <section class="compare-block">
                  <span class="compare-label">You</span>
                  <strong>{{ card.localStatus }}</strong>
                  <p>{{ card.localDetail }}</p>
                </section>

                <section class="compare-block compare-block--global">
                  <span class="compare-label">Global</span>
                  <strong>{{ card.globalDetail }}</strong>
                  <p>{{ card.globalMedals }}</p>
                  <p class="compare-subline">{{ card.globalBehavior }}</p>
                </section>
              </div>

              <div class="compare-insight">
                <strong>{{ card.comparisonHeadline }}</strong>
                <p>{{ card.comparisonDetail }}</p>
              </div>
            </article>
          </div>
        </section>

        <section
          v-if="yesterdayComparisonCard"
          class="compare-section compare-section--featured"
        >
          <div class="compare-header compare-header--featured">
            <div>
              <h2>Yesterday Against The Field</h2>
              <p>
                One road card with a mode toggle, using the new anonymous
                analytics model.
              </p>
            </div>

            <div
              v-if="yesterdayAvailableModes.length > 1"
              class="mode-toggle"
              role="tablist"
              aria-label="Yesterday mode toggle"
            >
              <button
                v-for="mode in yesterdayAvailableModes"
                :key="mode"
                type="button"
                class="mode-toggle-button"
                :class="{
                  'mode-toggle-button--active': yesterdayMode === mode,
                }"
                @click="yesterdayMode = mode"
              >
                {{ formatModeLabel(mode) }}
              </button>
            </div>
          </div>

          <article class="compare-card compare-card--featured">
            <div class="compare-card-top">
              <div>
                <p class="compare-eyebrow">
                  {{ yesterdayComparisonCard.modeLabel }}
                </p>
                <h3>Road {{ yesterdayComparisonCard.gameNo }}</h3>
              </div>
              <span class="compare-rate">
                {{ yesterdayComparisonCard.globalHeadline }}
              </span>
            </div>

            <div class="compare-columns">
              <section class="compare-block">
                <span class="compare-label">You</span>
                <strong>{{ yesterdayComparisonCard.localStatus }}</strong>
                <p>{{ yesterdayComparisonCard.localDetail }}</p>
              </section>

              <section class="compare-block compare-block--global">
                <span class="compare-label">Global</span>
                <strong>{{ yesterdayComparisonCard.globalDetail }}</strong>
                <p>{{ yesterdayComparisonCard.globalMedals }}</p>
                <p class="compare-subline">
                  {{ yesterdayComparisonCard.globalBehavior }}
                </p>
              </section>
            </div>

            <div class="compare-insight">
              <strong>{{ yesterdayComparisonCard.comparisonHeadline }}</strong>
              <p>{{ yesterdayComparisonCard.comparisonDetail }}</p>
            </div>

            <div class="compare-behavior">
              <span class="compare-label">Field Behavior</span>
              <ul class="behavior-list">
                <li
                  v-for="row in yesterdayComparisonCard.behaviorRows"
                  :key="row"
                >
                  {{ row }}
                </li>
              </ul>
            </div>
          </article>
        </section>

        <p v-if="communityError" class="community-error">
          {{ communityError }}
        </p>

        <section
          v-if="latestShareSummary || canExploreDeepArchive"
          class="actions-section"
        >
          <div class="section-header">
            <h2>Share & Explore</h2>
            <p>
              Bring your latest result with you or jump beyond the recent
              archive.
            </p>
          </div>

          <div class="actions-grid">
            <article v-if="latestShareSummary" class="action-card">
              <div class="action-header">
                <div>
                  <p class="compare-eyebrow">
                    {{ latestShareSummary.eyebrow }}
                  </p>
                  <h3>{{ latestShareSummary.title }}</h3>
                </div>
              </div>

              <div class="action-body">
                <strong class="action-status">
                  {{ latestShareSummary.status }}
                </strong>
                <p class="action-detail">{{ latestShareSummary.detail }}</p>
              </div>

              <div class="action-footer">
                <button
                  type="button"
                  class="action-button"
                  :disabled="sharingLatestResult"
                  @click="shareLatestResult"
                >
                  {{
                    sharingLatestResult
                      ? 'Preparing share…'
                      : latestShareSummary.buttonLabel
                  }}
                </button>

                <p class="action-hint">
                  Uses native share when available, or copies the text if not.
                </p>

                <p
                  v-if="shareFeedback"
                  class="action-feedback"
                  :class="{
                    'action-feedback--error': shareFeedback.kind === 'error',
                  }"
                  aria-live="polite"
                >
                  {{ shareFeedback.message }}
                </p>
              </div>
            </article>

            <article v-if="canExploreDeepArchive" class="action-card">
              <div class="action-header">
                <div>
                  <p class="compare-eyebrow">Random older road</p>
                  <h3>Go beyond the recent archive</h3>
                </div>
                <span class="compare-rate">
                  Older than the latest {{ RECENT_ARCHIVE_DAY_LIMIT }}
                </span>
              </div>

              <div class="action-body">
                <strong class="action-status">
                  Jump to a random road day from the deeper archive.
                </strong>
                <p class="action-detail">
                  It still opens the normal replay flow with both Classic and
                  Expedition ready.
                </p>
              </div>

              <div class="action-footer action-footer--split">
                <button
                  type="button"
                  class="action-button"
                  :disabled="findingRandomRoad"
                  @click="goToRandomOlderRoad"
                >
                  {{
                    findingRandomRoad
                      ? 'Finding an older road…'
                      : 'Play a Random Older Road'
                  }}
                </button>

                <NuxtLink to="/games" class="action-link">
                  Browse Recent Archive
                </NuxtLink>
              </div>

              <p
                v-if="randomRoadError"
                class="action-feedback action-feedback--error"
                aria-live="polite"
              >
                {{ randomRoadError }}
              </p>
            </article>
          </div>
        </section>

        <section v-if="!summary.modeSessionsPlayed" class="empty-state">
          <h2>No local stats yet</h2>
          <p>
            Finish a road or use a hint and your personal history will start
            filling in below the global comparison.
          </p>
        </section>

        <template v-else>
          <section class="overview-section">
            <div class="section-header">
              <h2>All-Time Snapshot</h2>
              <p>Derived from the local history stored on this device.</p>
            </div>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">{{ summary.roadDaysPlayed }}</div>
                <div class="stat-label">Road Days</div>
              </div>

              <div class="stat-card">
                <div class="stat-value">{{ summary.exactSolves }}</div>
                <div class="stat-label">Exact Solves</div>
              </div>

              <div class="stat-card">
                <div class="stat-value">{{ summary.currentClassicStreak }}</div>
                <div class="stat-label">Classic Solve Streak</div>
              </div>

              <div class="stat-card">
                <div class="stat-value">
                  {{ summary.currentExpeditionStreak }}
                </div>
                <div class="stat-label">Expedition Solve Streak</div>
              </div>

              <div class="stat-card">
                <div class="stat-value">{{ summary.totalHints }}</div>
                <div class="stat-label">Hints Used</div>
              </div>
            </div>

            <div class="secondary-grid">
              <article class="detail-card">
                <span class="detail-label">Solve Rate</span>
                <strong>{{ summary.solveRate }}%</strong>
              </article>

              <article class="detail-card">
                <span class="detail-label">Best Classic Solve Streak</span>
                <strong>{{ summary.bestClassicStreak }}</strong>
              </article>

              <article class="detail-card">
                <span class="detail-label">Best Expedition Solve Streak</span>
                <strong>{{ summary.bestExpeditionStreak }}</strong>
              </article>

              <article class="detail-card">
                <span class="detail-label">Mode Sessions</span>
                <strong>{{ summary.modeSessionsPlayed }}</strong>
              </article>

              <article class="detail-card">
                <span class="detail-label">Avg Solve Attempt</span>
                <strong>{{ summary.averageSolvedAttempts }}</strong>
              </article>

              <article class="detail-card">
                <span class="detail-label">Avg Solve Time</span>
                <strong>{{
                  formatDurationMs(summary.averageSolveTimeMs)
                }}</strong>
              </article>

              <article class="detail-card">
                <span class="detail-label">Best Solve Time</span>
                <strong>{{ formatDurationMs(summary.bestSolveTimeMs) }}</strong>
              </article>
            </div>
          </section>

          <section class="mode-breakdown-section">
            <div class="section-header">
              <h2>Mode Breakdown</h2>
              <p>
                Classic and Expedition keep separate streaks, hints, medals, and
                timing.
              </p>
            </div>

            <div class="mode-breakdown-grid">
              <article
                v-for="card in modeSummaryCards"
                :key="card.key"
                class="mode-summary-card"
              >
                <div class="mode-summary-header">
                  <div>
                    <p class="compare-eyebrow">{{ card.label }}</p>
                    <h3>
                      {{ card.stats.exactSolves }} exact solve{{
                        card.stats.exactSolves === 1 ? '' : 's'
                      }}
                    </h3>
                  </div>
                  <span class="compare-rate">
                    {{ card.stats.solveRate }}% solve rate
                  </span>
                </div>

                <div class="mode-summary-stats">
                  <div class="mode-summary-item">
                    <span>Sessions</span>
                    <strong>{{ card.stats.sessionsPlayed }}</strong>
                  </div>

                  <div class="mode-summary-item">
                    <span>Current solve streak</span>
                    <strong>{{ card.stats.currentStreak }}</strong>
                  </div>

                  <div class="mode-summary-item">
                    <span>Best solve streak</span>
                    <strong>{{ card.stats.bestStreak }}</strong>
                  </div>

                  <div class="mode-summary-item">
                    <span>Hints used</span>
                    <strong>{{ card.stats.totalHints }}</strong>
                  </div>

                  <div class="mode-summary-item">
                    <span>Avg attempt</span>
                    <strong>{{ card.stats.averageSolvedAttempts }}</strong>
                  </div>

                  <div class="mode-summary-item">
                    <span>Avg time</span>
                    <strong>{{
                      formatDurationMs(card.stats.averageSolveTimeMs)
                    }}</strong>
                  </div>
                </div>

                <div class="mode-summary-footer">
                  <div class="mode-summary-item">
                    <span>Best time</span>
                    <strong>{{
                      formatDurationMs(card.stats.bestSolveTimeMs)
                    }}</strong>
                  </div>

                  <div class="mode-summary-medals">
                    <span>{{ card.stats.medalCounts.gold }} gold</span>
                    <span>{{ card.stats.medalCounts.silver }} silver</span>
                    <span>{{ card.stats.medalCounts.bronze }} bronze</span>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section class="tier-section">
            <h2>Medal Breakdown</h2>
            <div class="tier-grid">
              <div class="tier-card tier-gold">
                <div class="tier-count">{{ summary.medalCounts.gold }}</div>
                <div class="tier-label">Gold</div>
              </div>

              <div class="tier-card tier-silver">
                <div class="tier-count">{{ summary.medalCounts.silver }}</div>
                <div class="tier-label">Silver</div>
              </div>

              <div class="tier-card tier-bronze">
                <div class="tier-count">{{ summary.medalCounts.bronze }}</div>
                <div class="tier-label">Bronze</div>
              </div>
            </div>
          </section>

          <section class="history-section">
            <div class="history-header">
              <h2>Recent Road Log</h2>
              <p>
                Latest first. Classic and Expedition keep separate run
                summaries.
              </p>
            </div>

            <div class="history-list">
              <article
                v-for="entry in visibleRecentDays"
                :key="entry.day"
                class="history-card"
              >
                <div class="history-top">
                  <div>
                    <p class="history-day">{{ formatDay(entry.day) }}</p>
                    <h3>Road {{ entry.gameNo }}</h3>
                  </div>
                </div>

                <div class="history-modes">
                  <section v-if="entry.modes.classic" class="mode-card">
                    <div class="mode-head">
                      <strong>Classic</strong>
                      <span
                        class="mode-badge"
                        :class="historyModeBadgeClass(entry.modes.classic)"
                      >
                        {{ formatHistoryModeResult(entry.modes.classic) }}
                      </span>
                    </div>
                    <p>Attempts: {{ entry.modes.classic.attempts }}</p>
                    <p>Hints: {{ hintTotal(entry.modes.classic) }}</p>
                    <p v-if="entry.modes.classic.solveTimeMs !== null">
                      Time:
                      {{ formatDurationMs(entry.modes.classic.solveTimeMs) }}
                    </p>
                  </section>

                  <section v-if="entry.modes.expedition" class="mode-card">
                    <div class="mode-head">
                      <strong>Expedition</strong>
                      <span
                        class="mode-badge"
                        :class="historyModeBadgeClass(entry.modes.expedition)"
                      >
                        {{ formatHistoryModeResult(entry.modes.expedition) }}
                      </span>
                    </div>
                    <p>Attempts: {{ entry.modes.expedition.attempts }}</p>
                    <p>Hints: {{ hintTotal(entry.modes.expedition) }}</p>
                    <p v-if="entry.modes.expedition.solveTimeMs !== null">
                      Time:
                      {{ formatDurationMs(entry.modes.expedition.solveTimeMs) }}
                    </p>
                  </section>
                </div>
              </article>
            </div>

            <div v-if="hiddenHistoryCount" class="history-footer">
              <button
                type="button"
                class="history-toggle"
                @click="showFullHistory = !showFullHistory"
              >
                {{ historyToggleLabel }}
              </button>
            </div>
          </section>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.shell {
  min-height: calc(100dvh - 60px);
  padding: 1.3rem;
}

.container {
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
  display: grid;
  gap: 0.45rem;
}

.compare-section,
.actions-section {
  margin-bottom: 2rem;
}

.overview-section,
.mode-breakdown-section {
  margin-bottom: 2rem;
}

.compare-header,
.section-header {
  margin-bottom: 1rem;
}

.compare-header--featured {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.compare-header h2,
.compare-card h3,
.section-header h2,
.mode-summary-header h3,
.action-card h3 {
  margin: 0;
  color: var(--color-gold);
}

.compare-header p,
.section-header p,
.community-error,
.compare-eyebrow,
.compare-block p {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.76);
}

.compare-grid,
.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.compare-card,
.action-card {
  display: grid;
  gap: 1rem;
  padding: 1.2rem;
  border-radius: var(--radius-lg);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
}

.compare-card--featured {
  border-color: rgb(var(--color-active-rgb) / 0.24);
  box-shadow: 0 0 0 1px rgb(var(--color-active-rgb) / 0.08) inset;
}

.compare-card-top {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.compare-eyebrow {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.compare-rate {
  padding: 0.24rem 0.55rem;
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.12);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.22);
  color: rgb(var(--color-gold-rgb) / 0.88);
  font-size: 0.8rem;
  font-weight: 700;
}

.compare-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.compare-block {
  display: grid;
  gap: 0.3rem;
  padding: 0.95rem 1rem;
  border-radius: var(--radius-md);
  background: rgb(var(--color-gold-rgb) / 0.06);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.14);
}

.compare-block--global {
  background: rgb(var(--color-gold-rgb) / 0.08);
}

.compare-label {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--color-gold-rgb) / 0.72);
}

.compare-block strong {
  color: var(--color-gold);
  font-size: 1.1rem;
}

.compare-subline {
  color: rgb(var(--color-gold-rgb) / 0.7);
}

.compare-insight {
  display: grid;
  gap: 0.25rem;
  padding-top: 0.25rem;
  border-top: 1px solid rgb(var(--color-gold-rgb) / 0.14);
}

.compare-insight strong {
  color: var(--color-gold-bright);
  font-size: 1rem;
}

.compare-insight p {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.74);
}

.action-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.action-body,
.action-footer {
  display: grid;
  gap: 0.55rem;
}

.action-footer {
  align-content: start;
}

.action-footer--split {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.action-status {
  color: var(--color-gold-bright);
  font-size: 1.05rem;
}

.action-detail,
.action-hint,
.action-feedback {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.76);
}

.action-hint,
.action-feedback {
  font-size: 0.88rem;
}

.action-feedback {
  color: rgb(var(--color-active-rgb) / 0.9);
}

.action-feedback--error {
  color: rgb(248 113 113 / 0.95);
}

.action-button,
.action-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border-radius: var(--radius-full);
  padding: 0.65rem 1rem;
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast),
    opacity var(--transition-fast);
}

.action-button {
  border: 1px solid rgb(var(--color-gold-rgb) / 0.5);
  background: var(--gradient-button-primary);
  color: var(--color-text-on-gold);
  cursor: pointer;
}

.action-button:hover,
.action-link:hover {
  transform: translateY(-1px);
}

.action-button:disabled {
  opacity: 0.75;
  cursor: wait;
  transform: none;
}

.action-link {
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
  background: rgb(var(--color-gold-rgb) / 0.08);
  color: rgb(var(--color-gold-rgb) / 0.84);
}

.action-link:hover {
  background: rgb(var(--color-gold-rgb) / 0.12);
}

.compare-behavior {
  display: grid;
  gap: 0.55rem;
  padding-top: 0.35rem;
  border-top: 1px solid rgb(var(--color-gold-rgb) / 0.14);
}

.behavior-list {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding-left: 1rem;
  color: rgb(var(--color-gold-rgb) / 0.78);
}

.mode-toggle {
  display: inline-flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.mode-toggle-button {
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
  background: rgb(var(--color-gold-rgb) / 0.08);
  color: rgb(var(--color-gold-rgb) / 0.8);
  border-radius: var(--radius-full);
  padding: 0.45rem 0.8rem;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.mode-toggle-button:hover {
  transform: translateY(-1px);
}

.mode-toggle-button--active {
  color: var(--color-text-on-gold);
  background: var(--gradient-button-primary);
  border-color: rgb(var(--color-gold-rgb) / 0.5);
}

.community-error {
  margin-bottom: 1rem;
}

.page-header h1 {
  font-size: 2.5rem;
  color: var(--color-gold);
  margin: 0 0 0.5rem;
}

.subtitle {
  color: var(--color-gold-muted);
  font-size: 1.1rem;
  margin: 0;
}

.empty-state {
  padding: 2rem;
  border-radius: var(--radius-lg);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
  color: rgb(var(--color-gold-rgb) / 0.82);
}

.empty-state h2,
.history-header h2,
.history-card h3 {
  margin: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.secondary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.mode-breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  text-align: center;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--color-gold);
  margin-bottom: 0.5rem;
}

.stat-label {
  color: var(--color-gold-muted);
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-card {
  display: grid;
  gap: 0.4rem;
  padding: 1.15rem 1.2rem;
  border-radius: var(--radius-lg);
  background: rgb(var(--color-gold-rgb) / 0.06);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.16);
}

.detail-card strong {
  color: var(--color-gold);
  font-size: 1.4rem;
}

.detail-label {
  color: rgb(var(--color-gold-rgb) / 0.72);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.mode-summary-card {
  display: grid;
  gap: 1rem;
  padding: 1.2rem;
  border-radius: var(--radius-lg);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
}

.mode-summary-header,
.mode-summary-footer {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.mode-summary-header {
  align-items: start;
}

.mode-summary-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.mode-summary-item {
  display: grid;
  gap: 0.28rem;
  padding: 0.9rem 1rem;
  border-radius: var(--radius-md);
  background: rgb(var(--color-gold-rgb) / 0.06);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.14);
}

.mode-summary-item span {
  color: rgb(var(--color-gold-rgb) / 0.72);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.mode-summary-item strong {
  color: var(--color-gold);
  font-size: 1.2rem;
}

.mode-summary-footer {
  padding-top: 0.35rem;
  border-top: 1px solid rgb(var(--color-gold-rgb) / 0.14);
}

.mode-summary-medals {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: 0.75rem;
  color: rgb(var(--color-gold-rgb) / 0.72);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.tier-section {
  margin-top: 3rem;
}

.tier-section h2 {
  color: var(--color-gold);
  font-size: 1.8rem;
  margin: 0 0 1.5rem;
  text-align: center;
}

.tier-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.tier-card {
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
  border-radius: var(--radius-lg);
  padding: 2rem 1.5rem;
  text-align: center;
}

.tier-count {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-gold);
  margin-bottom: 0.5rem;
}

.tier-label {
  color: var(--color-gold-muted);
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.history-section {
  margin-top: 3rem;
}

.history-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.history-header p,
.history-day,
.mode-card p {
  margin: 0;
}

.history-header p,
.history-day,
.mode-card p {
  color: rgb(var(--color-gold-rgb) / 0.78);
}

.history-list {
  display: grid;
  gap: 1rem;
}

.history-card {
  display: grid;
  gap: 1rem;
  padding: 1.2rem;
  border-radius: var(--radius-lg);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
}

.history-top {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.history-modes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.9rem;
}

.mode-card {
  display: grid;
  gap: 0.45rem;
  padding: 0.95rem 1rem;
  border-radius: var(--radius-md);
  background: rgb(var(--color-gold-rgb) / 0.06);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.16);
}

.mode-head {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: center;
}

.mode-head strong,
.history-card h3 {
  color: var(--color-gold);
}

.mode-badge {
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.08);
  color: rgb(var(--color-gold-rgb) / 0.78);
  font-size: 0.78rem;
  font-weight: 700;
}

.mode-badge--solved {
  color: var(--color-active);
  background: rgb(var(--color-active-rgb) / 0.12);
  border: 1px solid rgb(var(--color-active-rgb) / 0.24);
}

.mode-badge--gold {
  color: var(--color-gold-bright);
  background: rgb(var(--color-gold-rgb) / 0.16);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.3);
}

.mode-badge--silver {
  color: rgb(226 232 240 / 0.94);
  background: rgb(226 232 240 / 0.12);
  border: 1px solid rgb(226 232 240 / 0.28);
}

.mode-badge--bronze {
  color: rgb(233 179 120 / 0.94);
  background: rgb(205 127 50 / 0.14);
  border: 1px solid rgb(205 127 50 / 0.3);
}

.history-footer {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.history-toggle {
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
  background: rgb(var(--color-gold-rgb) / 0.08);
  color: rgb(var(--color-gold-rgb) / 0.84);
  border-radius: var(--radius-full);
  padding: 0.55rem 0.95rem;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.history-toggle:hover {
  transform: translateY(-1px);
  background: rgb(var(--color-gold-rgb) / 0.12);
}

@media (max-width: 768px) {
  .shell {
    padding: 0.9rem;
  }

  .page-header h1 {
    font-size: 2rem;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .compare-columns,
  .secondary-grid,
  .history-modes,
  .history-header,
  .compare-header--featured,
  .mode-summary-header,
  .mode-summary-footer,
  .action-header,
  .action-footer--split {
    grid-template-columns: 1fr;
    display: grid;
  }

  .mode-summary-stats {
    grid-template-columns: 1fr;
  }

  .mode-summary-medals {
    justify-content: start;
  }

  .mode-toggle {
    justify-content: start;
  }
}
</style>
