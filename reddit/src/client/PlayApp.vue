<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import GameBoard from '#game/app/components/GameBoard.vue';
import { muted, playSound, preloadSounds } from './sounds';
import HowToPlay from './HowToPlay.vue';
import { buildInitialTileStates } from '#game/app/utils/boardUtils';
import { UI_COPY } from '#game/app/content/uiCopy';
import { HINTS_PER_ROAD_MODE } from '#game/lib/gameConstants';
import { calcMedalForAttempt } from '#game/lib/gameTiers';
import { guideHighlightTiles, hintRevealsNewTile } from '#game/shared/utils/hints';
import type { HintResult } from '#game/shared/types/game';
import type { Ballot, CommunityPick, Medal, PlayerRun, PublicRoad, ReminderState, RoadMode, Standing } from '../shared/api';
import { current, isOverTarget, moveTo, replayRoute, startRun, undo, type RunState } from '../shared/run';
import { ApiError, fetchRoad, postFinish, postHint, postReminder, postStart } from './api';
import { showForm, showToast } from '@devvit/web/client';
import GameBoardHeader from '#game/app/components/GameBoardHeader.vue';
import ResultCard from './ResultCard.vue';
import { clearRoute, loadRoute, saveRoute } from './savedRoute';

/** Classic, or Expedition once Classic is solved, as on the website. */
const mode = ref<RoadMode>('classic');
const road = ref<PublicRoad | null>(null);
const error = ref<string | null>(null);
const run = ref<RunState | null>(null);

/** The server's record. Null for a logged-out player. */
const record = ref<PlayerRun | null>(null);
const loggedIn = ref(false);
/** Logged-out players: counted here only, never saved. */
const guestAttempts = ref(0);
const guestHints = ref(0);

/** Whether the try on the board has been counted (its first step is taken). */
const tryStarted = ref(false);
/** Whether the road was already solved before this try began. */
const solvedBefore = ref(false);
const guide = ref<number[]>([]);
const hintKind = ref<HintResult['kind'] | null>(null);
const hinting = ref(false);
const finishing = ref(false);
const saveProblem = ref(false);
/** A solve the server has not confirmed. Its route stays saved for a retry. */
const unsavedSolve = ref(false);
/** Rank and streak from the server, once the road is solved. */
const standing = ref<Standing | null>(null);
const showResult = ref(false);
/** This week's vote, and the vote that shaped today's road on a Sunday. */
const ballot = ref<Ballot | null>(null);
const community = ref<CommunityPick | null>(null);
/** A logged-out solve, kept here so the card can show it. */
const guestSolved = ref(false);

// Signals the website board listens to for its small animations.
const failSignal = ref(0);
const deniedSignal = ref(0);
const deniedTile = ref<number | null>(null);
const focusSignal = ref(0);
/** Streak reminders. Null for a logged-out player. */
const reminder = ref<ReminderState | null>(null);
const reminderBusy = ref(false);

/** Reminders go out at 20:00 UTC, four hours before the road changes. */
/** The reminder comes at 7 PM in the player's own time zone. */
const localOffset = () => -new Date().getTimezoneOffset();
const REMINDER_TOAST_ON = 'Reminders on. If your streak is at risk, you get one at 7 PM.';

/** Keep the reminder at 7 PM local after a summer-time change or travel. */
async function syncReminderOffset() {
  const state = reminder.value;
  if (!state?.on || state.offset === localOffset()) return;
  try {
    reminder.value = (await postReminder({ offset: localOffset() })).reminder;
  } catch (cause) {
    console.error('reminder time update failed', cause);
  }
}

/**
 * Asked once, in Reddit's own dialog, when the player closes the card after a
 * counted Classic solve that started or kept a streak.
 */
async function offerReminder() {
  const state = reminder.value;
  const streak = standing.value?.streak ?? 0;
  if (!state || state.asked || state.on || mode.value !== 'classic' || !standing.value?.counted || streak < 1) return;
  reminder.value = { ...state, asked: true };
  try {
    const answer = await showForm({
      title: 'Keep your road going?',
      description: `Your streak is ${streak} ${streak === 1 ? 'day' : 'days'}. If you have not walked the day's road by 7 PM, Reddit sends you one reminder. Turn it off at any time with the bell.`,
      acceptLabel: 'Remind me',
      cancelLabel: 'No thanks',
      fields: [],
    });
    if (answer.action === 'SUBMITTED') {
      reminder.value = (await postReminder({ on: true, offset: localOffset() })).reminder;
      showToast(REMINDER_TOAST_ON);
    } else {
      reminder.value = (await postReminder({ asked: true })).reminder;
    }
  } catch (cause) {
    console.error('reminder question failed', cause);
  }
}

