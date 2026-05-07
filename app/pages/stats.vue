<script setup lang="ts">
import { calcMedalForAttempt } from '../../lib/gameTiers';
import type { CommunityRoadStats, Medal } from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';

const localStats = useLocalPlayerStats();
const localProgress = useLocalGameProgress();
const statsApi = useStatsApi();
const summary = localStats.summary;
const recentDays = localStats.recentDays;
const communityOverview = ref<Awaited<
  ReturnType<typeof statsApi.getOverview>
> | null>(null);
const communityError = ref<string | null>(null);
const loading = ref(true);

type CurrentComparisonCard = {
  key: string;
  modeLabel: string;
  gameNo: number;
  localStatus: string;
  localDetail: string;
  globalHeadline: string;
  globalDetail: string;
  globalMedals: string;
  comparisonHeadline: string;
  comparisonDetail: string;
};

function getStoredPlayerUUID(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('goldroad-player-uuid');
}

function formatDay(day: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`));
}

function hintTotal(progress: { hintsUsed: number }): number {
  return progress.hintsUsed;
}

function toPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function formatMedal(medal: Medal | null): string {
  return medal ? UI_COPY.boardHeader.medals[medal] : 'Solved';
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
      detail: `Solved in ${progress.attempts} attempt${progress.attempts === 1 ? '' : 's'} · ${hints} hint${hints === 1 ? '' : 's'}`,
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
        'This road has not posted enough server-side run data to compare against yet.',
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

const currentComparisonCards = computed<CurrentComparisonCard[]>(() => {
  const current = communityOverview.value?.current;
  if (!current) return [];

  return (['classic', 'expedition'] as const)
    .map((mode) => current[mode])
    .filter((entry): entry is CommunityRoadStats => Boolean(entry))
    .map((entry) => {
      const local = describeLocalStatus(entry);
      const comparison = buildComparisonInsight(entry);
      return {
        key: `${entry.puzzleType}:${entry.gameNo}`,
        modeLabel: entry.puzzleType === 'classic' ? 'Classic' : 'Expedition',
        gameNo: entry.gameNo,
        localStatus: local.status,
        localDetail: local.detail,
        globalHeadline: `${entry.solveRate}% exact solve rate`,
        globalDetail: `${entry.plays} play${entry.plays === 1 ? '' : 's'} · ${entry.exactSolves} exact solve${entry.exactSolves === 1 ? '' : 's'}`,
        globalMedals: `${entry.gold} gold · ${entry.silver} silver · ${entry.bronze} bronze`,
        comparisonHeadline: comparison.headline,
        comparisonDetail: comparison.detail,
      };
    });
});

onMounted(async () => {
  const playerUUID = getStoredPlayerUUID();
  if (playerUUID) {
    localStats.load(playerUUID);
    localProgress.load(playerUUID);

    if (localProgress.state.value) {
      localStats.syncCurrentDay(
        playerUUID,
        localProgress.state.value.day,
        localProgress.state.value.games,
      );
    }
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
                These global counts come from server-side session stats for the
                current active roads.
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
                </section>
              </div>

              <div class="compare-insight">
                <strong>{{ card.comparisonHeadline }}</strong>
                <p>{{ card.comparisonDetail }}</p>
              </div>
            </article>
          </div>
        </section>

        <p v-if="communityError" class="community-error">
          {{ communityError }}
        </p>

        <section v-if="!summary.modeSessionsPlayed" class="empty-state">
          <h2>No local stats yet</h2>
          <p>
            Finish a road or use a hint and your personal history will start
            filling in below the global comparison.
          </p>
        </section>

        <template v-else>
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
              <div class="stat-label">Classic Streak</div>
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
              <span class="detail-label">Best Classic Streak</span>
              <strong>{{ summary.bestClassicStreak }}</strong>
            </article>

            <article class="detail-card">
              <span class="detail-label">Mode Sessions</span>
              <strong>{{ summary.modeSessionsPlayed }}</strong>
            </article>

            <article class="detail-card">
              <span class="detail-label">Avg Solve Attempt</span>
              <strong>{{ summary.averageSolvedAttempts }}</strong>
            </article>
          </div>

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
              <p>Each day tracks Classic and Expedition separately.</p>
            </div>

            <div class="history-list">
              <article
                v-for="entry in recentDays"
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
                        :class="{
                          'mode-badge--solved': entry.modes.classic.solved,
                        }"
                      >
                        {{ entry.modes.classic.solved ? 'Solved' : 'Tried' }}
                      </span>
                    </div>
                    <p>Attempts: {{ entry.modes.classic.attempts }}</p>
                    <p>Hints: {{ hintTotal(entry.modes.classic) }}</p>
                  </section>

                  <section v-if="entry.modes.expedition" class="mode-card">
                    <div class="mode-head">
                      <strong>Expedition</strong>
                      <span
                        class="mode-badge"
                        :class="{
                          'mode-badge--solved': entry.modes.expedition.solved,
                        }"
                      >
                        {{ entry.modes.expedition.solved ? 'Solved' : 'Tried' }}
                      </span>
                    </div>
                    <p>Attempts: {{ entry.modes.expedition.attempts }}</p>
                    <p>Hints: {{ hintTotal(entry.modes.expedition) }}</p>
                  </section>
                </div>
              </article>
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

.compare-section {
  margin-bottom: 2rem;
}

.compare-header {
  margin-bottom: 1rem;
}

.compare-header h2,
.compare-card h3 {
  margin: 0;
  color: var(--color-gold);
}

.compare-header p,
.community-error,
.compare-eyebrow,
.compare-block p {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.76);
}

.compare-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.compare-card {
  display: grid;
  gap: 1rem;
  padding: 1.2rem;
  border-radius: var(--radius-lg);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.2);
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
  .history-header {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
