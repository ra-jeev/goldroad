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
type ModeMarks = { classic: DayMark | null; expedition: DayMark | null };

type CalendarCell = {
  key: string;
  dayNum: number | null;
  gameNo: number | null;
  marks: ModeMarks;
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

/**
 * Per-mode completion marks: gold/silver/bronze from live history's attempt
 * counts, solved-green for no-medal solves and archive completions (which
 * store no attempt count). The two sources merge here and for solved/unlock
 * presentation only — never into stats (RP0-5).
 */
const marksByGameNo = computed(() => {
  const marks = new Map<number, ModeMarks>();
  const entry = (gameNo: number): ModeMarks => {
    const existing = marks.get(gameNo);
    if (existing) return existing;
    const fresh: ModeMarks = { classic: null, expedition: null };
    marks.set(gameNo, fresh);
    return fresh;
  };

  for (const day of localStats.recentDays.value) {
    (['classic', 'expedition'] as const).forEach((mode) => {
      const record = day.modes[mode];
      if (!record?.solved) return;
      entry(day.gameNo)[mode] =
        calcMedalForAttempt(record.attempts, record.solved) ?? 'solved';
    });
  }

  for (const [gameNoKey, completion] of Object.entries(
    localProgress.archiveCompletionByGame.value,
  )) {
    const gameNo = Number.parseInt(gameNoKey, 10);
    if (!Number.isInteger(gameNo)) continue;
    (['classic', 'expedition'] as const).forEach((mode) => {
      if (completion[mode] && !entry(gameNo)[mode]) {
        entry(gameNo)[mode] = 'solved';
      }
    });
  }

  return marks;
});

function describeModeMark(mode: string, mark: DayMark | null): string {
  if (!mark) return `${mode} not solved`;
  return mark === 'solved' ? `${mode} solved` : `${mode} solved, ${mark}`;
}

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
        marks: { classic: null, expedition: null },
        label: null,
      });
    }

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum += 1) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const game = gamesByDate.get(dateKey);
      const marks = game
        ? (marksByGameNo.value.get(game.gameNo) ?? {
            classic: null,
            expedition: null,
          })
        : { classic: null, expedition: null };

      cells.push({
        key: dateKey,
        dayNum,
        gameNo: game?.gameNo ?? null,
        marks,
        label: game
          ? `GoldRoad #${game.gameNo}, ${formatDate(game.playableAt)}. ${describeModeMark('Classic', marks.classic)}. ${describeModeMark('Expedition', marks.expedition)}.`
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
    const response = await gamesApi.getAnotherGame();
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
                :aria-label="cell.label ?? undefined"
                :title="cell.label ?? undefined"
              >
                <span class="day-num">{{ cell.dayNum }}</span>
                <!-- Fixed positions: Classic left, Expedition right -->
                <span class="day-marks" aria-hidden="true">
                  <span
                    class="day-mark"
                    :class="cell.marks.classic ? `day-mark--${cell.marks.classic}` : 'day-mark--open'"
                  />
                  <span
                    class="day-mark"
                    :class="cell.marks.expedition ? `day-mark--${cell.marks.expedition}` : 'day-mark--open'"
                  />
                </span>
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

        <div class="calendar-legend" aria-hidden="true">
          <span class="legend-item">
            <span class="day-marks day-marks--legend">
              <span class="day-mark day-mark--gold" />
              <span class="day-mark day-mark--open" />
            </span>
            Classic · Expedition
          </span>
          <span class="legend-item">
            <span class="day-mark day-mark--open legend-single" />
            not solved yet
          </span>
        </div>

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
  font-size: var(--font-size-caption);
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
  font-size: var(--font-size-caption);
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

/* Two fixed-position completion marks: Classic left, Expedition right. */
.day-marks {
  position: absolute;
  bottom: 12%;
  display: flex;
  gap: 0.22rem;
}

.day-mark {
  width: 0.32rem;
  height: 0.32rem;
  border-radius: var(--radius-circle);
}

.day-mark--open {
  border: 1px solid rgb(var(--color-gold-rgb) / 0.35);
  background: transparent;
}

.day-mark--solved {
  background: var(--color-solved);
}

.day-mark--gold {
  background: var(--color-gold-bright);
}

.day-mark--silver {
  background: var(--color-medal-silver-bright);
}

.day-mark--bronze {
  background: var(--color-medal-bronze-bright);
}

.calendar-legend {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem 1.4rem;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--font-size-caption);
  font-weight: 700;
  color: rgb(var(--color-gold-rgb) / 0.6);
}

.day-marks--legend {
  position: static;
}

.legend-single {
  display: inline-block;
}

.calendar-hint {
  margin: 0;
  text-align: center;
  font-size: var(--font-size-caption);
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
  font-size: var(--font-size-caption);
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