/** The bell: turn reminders on or off. */
async function toggleReminder() {
  if (!reminder.value || reminderBusy.value) return;
  reminderBusy.value = true;
  const on = !reminder.value.on;
  try {
    reminder.value = (await postReminder(on ? { on, offset: localOffset() } : { on })).reminder;
    showToast(on ? REMINDER_TOAST_ON : 'Reminders off.');
  } catch (cause) {
    console.error('reminder toggle failed', cause);
    showToast('Could not change reminders. Try again.');
  } finally {
    reminderBusy.value = false;
  }
}

function closeResult() {
  showResult.value = false;
  void focusPlay();
  void offerReminder();
}

const scorePulse = ref<{ type: 'toll' | 'bonus'; key: number } | null>(null);

// The guide opens by itself once per device, on a first visit to an unsolved
// road. The ? button opens it again.
// Expedition has its own short guide for toll and bonus lanes.
const guideKey = (forMode: RoadMode) => (forMode === 'classic' ? 'goldroad:guide-seen' : `goldroad:guide-seen:${forMode}`);
const showGuide = ref(false);
function guideSeen(): boolean {
  try {
    return localStorage.getItem(guideKey(mode.value)) === '1';
  } catch {
    return true;
  }
}
function closeGuide() {
  showGuide.value = false;
  try {
    localStorage.setItem(guideKey(mode.value), '1');
  } catch {
    // Storage can be blocked. The guide then shows again next visit.
  }
  void focusPlay();
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  preloadSounds();
  await load('classic');
  showResult.value = hasResult.value;
  showGuide.value = !!road.value && !showResult.value && !guideSeen();
});

