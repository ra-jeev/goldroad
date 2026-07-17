<script setup lang="ts">
import { RECENT_ARCHIVE_DAY_LIMIT } from '../../../shared/utils/archive';
import { calcMedalForAttempt } from '../../../lib/gameTiers';
import type { Medal } from '../../../shared/types/game';

const gamesApi = useGamesApi();
const localStats = useLocalPlayerStats();
const localProgress = useLocalGameProgress();

const games = ref<
  Array<Awaited<ReturnType<typeof gamesApi.getPastGames>>['games'][number]>
>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const randomBusy = ref(false);
const randomError = ref<string | null>(null);

type DayMark = Medal | 'solved';

type CalendarCell = {
  key: string;
  dayNum: number | null;
  gameNo: number | null;
  mark: DayMark | null;
  label: string | null;
};

type CalendarMonth = {
  key: string;
  title: string;
  cells: CalendarCell[];
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function utcDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

/** Best personal result per road day: gold > silver > bronze > plain solved. */
const marksByGameNo = computed(() => {
  const rank: Record<DayMark, number> = { gold: 3, silver: 2, bronze: 1, solved: 0 };
  const marks = new Map<number, DayMark>();

  for (const day of localStats.recentDays.value) {
    (['classic', 'expedition'] as const).forEach((mode) => {
      const record = day.modes[mode];
      if (!record?.solved) return;
      const medal = calcMedalForAttempt(record.attempts, record.solved);
      const mark: DayMark = medal ?? 'solved';
      const existing = marks.get(day.gameNo);
      if (!existing || rank[mark] > rank[existing]) {
        marks.set(day.gameNo, mark);
      }
    });
  }

  return marks;
});

const calendarMonths = computed<CalendarMonth[]>(() => {
  if (!games.value.length) return [];

  const gamesByDate = new Map(
    games.value.map((game) => [utcDateKey(game.playableAt), game]),
  );

  // The archive window spans at most a few weeks, so the involved months
  // are simply every month between the oldest and newest playable day.
  const dates = [...gamesByDate.keys()].sort();
  const first = new Date(`${dates[0]}T00:00:00.000Z`);
  const last = new Date(`${dates[dates.length - 1]}T00:00:00.000Z`);

  const months: CalendarMonth[] = [];
  const cursor = new Date(
    Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1),
  );
  const floor = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1);

  while (cursor.getTime() >= floor) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const leadingBlanks = new Date(Date.UTC(year, month, 1)).getUTCDay();

    const cells: CalendarCell[] = [];
    for (let blank = 0; blank < leadingBlanks; blank += 1) {
      cells.push({
        key: `blank-${year}-${month}-${blank}`,
        dayNum: null,
        gameNo: null,
        mark: null,
        label: null,
      });
    }

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum += 1) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const game = gamesByDate.get(dateKey);
      const mark = game ? (marksByGameNo.value.get(game.gameNo) ?? null) : null;

      cells.push({
        key: dateKey,
        dayNum,
        gameNo: game?.gameNo ?? null,
        mark,
        label: game
          ? `Road ${game.gameNo} — ${formatDate(game.playableAt)}${mark ? `, solved${mark === 'solved' ? '' : ` · ${mark}`}` : ''}`
          : null,
      });
    }

    months.push({
      key: `${year}-${month}`,
      title: new Intl.DateTimeFormat(undefined, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(cursor),
      cells,
    });

    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }

  return months;
});

/**
 * The deep-archive escape hatch (P1-3): only once roads exist beyond the
 * recent-archive window. The newest archived road is currentGameNo - 1.
 */
const showRandomRoad = computed(() => {
  const newest = games.value[0]?.gameNo ?? 0;
  return newest + 1 > RECENT_ARCHIVE_DAY_LIMIT + 1;
});

async function playRandomOlderRoad() {
  if (randomBusy.value) return;
  randomBusy.value = true;
  randomError.value = null;

  try {
    const response = await gamesApi.getAnotherGame(
      localProgress.playerUUID.value ?? undefined,
    );
    await navigateTo(`/games/${response.gameNo}`);
  } catch {
    randomError.value = 'No older road is available right now.';
  } finally {
    randomBusy.value = false;
  }
}