async function load(next: RoadMode) {
  try {
    const response = await fetchRoad(next);
    road.value = response.road;
    record.value = response.run;
    loggedIn.value = response.run !== null;
    solvedBefore.value = !!response.run?.solved;
    guide.value = response.run?.guidePath ?? [];
    standing.value = response.standing;
    ballot.value = response.ballot;
    community.value = response.community;
    reminder.value = response.reminder;
    void syncReminderOffset();
    otherResult.value = response.other
      ? { mode: next === 'classic' ? 'expedition' : 'classic', ...response.other }
      : null;
    guestAttempts.value = 0;
    guestHints.value = 0;
    guestSolved.value = false;
    tryStarted.value = false;
    unsavedSolve.value = false;
    run.value = resumeOrStart(response.road);
    // A solve that did not reach the server before a reload: send it now.
    if (run.value.outcome === 'solved') void finish();
    focusPlay();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
}

/** One mode's play state, kept while the other mode is on the board. */
type ModeState = {
  road: PublicRoad;
  record: PlayerRun | null;
  run: RunState;
  tryStarted: boolean;
  solvedBefore: boolean;
  guide: number[];
  standing: Standing | null;
  guestAttempts: number;
  guestHints: number;
  guestSolved: boolean;
};
const kept: Partial<Record<RoadMode, ModeState>> = {};
/** The server's word on the mode not on the board, for its tab tick. */
const otherResult = ref<{ mode: RoadMode; solved: boolean; medal: Medal | null } | null>(null);

function keep(): ModeState | null {
  if (!road.value || !run.value) return null;
  return {
    road: road.value,
    record: record.value,
    run: run.value,
    tryStarted: tryStarted.value,
    solvedBefore: solvedBefore.value,
    guide: guide.value,
    standing: standing.value,
    guestAttempts: guestAttempts.value,
    guestHints: guestHints.value,
    guestSolved: guestSolved.value,
  };
}

/** Solved state and medal of a mode, on the board or kept. */
function modeResult(forMode: RoadMode): { solved: boolean; medal: Medal | null } {
  if (forMode === mode.value) return { solved: hasResult.value, medal: medal.value };
  const state = kept[forMode];
  if (!state) {
    const other = otherResult.value;
    return other?.mode === forMode ? { solved: other.solved, medal: other.medal } : { solved: false, medal: null };
  }
  if (state.record) return { solved: state.record.solved, medal: state.record.medal ?? null };
  return { solved: state.guestSolved, medal: state.guestSolved ? calcMedalForAttempt(state.guestAttempts, true) : null };
}
const classicResult = computed(() => modeResult('classic'));
const expeditionResult = computed(() => modeResult('expedition'));

async function selectMode(next: RoadMode) {
  if (next === mode.value || finishing.value || switching.value || unsavedSolve.value) return;
  if (next === 'expedition' && !classicResult.value.solved) return;
  const current = keep();
  if (current) kept[mode.value] = current;
  showResult.value = false;
  hintKind.value = null;
  saveProblem.value = false;
  mode.value = next;
  const restore = kept[next];
  if (restore) {
    road.value = restore.road;
    record.value = restore.record;
    run.value = restore.run;
    tryStarted.value = restore.tryStarted;
    solvedBefore.value = restore.solvedBefore;
    guide.value = restore.guide;
    standing.value = restore.standing;
    guestAttempts.value = restore.guestAttempts;
    guestHints.value = restore.guestHints;
    guestSolved.value = restore.guestSolved;
    focusPlay();
  } else {
    switching.value = true;
    await load(next);
    switching.value = false;
  }
  showGuide.value = !hasResult.value && !guideSeen();
}
const switching = ref(false);

/** From the Classic result card: open Expedition. */
function playExpedition() {
  showResult.value = false;
  void selectMode('expedition');
}

function onScoringMove(payload: { type: 'toll' | 'bonus' }) {
  scorePulse.value = { type: payload.type, key: (scorePulse.value?.key ?? 0) + 1 };
}

// The board takes the height the header and the footer leave. Measure them,
// because their text wraps differently on each screen.
const playEl = ref<HTMLElement | null>(null);
const headerEl = ref<HTMLElement | null>(null);
const footerEl = ref<HTMLElement | null>(null);
// Expedition also puts its toll and bonus line inside the board area.
const infoEl = () => playEl.value?.querySelector<HTMLElement>('.board-info-slot') ?? null;
/** Height the board stage adds around its tiles: the info line and its gaps. */
function infoHeight(): number {
  const stage = playEl.value?.querySelector<HTMLElement>('.board-stage');
  const wrapper = playEl.value?.querySelector<HTMLElement>('.board-wrapper');
  return stage && wrapper ? stage.offsetHeight - wrapper.offsetHeight : 0;
}
const chrome = new ResizeObserver(() => {
  playEl.value?.style.setProperty('--header-h', `${headerEl.value?.offsetHeight ?? 90}px`);
  playEl.value?.style.setProperty('--footer-h', `${footerEl.value?.offsetHeight ?? 140}px`);
  playEl.value?.style.setProperty('--info-h', `${infoHeight()}px`);
});
watch(
  [headerEl, footerEl, () => road.value?.mode],
  async ([header, footer]) => {
    await nextTick();
    chrome.disconnect();
    if (header) chrome.observe(header);
    if (footer) chrome.observe(footer);
    const info = infoEl();
    if (info) chrome.observe(info);
    playEl.value?.style.setProperty('--info-h', `${infoHeight()}px`);
  },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  chrome.disconnect();
});

/**
 * The Play tap happens in the feed, so this frame opens without keyboard
 * focus and the arrow keys do nothing until a click. Take focus here. It goes
 * to the screen, not a tile, so no focus ring shows before the first move.
 */
async function focusPlay() {
  await nextTick();
  window.focus();
  playEl.value?.focus({ preventScroll: true });
}

function resumeOrStart(next: PublicRoad): RunState {
  const saved = loadRoute(next.day, next.mode);
  const resumed = saved ? replayRoute(next.board, next.target, saved.path) : null;
  if (saved && resumed && (!resumed.outcome || (resumed.outcome === 'solved' && !solvedBefore.value))) {
    tryStarted.value = saved.started;
    return resumed;
  }
  // The server has the solve, but its rank or streak may not be written: a
  // Save that failed after the solve was stored. Send it once more, quietly.
  // The server writes only what is missing. The route goes when that works.
  if (saved && resumed?.outcome === 'solved' && solvedBefore.value && loggedIn.value) {
    postFinish(next.mode, saved.path)
      .then(() => clearRoute(next.day, next.mode))
      .catch((cause) => console.error('solve repair failed', cause));
    return startRun(next.board);
  }
  clearRoute(next.day, next.mode);
  return startRun(next.board);
}