onMounted(async () => {
  localProgress.load();
  localStats.load();

  try {
    const response = await gamesApi.getPastGames();
    games.value = response.games;
  } catch {
    error.value = 'Past roads are unavailable right now.';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="shell">
    <div class="container">
      <header class="page-header">
        <p class="eyebrow">Pick a day, walk its road</p>
        <h1>Past roads</h1>
      </header>

      <section v-if="loading" class="panel panel--state">
        <p>Gathering the archive…</p>
      </section>

      <section v-else-if="error" class="panel panel--state">
        <p>{{ error }}</p>
      </section>

      <section v-else-if="games.length === 0" class="panel panel--state">
        <h2>No past roads yet</h2>
        <p>Older roads appear here once the archive fills in.</p>
      </section>

      <template v-else>
        <section
          v-for="month in calendarMonths"
          :key="month.key"
          class="panel calendar"
        >
          <h2 class="calendar-title">{{ month.title }}</h2>

          <div class="calendar-grid calendar-grid--head" aria-hidden="true">
            <span
              v-for="(weekday, index) in WEEKDAYS"
              :key="`${month.key}-wd-${index}`"
              class="calendar-weekday"
            >
              {{ weekday }}
            </span>
          </div>

          <div class="calendar-grid">
            <template v-for="cell in month.cells" :key="cell.key">
              <NuxtLink
                v-if="cell.gameNo !== null"
                :to="`/games/${cell.gameNo}`"
                class="calendar-day calendar-day--playable"
                :class="cell.mark ? `calendar-day--${cell.mark}` : null"
                :aria-label="cell.label ?? undefined"
                :title="cell.label ?? undefined"
              >
                <span class="day-num">{{ cell.dayNum }}</span>
                <span v-if="cell.mark" class="day-mark" aria-hidden="true" />
              </NuxtLink>
              <span
                v-else
                class="calendar-day"
                :class="{ 'calendar-day--blank': cell.dayNum === null }"
              >
                <span v-if="cell.dayNum !== null" class="day-num">
                  {{ cell.dayNum }}
                </span>
              </span>
            </template>
          </div>
        </section>

        <p class="calendar-hint">
          The latest {{ RECENT_ARCHIVE_DAY_LIMIT }} road days are open for
          replay, Classic and Expedition alike.
        </p>

        <section v-if="showRandomRoad" class="panel panel--random">
          <p class="random-lead">Feeling further back?</p>
          <button
            type="button"
            class="btn btn--ghost"
            :disabled="randomBusy"
            @click="playRandomOlderRoad"
          >
            {{ randomBusy ? 'Finding a road…' : 'Surprise me with an older road' }}
          </button>
          <p v-if="randomError" class="random-error">{{ randomError }}</p>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.shell {
  min-height: calc(100dvh - 60px);
  padding: clamp(0.9rem, 2.5vw, 1.4rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.container {
  width: 100%;
}

.container {
  max-width: 480px;
  margin: 0 auto;
  display: grid;
  gap: clamp(1rem, 2.5vw, 1.4rem);
}

.page-header {
  display: grid;
  gap: 0.25rem;
  text-align: center;
  justify-items: center;
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

.panel {
  border-radius: var(--radius-lg);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
  padding: clamp(1.1rem, 3vw, 1.4rem);
}

.panel--state {
  display: grid;
  gap: 0.4rem;
  justify-items: center;
  text-align: center;
  color: rgb(var(--color-gold-rgb) / 0.8);
}

.panel--state h2 {
  margin: 0;
  color: var(--color-gold-bright);
}

.panel--state p {
  margin: 0;
}

/* ── Calendar ─────────────────────────────────────────────── */
.calendar {
  display: grid;
  gap: 0.7rem;
}

.calendar-title {
  margin: 0;
  color: var(--color-gold-bright);
  font-size: 1.15rem;
  text-align: center;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.3rem;
}

.calendar-weekday {
  text-align: center;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: rgb(var(--color-gold-rgb) / 0.45);
}

.calendar-day {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-xs);
  color: rgb(var(--color-gold-rgb) / 0.3);
  font-size: 0.92rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-decoration: none;
}

.calendar-day--blank {
  visibility: hidden;
}

.calendar-day--playable {
  color: var(--color-gold-bright);
  background: rgb(var(--color-gold-rgb) / 0.1);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.24);
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.calendar-day--playable:hover {
  transform: translateY(-1px);
  background: rgb(var(--color-gold-rgb) / 0.18);
  border-color: rgb(var(--color-gold-rgb) / 0.4);
}

.calendar-day--playable:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.day-num {
  line-height: 1;
}

.day-mark {
  position: absolute;
  bottom: 15%;
  width: 0.34rem;
  height: 0.34rem;
  border-radius: var(--radius-circle);
  background: var(--color-active);
}

.calendar-day--gold .day-mark {
  background: var(--color-gold-bright);
}

.calendar-day--silver .day-mark {
  background: var(--color-medal-silver-bright);
}

.calendar-day--bronze .day-mark {
  background: var(--color-medal-bronze-bright);
}

.calendar-hint {
  margin: 0;
  text-align: center;
  font-size: 0.86rem;
  color: rgb(var(--color-gold-rgb) / 0.6);
}

/* ── Deep-archive random road ─────────────────────────────── */
.panel--random {
  display: grid;
  gap: 0.6rem;
  justify-items: center;
  text-align: center;
}

.random-lead {
  margin: 0;
  color: var(--color-gold-bright);
  font-weight: 800;
}

.random-error {
  margin: 0;
  font-size: 0.86rem;
  color: rgb(var(--color-gold-rgb) / 0.66);
}

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
    box-shadow var(--transition-fast);
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
</style>