const tiles = computed(() => {
  if (!road.value || !run.value) return [];
  const here = current(run.value);
  const visited = new Set(run.value.path);
  const active = new Set(run.value.active);
  return buildInitialTileStates(road.value.board).map((row) =>
    row.map((tile) => ({
      ...tile,
      done: visited.has(tile.id),
      active: active.has(tile.id),
      tabIndex: tile.id === here ? 0 : -1,
    })),
  );
});
const activeSet = computed(() => new Set(run.value?.active ?? []));
const visitedSet = computed(() => new Set(run.value?.path ?? []));
const hintedTiles = computed(() =>
  road.value && run.value
    ? new Set(guideHighlightTiles(guide.value, run.value.path, road.value.board.start))
    : new Set<number>(),
);

/** Every coin on the board, as the web shows it. */
const totalCoins = computed(() => road.value?.board.tiles.reduce((sum, value) => sum + value, 0) ?? 0);
const toGo = computed(() => (road.value && run.value ? road.value.target - run.value.score : 0));
const overTarget = computed(() =>
  road.value && run.value ? isOverTarget(road.value.mode, road.value.target, run.value) : false,
);

const attempts = computed(() => (loggedIn.value ? record.value?.attempts ?? 0 : guestAttempts.value));
/** The try on the board: counted once its first step is taken. */
const tryNumber = computed(() => (tryStarted.value ? attempts.value : attempts.value + 1));
const hintsLeft = computed(() =>
  loggedIn.value ? record.value?.hintsLeft ?? 0 : HINTS_PER_ROAD_MODE - guestHints.value,
);

/**
 * The line under the controls. Before a solve it counts tries. After it, the
 * status line already says the try, so only a replay is named here.
 */
const tryLabel = computed(() => {
  if (solvedBefore.value) return 'Practice';
  if (hasResult.value) return null;
  return `Try ${tryNumber.value}`;
});

const medal = computed<Medal | null>(() => {
  if (loggedIn.value) return record.value?.medal ?? null;
  const solved = guestSolved.value || run.value?.outcome === 'solved';
  return solved ? calcMedalForAttempt(guestAttempts.value, true) : null;
});

/** The gap to the target, in words, so it never relies on colour alone. */
const HINT_COPY: Record<HintResult['kind'], string> = {
  'next-step': UI_COPY.runtime.hintNextStep,
  diverged: UI_COPY.runtime.hintDiverged,
  'already-solved': UI_COPY.runtime.hintAlreadySolved,
};

const status = computed(() => {
  const state = run.value;
  if (!state) return '';
  switch (state.outcome) {
    case 'solved': {
      if (solvedBefore.value) return UI_COPY.runtime.solvedAgain;
      if (finishing.value) return 'Solved. Checking…';
      if (unsavedSolve.value) return 'Solved, but not saved. Check the connection, then tap Save.';
      const tries = loggedIn.value ? record.value?.solvedAttempt ?? tryNumber.value : guestAttempts.value;
      const name = medal.value ? `${medal.value[0]!.toUpperCase()}${medal.value.slice(1)}` : 'Solved';
      return `${name} on try ${tries}.`;
    }
    case 'wrong-exit':
      return toGo.value > 0
        ? UI_COPY.runtime.destinationShort(toGo.value)
        : UI_COPY.runtime.destinationOver(-toGo.value);
    case 'dead-end':
      return UI_COPY.runtime.deadEnd;
  }
  if (saveProblem.value) return 'Could not reach the server. This try may not be saved.';
  if (hintKind.value) return HINT_COPY[hintKind.value];
  if (overTarget.value) {
    return toGo.value === 0
      ? 'On target, but not on the flag. This walk cannot finish.'
      : `${-toGo.value} over. This walk can no longer land on the target.`;
  }
  if (state.path.length === 1 && !tryStarted.value) {
    return 'Step onto a glowing tile. Reach the flag exactly on the target.';
  }
  return '';
});

const hasResult = computed(() => (loggedIn.value ? !!record.value?.solved : guestSolved.value));
const result = computed(() =>
  loggedIn.value
    ? {
        attempts: record.value?.solvedAttempt ?? 0,
        hints: record.value?.hintsUsed ?? 0,
        seconds: record.value?.solveSeconds ?? null,
      }
    : { attempts: guestAttempts.value, hints: guestHints.value, seconds: null },
);

/** Walking again is the next thing to do: the walk ended or cannot land. */
const walkAgainFirst = computed(() => ended.value || overTarget.value);
const walkAgainLabel = computed(() =>
  unsavedSolve.value ? 'Save' : hasResult.value ? 'Replay' : 'Try again',
);

const canUndo = computed(() => !!run.value?.undoAvailable && !run.value.outcome);
const ended = computed(() => !!run.value?.outcome);
const canHint = computed(() => !ended.value && !hinting.value && hintsLeft.value > 0 && !solvedBefore.value);

function persist() {
  if (!road.value || !run.value) return;
  saveRoute(road.value.day, road.value.mode, { path: run.value.path, started: tryStarted.value });
}

async function countTry() {
  if (!road.value) return;
  tryStarted.value = true;
  persist();
  if (!loggedIn.value) {
    if (!solvedBefore.value) guestAttempts.value += 1;
    return;
  }
  const forMode = road.value.mode;
  try {
    const started = (await postStart(forMode)).run;
    if (mode.value === forMode) record.value = started;
  } catch (cause) {
    console.error('start failed', cause);
    saveProblem.value = true;
  }
}

async function finish() {
  if (!road.value || !run.value || finishing.value) return;
  const { mode: forMode, day } = road.value;
  const solved = run.value.outcome === 'solved' && !solvedBefore.value;
  // Keep a solve until the server confirms it, so a lost request can be sent
  // again, also after a reload. Other ends of a walk count nothing new.
  if (solved) persist();
  else clearRoute(day, forMode);
  finishing.value = true;
  try {
    const result = await postFinish(forMode, run.value.path);
    clearRoute(day, forMode);
    unsavedSolve.value = false;
    if (result.run) record.value = result.run;
    if (result.outcome === 'solved' && !solvedBefore.value) {
      standing.value = result.standing;
      if (!loggedIn.value) guestSolved.value = true;
      showResult.value = true;
    }
  } catch (cause) {
    console.error('finish failed', cause);
    if (solved) unsavedSolve.value = true;
    else saveProblem.value = true;
  } finally {
    finishing.value = false;
  }
}

function select(tile: number) {
  if (!road.value || !run.value || finishing.value) return;
  const result = moveTo(road.value.board, road.value.target, run.value, tile);
  if (result.kind === 'denied') {
    deniedTile.value = tile;
    deniedSignal.value += 1;
    playSound('deny');
    return;
  }
  run.value = result.state;
  focusSignal.value += 1;
  hintKind.value = null;
  if (result.kind === 'moved' && !tryStarted.value) void countTry();
  const outcome = result.state.outcome;
  playSound(result.kind === 'undo' ? 'undo' : outcome === 'solved' ? 'solve' : outcome ? 'dead-end' : 'move');
  if (outcome) {
    if (outcome !== 'solved') failSignal.value += 1;
    void finish();
  } else {
    persist();
  }
}

function takeBack() {
  if (!road.value || !run.value) return;
  const back = undo(road.value.board, run.value);
  if (back) {
    run.value = back;
    focusSignal.value += 1;
    playSound('undo');
    persist();
  }
}

function tryAgain() {
  if (!road.value || !run.value || finishing.value) return;
  if (run.value.outcome === 'solved') solvedBefore.value = true;
  run.value = startRun(road.value.board);
  tryStarted.value = false;
  hintKind.value = null;
  saveProblem.value = false;
  unsavedSolve.value = false;
  clearRoute(road.value.day, road.value.mode);
  focusSignal.value += 1;
}

async function askHint() {
  if (!road.value || !run.value || !canHint.value) return;
  hinting.value = true;
  const path = [...run.value.path];
  try {
    const response = await postHint(road.value.mode, path, guide.value);
    // The player may have moved while the hint was on its way.
    if (!run.value || run.value.path.length !== path.length || road.value?.mode !== mode.value) return;
    if (response.run) {
      record.value = response.run;
      guide.value = response.run.guidePath;
    } else if (hintRevealsNewTile(guide.value, response.hint.guidePath)) {
      guestHints.value += 1;
      guide.value = response.hint.guidePath;
    }
    hintKind.value = response.hint.kind;
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 429 && record.value) {
      record.value = { ...record.value, hintsLeft: 0 };
    } else {
      console.error('hint failed', cause);
    }
  } finally {
    hinting.value = false;
  }
}

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0], w: [-1, 0],
  ArrowDown: [1, 0], s: [1, 0],
  ArrowLeft: [0, -1], a: [0, -1],
  ArrowRight: [0, 1], d: [0, 1],
};

function onKeydown(event: KeyboardEvent) {
  if (!road.value || !run.value || event.metaKey || event.ctrlKey || event.altKey) return;
  // A sheet is open over the board. Keys belong to it.
  if (showGuide.value || (showResult.value && hasResult.value)) return;
  if (event.key === 'Backspace') {
    event.preventDefault();
    takeBack();
    return;
  }
  const step = ARROWS[event.key];
  if (!step) return;
  event.preventDefault();
  const { cols, rows } = road.value.board;
  const here = current(run.value);
  const row = Math.floor(here / cols) + step[0];
  const col = (here % cols) + step[1];
  if (row < 0 || row >= rows || col < 0 || col >= cols) return;
  select(row * cols + col);
}
</script>

<template>
  <main ref="playEl" class="play" tabindex="-1">
    <p v-if="error" class="notice" role="alert">Could not load the road. {{ error }}</p>
    <p v-else-if="!road || !run" class="notice">{{ UI_COPY.runtime.loadingGame }}</p>
    <template v-else>
      <div class="topbar">
      <button type="button" class="corner corner--left" aria-label="How to play" @click="showGuide = true">?</button>
      <h1 class="title">GoldRoad <span class="road-no">#{{ road.roadNo }}</span></h1>
      <div class="corner-group">
      <button
        v-if="reminder"
        type="button"
        class="corner bell"
        :aria-label="reminder.on ? 'Streak reminders on. Turn off' : 'Streak reminders off. Turn on'"
        :aria-pressed="reminder.on"
        :title="reminder.on ? 'Streak reminders on' : 'Streak reminders off'"
        :disabled="reminderBusy"
        @click="toggleReminder"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 20.5a2 2 0 0 0 4 0"
            :fill="reminder.on ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
          <path v-if="!reminder.on" d="M4 4l16 16" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
        </svg>
      </button>
      <button
        type="button"
        class="corner mute"
        :aria-label="muted ? 'Unmute sounds' : 'Mute sounds'"
        :aria-pressed="muted"
        @click="muted = !muted"
      >
        <!-- The website's speaker icons (app/layouts/default.vue). -->
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 9.5v5h3.8L13 19V5L7.8 9.5H4Z"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.4"
          />
          <path
            v-if="!muted"
            d="M16 9a4.5 4.5 0 0 1 0 6M18.4 6.6a8 8 0 0 1 0 10.8"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="2.4"
          />
          <path v-else d="m17 9 4 4m0-4-4 4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.4" />
        </svg>
      </button>
      </div>
      </div>

      <header ref="headerEl" class="header">
        <p v-if="community" class="community">Community road · {{ community.label }}</p>
        <GameBoardHeader
          :selected-mode="mode"
          has-expedition
          :is-expedition-unlocked="classicResult.solved"
          :classic-solved="classicResult.solved"
          :classic-medal="classicResult.medal"
          :expedition-solved="expeditionResult.solved"
          :expedition-medal="expeditionResult.medal"
          :score="run.score"
          :max-score="road.target"
          :total-coins="totalCoins"
          :pulse="scorePulse"
          :over-target="overTarget"
          :mode-switch-locked="finishing || switching || unsavedSolve"
          @select-mode="selectMode"
        />
      </header>

      <section
        class="board-area"
        :style="{ '--cols': road.board.cols, '--rows': road.board.rows }"
      >
        <GameBoard
          :board="road.board"
          :puzzle-type="road.mode"
          :tiles="tiles"
          :current-tile-index="current(run)"
          :active-set="activeSet"
          :visited-set="visitedSet"
          :hinted-tiles="hintedTiles"
          :path-history="run.path"
          :guide-path="guide"
          :disabled="ended || finishing"
          :fail-signal="failSignal"
          :denied-move-signal="deniedSignal"
          :denied-tile-index="deniedTile"
          :focus-signal="focusSignal"
          @select="select"
          @scoring-move="onScoringMove"
        />
      </section>

      <footer ref="footerEl" class="footer">
        <p
          class="status"
          :class="{ 'status--solved': run.outcome === 'solved', 'status--hint': hintKind && !run.outcome }"
          aria-live="polite"
        >
          {{ status }}
        </p>
        <!-- The website board's order: hint, walk again, undo. The guide's icons.
             Only the walk-again button gets words, when it is the next step. -->
        <div class="controls">
          <button
            type="button"
            class="control control--hint"
            :disabled="!canHint"
            :aria-label="`Hint, ${hintsLeft} left`"
            :title="`Hint, ${hintsLeft} left`"
            @click="askHint"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 18h6m-5-3.5h4m-7.5-4.7a5.5 5.5 0 1 1 9.2 4.05c-.77.68-1.2 1.28-1.34 2.15H9.64c-.14-.87-.57-1.47-1.34-2.15A5.48 5.48 0 0 1 6.5 9.8Z"
              />
            </svg>
            <span v-if="!solvedBefore" class="count" aria-hidden="true">{{ hintsLeft }}</span>
          </button>
          <button
            type="button"
            class="control"
            :class="{ 'control--primary': walkAgainFirst }"
            :disabled="(run.path.length === 1 && !ended) || finishing"
            :aria-label="walkAgainLabel"
            :title="walkAgainLabel"
            @click="unsavedSolve ? finish() : tryAgain()"
          >
            <span v-if="walkAgainFirst">{{ walkAgainLabel }}</span>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.5 11.2a7.5 7.5 0 1 1 2.2 5.3M4.5 11.2V6.5m0 4.7h4.7" />
            </svg>
          </button>
          <button
            type="button"
            class="control"
            :disabled="!canUndo"
            aria-label="Undo last step"
            title="Undo last step"
            @click="takeBack"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.5 5.5v13M20 12H9m0 0 4.5-4.5M9 12l4.5 4.5" />
            </svg>
          </button>
        </div>
        <p class="try">
          {{ tryLabel }}
          <template v-if="hasResult">
            <template v-if="tryLabel">·</template> <button type="button" class="link" @click="showResult = true">Your result</button>
          </template>
        </p>
      </footer>

      <ResultCard
        v-if="showResult && hasResult"
        :road-no="road.roadNo"
        :board="road.board"
        :mode="road.mode"
        :commented="!!record?.commented"
        :medal="medal"
        :attempts="result.attempts"
        :hints="result.hints"
        :seconds="result.seconds"
        :standing="standing"
        :ballot="ballot"
        :community="community"
        :logged-in="loggedIn"
        @close="closeResult"
        :expedition-open="mode === 'classic' && !expeditionResult.solved"
        @expedition="playExpedition"
        @voted="ballot = $event"
        @commented="record && (record = { ...record, commented: true })"
      />

      <HowToPlay v-if="showGuide" :mode="mode" @close="closeGuide" />
    </template>
  </main>
</template>

<style scoped>
.play:focus {
  outline: none;
}

.play {
  position: relative;
  /* Fixed board furniture, as on the website. Tiles take what is left. */
  --tile-gap: 14px;
  --road-thickness: 12px;
  --board-margin: 12px;
  --board-dot-gap: 0.65rem;
  height: 100dvh;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* Header, board and footer sit as one group with even space around them,
     not pinned to the top and the bottom of the screen. */
  justify-content: space-evenly;
  container-type: size;
  /* The top bar is fixed, so the even spacing is for header, board, footer. */
  padding: var(--topbar-h) var(--board-margin) max(6px, env(safe-area-inset-bottom));
  --topbar-h: 44px;
  background: var(--gradient-bg-main);
  color: var(--color-gold);
}

.notice {
  margin: auto;
  color: var(--color-gold-muted);
}

.topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) 84px;
  align-items: center;
  height: var(--topbar-h);
  padding: 0 6px;
}

.corner {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 9px;
  border: 0;
  border-radius: var(--radius-full, 999px);
  background: transparent;
  color: var(--color-gold-muted);
  cursor: pointer;
}

.corner--left {
  padding: 0;
  font: inherit;
  font-size: 1.15rem;
  font-weight: 800;
}

.corner:hover,
.corner:focus-visible {
  background: rgb(var(--color-gold-rgb) / 0.12);
  color: var(--color-gold-bright);
}

.corner-group {
  display: flex;
  justify-content: end;
  gap: 4px;
}

.bell {
  padding: 10px;
}

.bell svg,
.mute svg {
  width: 100%;
  height: 100%;
}

.header {
  display: grid;
  gap: 4px;
  justify-items: center;
}

/* Reddit's frame is short, so the website's header parts sit tighter. */
.header :deep(.board-header-card) {
  gap: 6px;
  padding: 0;
}

.header :deep(.mode-option) {
  min-height: 28px;
  padding: 0.15rem 0.85rem;
  font-size: 0.9rem;
}

.header :deep(.metric-line) {
  font-size: 1rem;
}

/* The toll and bonus line, inside the website's board. */
.board-area :deep(.board-stage) {
  gap: 6px;
  padding: 0;
}

.board-area :deep(.board-info) {
  margin-top: 0;
  padding: 4px 1rem;
  column-gap: 1.1rem;
}

/* The lane icons set the box height, so the words can be as tall. */
.board-area :deep(.info-item) {
  font-size: 1rem;
  line-height: 1;
}

/* The website fades these words to 72%, which reads thin in a small frame. */
.board-area :deep(.info-label) {
  opacity: 1;
  font-weight: 500;
}

.board-area :deep(.info-value) {
  font-size: 1.15rem;
  line-height: 1;
}

.community {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-gold-muted);
}

.title {
  margin: 0;
  text-align: center;
  font-size: 1.375rem;
  line-height: 1.1;
  color: var(--color-gold-bright);
  letter-spacing: 0.04em;
}

.road-no {
  color: var(--color-gold-muted);
}

.board-area {
  flex: none;
  display: grid;
  place-items: center;
  /* Size the tiles from the space the header and the footer leave (their
     heights are measured), so the whole board always fits without scrolling. */
  --tile-size: clamp(
    26px,
    min(
      (100cqw - (var(--cols) - 1) * var(--tile-gap) - 16px) / var(--cols),
      (100cqh - var(--header-h, 70px) - var(--footer-h, 120px) - var(--info-h, 0px) - 24px -
        (var(--rows) - 1) * var(--tile-gap)) /
        var(--rows)
    ),
    68px
  );
}

/* Tile digits scale with the tile, in the bold UI face. */
.board-area :deep(.tile) {
  font-size: calc(var(--tile-size) * 0.5);
  font-weight: 800;
}

.footer {
  display: grid;
  gap: 6px;
}

.status {
  min-height: 2.6em;
  margin: 0;
  display: grid;
  place-items: center;
  text-align: center;
  font-size: 0.9rem;
  line-height: 1.3;
  color: var(--color-gold-bright);
}

.status--hint {
  color: var(--color-hint);
}

.status--solved {
  color: var(--color-gold-bright);
  font-weight: 700;
}

.controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
}

.try {
  margin: 0;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-gold-muted);
}

.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-gold);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.control {
  position: relative;
  display: inline-grid;
  place-items: center;
  min-width: 44px;
  height: 44px;
  padding: 0 10px;
  border: 1px solid rgb(var(--color-gold-rgb) / 0.5);
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.08);
  color: var(--color-gold);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.control svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.control--primary {
  padding: 0 22px;
}

/* The hints left, as a badge on the corner, as on the website. */
.count {
  position: absolute;
  top: -6px;
  right: -6px;
  display: grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  box-sizing: border-box;
  border-radius: var(--radius-full);
  background: var(--color-gold);
  color: var(--color-text-on-gold);
  font-size: 0.75rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.control:disabled {
  opacity: 0.4;
  cursor: default;
}

.control--primary {
  border-color: transparent;
  background: var(--gradient-button-primary);
  color: var(--color-text-on-gold);
}
</style>
