import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useDocumentVisibility } from '@vueuse/core';
import { buildInitialTileStates } from '../utils/boardUtils';
import { getHintMessage } from '../utils/hintMessage';
import { restoreRoadRoute } from '../utils/restoreRoadRoute';
import {
  buildEdgeMap,
  getActiveNeighbors,
  getEdgeType,
  getNeighborId,
  parseTileIndex,
} from '#shared/utils/puzzleEngine';
import { calcMedalForAttempt } from '../../lib/gameTiers';
import { HINTS_PER_ROAD_MODE } from '../../lib/gameConstants';
import {
  computeHint,
  guideHighlightTiles,
  hintRevealsNewTile,
} from '#shared/utils/hints';
import {
  applyUndoLastStep,
  canUndoLastStep,
  isTextEntryEventTarget,
  isUndoTapTarget,
  nextUndoAvailable,
  shouldHandleUndoKey,
  shouldRestoreSolvedRest,
} from '../utils/undoLastStep';
import type {
  CurrentGamesResponse,
  Direction,
  Medal,
  OutcomeTier,
  PublicGame,
  PuzzleType,
} from '#shared/types/game';
import { UI_COPY } from '../content/uiCopy';
import {
  getRoadDayKeyFromPlayableAt,
  GOLDROAD_STORAGE_KEY,
  REPLAY_PROGRESS_STORAGE_KEY,
  type SavedRoute,
  type LocalProgressScope,
} from './useGoldroadLocalState';
import {
  useRoadResultShare,
  type ShareRoadResultResponse,
} from './useRoadResultShare';
import type { SessionEndRequest } from './useSessionApi';
import { isRetryableDeliveryError } from '../utils/failedSolveDelivery';

export type EntryType = 'live' | 'archive';

export type CelebrationTier = 'gold' | 'medal' | 'relief';

export type CelebrationVariant =
  | 'classic-solve'
  | 'day-complete'
  | 'replay-solve';

export type CelebrationModeResult = {
  puzzleType: PuzzleType;
  attempts: number;
  solved: boolean;
  medal: Medal | null;
  solveTimeMs: number | null;
  hintsUsed: number;
};

export type CelebrationState = {
  variant: CelebrationVariant;
  tier: CelebrationTier;
  gameNo: number;
  puzzleType: PuzzleType;
  medal: Medal | null;
  wouldHaveMedal: Medal | null;
  attemptNumber: number;
  solveTimeMs: number | null;
  hintsUsed: number;
  hasExpedition: boolean;
  classicResult: CelebrationModeResult | null;
  expeditionResult: CelebrationModeResult | null;
};

export function isDifferentGameIdentity(
  current: Pick<PublicGame, 'gameNo' | 'puzzleType'>,
  next: Pick<PublicGame, 'gameNo' | 'puzzleType'>,
): boolean {
  return (
    current.gameNo !== next.gameNo || current.puzzleType !== next.puzzleType
  );
}

/**
 * An archive solve writes exactly one durable fact locally (RP0-5): this
 * road+mode is complete. Starting, failing, or abandoning a run must never
 * write anything. Exported standalone so the solved-only gate is
 * unit-testable without the full gameplay composable (RP1-9).
 */
export function shouldRecordArchiveCompletion(
  entryType: EntryType,
  solved: boolean,
): boolean {
  return entryType !== 'live' && solved;
}

/**
 * Only live, tracked runs ever talk to the server (RP0-5) — archive play
 * (and any untracked replay of an already-solved board) never calls
 * session/end or session/hint. Exported standalone for unit testing.
 */
export function shouldCallSessionApi(
  entryType: EntryType,
  isUntrackedReplay: boolean,
  roadExpired = false,
): boolean {
  return entryType === 'live' && !isUntrackedReplay && !roadExpired;
}

export function shouldStartSessionApi(
  entryType: EntryType,
  isUntrackedReplay: boolean,
  roadExpired: boolean,
  alreadyStarted: boolean,
): boolean {
  return (
    !alreadyStarted &&
    shouldCallSessionApi(entryType, isUntrackedReplay, roadExpired)
  );
}

export function shouldSubmitSessionEnd(
  entryType: EntryType,
  isUntrackedReplay: boolean,
  endReason: 'solved' | 'wrong-exit' | 'dead-end' | 'retry',
): boolean {
  return (
    endReason === 'solved' &&
    shouldCallSessionApi(entryType, isUntrackedReplay)
  );
}

/**
 * The midnight contract (RP1-16): once the loaded road's own nextGameAt has
 * passed, the board stays exactly as it is, but retry, hints, mode switching,
 * and server analytics all stop. The open board can still be completed as
 * archive play.
 */
export function isRoadExpired(
  nextGameAt: string | null | undefined,
  nowMs: number,
): boolean {
  if (!nextGameAt) return false;
  const parsed = Date.parse(nextGameAt);
  return !Number.isNaN(parsed) && nowMs >= parsed;
}

/**
 * Whether a live Classic run can no longer reach its target.
 *
 * Classic tiles only ever add, so once the score touches the target without
 * being at the exit, no remaining route lands on it — the road is already
 * lost, often twenty tiles before the player finds out. Expedition is
 * excluded on purpose: its tolls subtract, so being over target there is
 * recoverable rather than fatal.
 */
export function isClassicOverTarget(input: {
  puzzleType: PuzzleType;
  score: number;
  target: number;
  terminal: boolean;
}): boolean {
  return (
    input.puzzleType === 'classic' &&
    !input.terminal &&
    input.score >= input.target
  );
}

/**
 * Archive solves retain their counterfactual tier for playful presentation,
 * but never award a medal. Kept pure so the finalizeRun contract is testable.
 */
export function resolveRunMedals(
  entryType: EntryType,
  isUntrackedReplay: boolean,
  attempts: number,
  solved: boolean,
): { medal: Medal | null; wouldHaveMedal: Medal | null } {
  const wouldHaveMedal =
    entryType === 'live' ? null : calcMedalForAttempt(attempts, solved);
  const medal =
    entryType !== 'live' || isUntrackedReplay
      ? null
      : calcMedalForAttempt(attempts, solved);

  return { medal, wouldHaveMedal };
}

function celebrationTierForMedal(medal: Medal | null): CelebrationTier {
  if (medal === 'gold') return 'gold';
  if (medal) return 'medal';
  return 'relief';
}

type SetupGameOptions = {
  restoreLocalProgress?: boolean;
  syncContext?: boolean;
};

type ApplyRoadDayOptions = {
  preferredMode?: PuzzleType | null;
  restoreLocalProgress?: boolean;
};

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return '00000000-0000-4000-8000-000000000000';
}

export function useRoadDayGameplay(options: { entryType: EntryType }) {
  const sessionApi = useSessionApi();
  const failedSolveDelivery = useFailedSolveDelivery();
  const localProgress = useLocalGameProgress();
  const resultShare = useRoadResultShare();

  const availableGames = ref<CurrentGamesResponse>({
    classic: null,
    expedition: null,
  });
  const selectedMode = ref<PuzzleType | null>(null);

  const game = ref<PublicGame | null>(null);
  const tiles = ref<ReturnType<typeof buildInitialTileStates>>([]);
  const currentTileIndex = ref<number | null>(null);
  // Bumps only after a player move. Board setup must not focus the start coin.
  const tileFocusSignal = ref(0);
  const progressSyncSignal = ref(0);
  const visited = ref<Set<number>>(new Set());
  const activeSet = ref<Set<number>>(new Set());
  const pathHistory = ref<number[]>([]);
  const score = ref(0);
  const moves = ref(0);
  const hintedTiles = ref<Set<number>>(new Set());
  const hintKind = ref<ReturnType<typeof computeHint>['kind'] | null>(null);
  const hintMessage = computed(() =>
    hintKind.value ? getHintMessage(hintKind.value, hintedTiles.value.size) : null,
  );
  const guidePath = ref<number[]>([]);
  // Guards the live hint round trip. Without it a second tap while the first
  // request is in flight spends a second hint token on the same intent.
  const hintPending = ref(false);
  const ended = ref(false);
  const loading = ref(false);
  const submitting = ref(false);
  const status = ref<string>(UI_COPY.runtime.loadingGame);
  const lastTier = ref<OutcomeTier | null>(null);
  const lastMedal = ref<Medal | null>(null);
  const lastSolved = ref(false);
  const solvedAfterRollover = ref(false);
  const attemptNumber = ref(1);
  const expeditionJustUnlocked = ref(false);
  const sessionId = ref('');
  const hintsUsed = ref(0);
  const trackingDisabled = ref(false);
  const activeSolveTimeMs = ref(0);
  const solveTimerStartedAtMs = ref<number | null>(null);
  const solveTimerCanResume = ref(false);
  const celebration = ref<CelebrationState | null>(null);
  const successfulMoveSignal = ref(0);
  const deniedMoveSignal = ref(0);
  const deniedTileIndex = ref<number | null>(null);
  const deadEndSignal = ref(0);
  const undoSignal = ref(0);
  const hintNudgeSignal = ref(0);
  // 0 = not nudged, 1 = first nudge spent, 2 = both spent. Per road+mode.
  const hintNudgeLevel = ref(0);
  const solveCelebrationSignal = ref(0);
  const solveAcknowledgement = ref<string | null>(null);
  const startedRoadModes = new Set<string>();
  // One take-back per step. A successful non-ending move earns it; undo
  // spends it until the player moves again.
  const undoAvailable = ref(false);
  let savedRoute: SavedRoute | null = null;
  const solvedRestMedal = ref<Medal | null>(null);
  const canUndo = computed(() =>
    canUndoLastStep({
      ended: ended.value,
      undoAvailable: undoAvailable.value,
    }),
  );
  // Read off live state rather than written at each move: an undo that brings
  // the score back under the target has to clear it too.
  const overTarget = computed(() =>
    game.value
      ? isClassicOverTarget({
          puzzleType: game.value.puzzleType,
          score: score.value,
          target: game.value.maxScore,
          terminal: ended.value,
        })
      : false,
  );

  const documentVisibility = useDocumentVisibility();
  const { isBoardOverlayOpen } = useBoardOverlayGate();
  const playerUUID = localProgress.playerUUID;
  const progressScope: LocalProgressScope =
    options.entryType === 'live' ? 'live' : 'replay';
  const maxScore = computed(() => game.value?.maxScore ?? 0);
  const totalCoins = computed(() => game.value?.totalCoins ?? 0);
  const roadHeading = computed(() =>
    game.value ? `Day #${game.value.gameNo}` : 'Day …',
  );
  /**
   * Has the loaded road day's given mode ever been solved?
   * Live pages read live progress; archive pages merge live history with
   * the dedicated archive-completion map (RP0-5) — that merge exists only
   * for solved/unlock presentation, never for stats.
   */
  function isModeCompleted(puzzleType: PuzzleType): boolean {
    const target =
      puzzleType === 'classic'
        ? availableGames.value.classic
        : availableGames.value.expedition;
    if (!target) return false;

    if (options.entryType === 'archive') {
      return localProgress.isRoadModeSolved(target.gameNo, puzzleType);
    }

    return localProgress.getGameProgress(target.gameNo, puzzleType).solved;
  }

  const isExpeditionUnlocked = computed(() => {
    if (!availableGames.value.classic) {
      // Defensive: a road day without a Classic half cannot gate.
      return options.entryType === 'archive';
    }

    // Expedition is always gated behind that road's Classic solve — live
    // or archive alike (RP0-5 superseded the frictionless-archive model).
    return isModeCompleted('classic');
  });
  const classicSolvedToday = computed(() => isModeCompleted('classic'));
  const classicMedalToday = computed<Medal | null>(() => {
    const classic = availableGames.value.classic;
    if (!classic) return null;
    if (options.entryType === 'archive') {
      // Archive completions store no attempt count, so no medal to show.
      return null;
    }
    const progress = localProgress.getGameProgress(classic.gameNo, 'classic');
    return calcMedalForAttempt(Math.max(progress.attempts, 1), progress.solved);
  });
  const expeditionSolvedToday = computed(() => isModeCompleted('expedition'));
  const expeditionMedalToday = computed<Medal | null>(() => {
    const expedition = availableGames.value.expedition;
    if (!expedition) return null;
    if (options.entryType === 'archive') {
      return null;
    }
    const progress = localProgress.getGameProgress(
      expedition.gameNo,
      'expedition',
    );
    return calcMedalForAttempt(Math.max(progress.attempts, 1), progress.solved);
  });

  watch(selectedMode, (mode) => {
    if (typeof window === 'undefined') return;
    document.body.classList.remove('mode-classic', 'mode-expedition');
    if (mode) {
      document.body.classList.add(`mode-${mode}`);
    }
  });

  watch(documentVisibility, (visibility) => {
    if (visibility === 'hidden') {
      pauseSolveTimerForVisibility();
      return;
    }

    if (visibility === 'visible') handleBoardFocus();
  });

  watch(isBoardOverlayOpen, (open) => {
    if (open) {
      pauseSolveTimerForVisibility();
      return;
    }

    if (documentVisibility.value === 'visible') {
      resumeSolveTimer();
    }
  });

  function clearGameState() {
    game.value = null;
    tiles.value = [];
    currentTileIndex.value = null;
    visited.value = new Set();
    activeSet.value = new Set();
    pathHistory.value = [];
    score.value = 0;
    moves.value = 0;
    hintKind.value = null;
    hintedTiles.value = new Set();
    guidePath.value = [];
    ended.value = false;
    submitting.value = false;
    status.value = UI_COPY.runtime.loadingGame;
    lastTier.value = null;
    lastMedal.value = null;
    lastSolved.value = false;
    solvedAfterRollover.value = false;
    attemptNumber.value = 1;
    expeditionJustUnlocked.value = false;
    sessionId.value = '';
    hintsUsed.value = 0;
    trackingDisabled.value = false;
    activeSolveTimeMs.value = 0;
    solveTimerStartedAtMs.value = null;
    hintNudgeLevel.value = 0;
    solveTimerCanResume.value = false;
    celebration.value = null;
    solveAcknowledgement.value = null;
    undoAvailable.value = false;
    savedRoute = null;
    solvedRestMedal.value = null;
  }

  function clearRoadDay() {
    availableGames.value = {
      classic: null,
      expedition: null,
    };
    selectedMode.value = null;
    clearGameState();
  }

  function updateTileStates() {
    if (!game.value || currentTileIndex.value === null) return;

    const current = currentTileIndex.value;
    for (const row of tiles.value) {
      for (const tile of row) {
        tile.done = visited.value.has(tile.id);
        tile.active = activeSet.value.has(tile.id);
        tile.focus = tile.id === current;
        tile.tabIndex = tile.id === current ? 0 : -1;
      }
    }
  }

  function syncGuideHighlight() {
    if (!game.value) {
      hintedTiles.value = new Set();
      return;
    }

    hintedTiles.value = new Set(
      guideHighlightTiles(
        guidePath.value,
        pathHistory.value,
        game.value.board.start,
      ),
    );
  }

  function syncCurrentRoadContext(next: PublicGame) {
    if (options.entryType !== 'live') return;

    localProgress.setCurrentRoadContext({
      currentGameNo: next.gameNo,
      currentDay: getRoadDayKeyFromPlayableAt(next.playableAt),
      selectedMode: next.puzzleType,
    });
  }

  function getProgressDayKey(targetGame: PublicGame | null): string | null {
    return targetGame
      ? getRoadDayKeyFromPlayableAt(targetGame.playableAt)
      : null;
  }

  function readCurrentSolveTimeMs(nowMs = Date.now()): number {
    return (
      activeSolveTimeMs.value +
      (solveTimerStartedAtMs.value === null
        ? 0
        : Math.max(0, nowMs - solveTimerStartedAtMs.value))
    );
  }

  function persistSolveTimerState(
    continueRunning: boolean,
    route?: SavedRoute | null,
  ): number {
    if (trackingDisabled.value) return activeSolveTimeMs.value;
    if (!game.value) return activeSolveTimeMs.value;

    const dayKey = getProgressDayKey(game.value);
    if (!dayKey) return activeSolveTimeMs.value;

    const nowMs = Date.now();
    const nextActiveTimeMs = readCurrentSolveTimeMs(nowMs);
    activeSolveTimeMs.value = nextActiveTimeMs;
    solveTimerStartedAtMs.value = continueRunning ? nowMs : null;

    // Keep the open board playable without updating the old daily record.
    if (isLiveRoadExpired()) return nextActiveTimeMs;

    const progress = localProgress.setSolveTimerState(
      game.value.gameNo,
      game.value.puzzleType,
      dayKey,
      nextActiveTimeMs,
      solveTimerStartedAtMs.value
        ? new Date(solveTimerStartedAtMs.value).toISOString()
        : null,
      progressScope,
      route,
    );
    activeSolveTimeMs.value = progress.activeTimeMs;
    savedRoute = progress.route;

    return progress.activeTimeMs;
  }

  function startSolveTimer() {
    if (
      trackingDisabled.value ||
      !game.value ||
      lastSolved.value ||
      documentVisibility.value !== 'visible' ||
      solveTimerStartedAtMs.value !== null
    ) {
      return;
    }

    solveTimerCanResume.value = true;
    solveTimerStartedAtMs.value = Date.now();
  }

  function resumeSolveTimer() {
    if (
      trackingDisabled.value ||
      !game.value ||
      lastSolved.value ||
      !solveTimerCanResume.value ||
      solveTimerStartedAtMs.value !== null ||
      isBoardOverlayOpen.value
    ) {
      return;
    }

    startSolveTimer();
  }

  function pauseSolveTimerForVisibility() {
    if (solveTimerStartedAtMs.value === null) return;
    if (syncSavedProgress(false)) {
      persistSolveTimerState(false);
    } else {
      solveTimerStartedAtMs.value = null;
    }
  }

  function stopSolveTimer(): number {
    if (trackingDisabled.value) {
      solveTimerStartedAtMs.value = null;
      solveTimerCanResume.value = false;
      return 0;
    }

    const elapsed =
      solveTimerStartedAtMs.value === null
        ? activeSolveTimeMs.value
        : persistSolveTimerState(false);
    solveTimerCanResume.value = false;
    return elapsed;
  }

  function setupGame(next: PublicGame, options: SetupGameOptions = {}) {
    const restoreLocalProgress = options.restoreLocalProgress !== false;
    const dayKey = getRoadDayKeyFromPlayableAt(next.playableAt);
    let progress = restoreLocalProgress
      ? localProgress.getGameProgress(
          next.gameNo,
          next.puzzleType,
          progressScope,
          dayKey,
        )
      : {
          attempts: 0,
          solved: false,
          hintsUsed: 0,
          solveTimeMs: null,
          activeTimeMs: 0,
          timerStartedAt: null,
          guidePath: [],
          route: null,
        };
    // Archive progress is cleared on solve. The durable solved
    // signal for archived roads is the completion map merged with live
    // history. Live pages keep reading their own progress records.
    const hasSolvedHistory =
      progress.solved ||
      (progressScope === 'replay' &&
        localProgress.isRoadModeSolved(next.gameNo, next.puzzleType));
    let route = hasSolvedHistory ? null : progress.route;
    let resumed = route && restoreRoadRoute(next.board, route.path);
    if (route && !resumed) {
      progress = localProgress.discardSavedRoute({
        gameNo: next.gameNo,
        puzzleType: next.puzzleType,
        day: dayKey,
        scope: progressScope,
        route,
      });
      route = progress.solved ? null : progress.route;
      resumed = route && restoreRoadRoute(next.board, route.path);
    }
    savedRoute = progress.route;
    const restored = resumed ?? restoreRoadRoute(next.board, [next.board.start])!;
    const path = resumed && route ? [...route.path] : [next.board.start];
    const progressAttemptNumber = Math.max(progress.attempts, 0) + 1;
    const solvedMedal = progress.solved
      ? calcMedalForAttempt(Math.max(progress.attempts, 1), true)
      : null;

    selectedMode.value = next.puzzleType;
    game.value = next;
    tiles.value = buildInitialTileStates(next.board);
    visited.value = restored.visited;
    pathHistory.value = path;
    currentTileIndex.value = restored.current;
    score.value = restored.score;
    moves.value = path.length;
    ended.value = false;
    submitting.value = false;
    hintKind.value = null;
    hintedTiles.value = new Set();
    expeditionJustUnlocked.value = false;
    status.value = UI_COPY.runtime.preRun;
    lastTier.value = null;
    // A solved puzzle always presents as solved at rest — even after a
    // mid-replay retry. Moving off the start tile is what begins an
    // untracked replay run.
    lastMedal.value = hasSolvedHistory ? solvedMedal : null;
    lastSolved.value = hasSolvedHistory;
    solvedAfterRollover.value = false;
    solvedRestMedal.value = hasSolvedHistory ? solvedMedal : null;
    undoAvailable.value = path.length > 1 && route?.undoAvailable === true;
    attemptNumber.value = hasSolvedHistory
      ? 1
      : progressAttemptNumber;
    hintsUsed.value = progress.hintsUsed;
    guidePath.value = [...progress.guidePath];
    sessionId.value = createSessionId();
    trackingDisabled.value = hasSolvedHistory;
    activeSolveTimeMs.value = hasSolvedHistory
      ? (progress.solveTimeMs ?? 0)
      : progress.activeTimeMs;
    solveTimerStartedAtMs.value = null;
    solveTimerCanResume.value = !hasSolvedHistory;

    activeSet.value = new Set(restored.neighbors);
    syncGuideHighlight();
    updateTileStates();
    if (restoreLocalProgress && options.syncContext !== false) {
      syncCurrentRoadContext(next);
    }

    if (
      restoreLocalProgress &&
      solveTimerCanResume.value &&
      documentVisibility.value === 'visible'
    ) {
      resumeSolveTimer();
    }
  }

  function readSavedProgress() {
    if (!game.value) return null;
    return localProgress.getGameProgress(
      game.value.gameNo,
      game.value.puzzleType,
      progressScope,
      getRoadDayKeyFromPlayableAt(game.value.playableAt),
    );
  }

  // Read before actions as well as on focus so a stale click cannot
  // overwrite a route saved by another tab.
  function syncSavedProgress(applyBoardUpdate = true): boolean {
    if (!game.value || trackingDisabled.value || isLiveRoadExpired()) return true;
    localProgress.reload();
    const progress = readSavedProgress();
    if (!progress) return true;

    if (
      progress.solved ||
      (progressScope === 'replay' &&
        localProgress.isRoadModeSolved(game.value.gameNo, game.value.puzzleType)) ||
      progress.attempts !== attemptNumber.value - (ended.value ? 0 : 1) ||
      JSON.stringify(progress.route) !== JSON.stringify(savedRoute)
    ) {
      if (applyBoardUpdate) {
        setupGame(game.value, { syncContext: false });
        progressSyncSignal.value += 1;
      }
      return false;
    }

    if (progress.activeTimeMs > activeSolveTimeMs.value) {
      activeSolveTimeMs.value = progress.activeTimeMs;
      if (solveTimerStartedAtMs.value !== null) {
        solveTimerStartedAtMs.value = Date.now();
      }
    }

    if (applyBoardUpdate && progress.hintsUsed !== hintsUsed.value) {
      hintsUsed.value = progress.hintsUsed;
      guidePath.value = progress.guidePath;
      hintKind.value = null;
      syncGuideHighlight();
      progressSyncSignal.value += 1;
    }
    return true;
  }

  function handleBoardFocus() {
    if (documentVisibility.value !== 'visible' || !document.hasFocus()) return;
    if (syncSavedProgress()) resumeSolveTimer();
  }

  function handleStorageChange(event: StorageEvent) {
    if (
      event.key === GOLDROAD_STORAGE_KEY ||
      event.key === REPLAY_PROGRESS_STORAGE_KEY
    ) {
      handleBoardFocus();
    }
  }

  function saveCurrentRoute() {
    const route = pathHistory.value.length > 1
      ? { path: pathHistory.value, undoAvailable: undoAvailable.value }
      : null;
    persistSolveTimerState(solveTimerStartedAtMs.value !== null, route);
  }

  function getPreferredMode(
    roadDay: CurrentGamesResponse,
    preferredMode: PuzzleType | null,
  ): PuzzleType | null {
    if (
      preferredMode === 'expedition' &&
      roadDay.expedition &&
      isExpeditionUnlocked.value
    ) {
      return 'expedition';
    }

    if (roadDay.classic) return 'classic';
    if (roadDay.expedition) return 'expedition';
    return null;
  }

  function applyRoadDay(
    roadDay: CurrentGamesResponse,
    options: ApplyRoadDayOptions = {},
  ) {
    availableGames.value = roadDay;
    const nextMode = getPreferredMode(
      roadDay,
      options.preferredMode ?? selectedMode.value,
    );

    if (!nextMode) {
      clearRoadDay();
      return;
    }

    // This is an authoritative road-day replacement, not an in-day mode
    // switch. Calling selectMode() here would inspect the still-mounted old
    // board and reject the replacement once that old road had expired.
    const next =
      nextMode === 'classic' ? roadDay.classic : roadDay.expedition;
    if (next) {
      const replacesMountedGame =
        game.value && isDifferentGameIdentity(game.value, next);
      if (replacesMountedGame && !lastSolved.value) {
        pauseSolveTimerForVisibility();
      }
      setupGame(next, {
        restoreLocalProgress: options.restoreLocalProgress,
      });
    }
  }

  // True only for the live road once its own schedule has moved on. Archive
  // and random play never expire.
  function isLiveRoadExpired(): boolean {
    return (
      options.entryType === 'live' &&
      isRoadExpired(game.value?.nextGameAt, Date.now())
    );
  }

  function startAnalyticsOnce() {
    if (!game.value || !playerUUID.value || !sessionId.value) {
      return;
    }

    const key = `${game.value.gameNo}:${game.value.puzzleType}`;
    if (
      !shouldStartSessionApi(
        options.entryType,
        trackingDisabled.value,
        isLiveRoadExpired(),
        startedRoadModes.has(key),
      )
    ) {
      return;
    }
    startedRoadModes.add(key);
    void sessionApi
      .startSession({
        playerUUID: playerUUID.value,
        gameNo: game.value.gameNo,
        puzzleType: game.value.puzzleType,
        sessionId: sessionId.value,
      })
      .catch((error) => {
        console.warn('[analytics] session start failed', {
          gameNo: game.value?.gameNo,
          puzzleType: game.value?.puzzleType,
          error,
        });
      });
  }

  function selectMode(mode: PuzzleType) {
    if (mode === 'expedition' && !isExpeditionUnlocked.value) return;
    // Rebuilding the other mode's board after expiry would act as a retry.
    if (isLiveRoadExpired()) return;

    const next =
      mode === 'classic'
        ? availableGames.value.classic
        : availableGames.value.expedition;
    if (!next) return;

    if (game.value?.puzzleType === mode) return;
    if (game.value && !lastSolved.value) {
      pauseSolveTimerForVisibility();
    }

    setupGame(next);
  }

  function switchToExpedition() {
    if (!availableGames.value.expedition || !isExpeditionUnlocked.value) return;
    selectMode('expedition');
  }

  function buildModeResult(
    puzzleType: PuzzleType,
    result: {
      attempts: number;
      solved: boolean;
      solveTimeMs: number | null;
      hintsUsed: number;
    },
  ): CelebrationModeResult {
    return {
      puzzleType,
      attempts: Math.max(result.attempts, result.solved ? 1 : 0),
      solved: result.solved,
      medal: calcMedalForAttempt(Math.max(result.attempts, 1), result.solved),
      solveTimeMs: result.solveTimeMs,
      hintsUsed: result.hintsUsed,
    };
  }

  function triggerCelebration(params: {
    medal: Medal | null;
    wouldHaveMedal: Medal | null;
    solveTimeMs: number | null;
    isUntrackedReplay: boolean;
    dayKey: string | null;
  }) {
    if (!game.value) return;

    const current = game.value;
    const mode = current.puzzleType;
    const tier = celebrationTierForMedal(
      params.wouldHaveMedal ?? params.medal,
    );
    const attempts = attemptNumber.value;

    // Archive / random replays get a lightweight, non-persisted acknowledgment
    // with no daily-streak or countdown implication. Only the first solve of a
    // road+mode celebrates — re-walking an already-solved road (whether it was
    // solved live or in the archive) just settles back into the solved rest
    // state.
    if (options.entryType !== 'live') {
      if (params.isUntrackedReplay) return;
      celebration.value = {
        variant: 'replay-solve',
        tier,
        gameNo: current.gameNo,
        puzzleType: mode,
        medal: null,
        wouldHaveMedal: params.wouldHaveMedal,
        attemptNumber: attempts,
        solveTimeMs: params.solveTimeMs,
        hintsUsed: hintsUsed.value,
        hasExpedition: false,
        classicResult: null,
        expeditionResult: null,
      };
      return;
    }

    // Replaying an already-solved live board never re-pops the celebration.
    if (params.isUntrackedReplay || !params.dayKey) return;
    if (
      localProgress.hasCelebratedSolve(current.gameNo, mode, params.dayKey)
    ) {
      return;
    }
    localProgress.markSolveCelebrated(current.gameNo, mode, params.dayKey);
    if (mode === 'classic') {
      celebration.value = {
        variant: 'classic-solve',
        tier,
        gameNo: current.gameNo,
        puzzleType: mode,
        medal: params.medal,
        wouldHaveMedal: null,
        attemptNumber: attempts,
        solveTimeMs: params.solveTimeMs,
        hintsUsed: hintsUsed.value,
        // After expiry the mode switch is locked, so the Expedition CTA
        // would dead-end; the footer's "Play the new road" leads instead.
        hasExpedition:
          Boolean(availableGames.value.expedition) && !isLiveRoadExpired(),
        classicResult: null,
        expeditionResult: null,
      };
      return;
    }

    // Expedition solve completes the day: gather both mode results.
    const classicGame = availableGames.value.classic;
    const classicProgress = classicGame
      ? localProgress.getGameProgress(
          classicGame.gameNo,
          'classic',
          progressScope,
        )
      : null;

    celebration.value = {
      variant: 'day-complete',
      tier,
      gameNo: current.gameNo,
      puzzleType: mode,
      medal: params.medal,
      wouldHaveMedal: null,
      attemptNumber: attempts,
      solveTimeMs: params.solveTimeMs,
      hintsUsed: hintsUsed.value,
      hasExpedition: true,
      classicResult: classicProgress
        ? buildModeResult('classic', {
            attempts: classicProgress.attempts,
            solved: classicProgress.solved,
            solveTimeMs: classicProgress.solveTimeMs,
            hintsUsed: classicProgress.hintsUsed,
          })
        : null,
      expeditionResult: buildModeResult('expedition', {
        attempts: attempts,
        solved: true,
        solveTimeMs: params.solveTimeMs,
        hintsUsed: hintsUsed.value,
      }),
    };
  }

  function dismissCelebration() {
    celebration.value = null;
  }

  function continueToExpedition() {
    const shouldSwitch =
      celebration.value?.variant === 'classic-solve' &&
      !isLiveRoadExpired() &&
      Boolean(availableGames.value.expedition) &&
      isExpeditionUnlocked.value;
    dismissCelebration();
    if (shouldSwitch) {
      switchToExpedition();
    }
  }

  async function shareCurrentResult(): Promise<ShareRoadResultResponse | null> {
    if (!game.value || solvedAfterRollover.value) return null;

    const progress = localProgress.getGameProgress(
      game.value.gameNo,
      game.value.puzzleType,
      progressScope,
    );

    if (progress.solved) {
      return resultShare.shareRoadResult({
        gameNo: game.value.gameNo,
        puzzleType: game.value.puzzleType,
        attempts: Math.max(progress.attempts, 1),
        solved: true,
        solveTimeMs: progress.solveTimeMs,
        hintsUsed: progress.hintsUsed,
      });
    }

    return null;
  }

  async function shareCelebrationResult(): Promise<ShareRoadResultResponse | null> {
    const active = celebration.value;
    if (!active) return null;

    if (active.variant === 'day-complete') {
      return resultShare.shareDayResult({
        gameNo: active.gameNo,
        classic: active.classicResult
          ? {
              attempts: active.classicResult.attempts,
              solved: active.classicResult.solved,
              solveTimeMs: active.classicResult.solveTimeMs,
            }
          : null,
        expedition: active.expeditionResult
          ? {
              attempts: active.expeditionResult.attempts,
              solved: active.expeditionResult.solved,
              solveTimeMs: active.expeditionResult.solveTimeMs,
            }
          : null,
      });
    }

    return resultShare.shareRoadResult({
      gameNo: active.gameNo,
      puzzleType: active.puzzleType,
      attempts: active.attemptNumber,
      solved: true,
      solveTimeMs: active.solveTimeMs,
      hintsUsed: active.hintsUsed,
    });
  }

  async function finalizeRun(
    endReason: 'solved' | 'wrong-exit' | 'dead-end' | 'retry',
  ) {
    if (
      !game.value ||
      submitting.value ||
      !playerUUID.value ||
      !sessionId.value
    ) {
      return;
    }

    const solved = endReason === 'solved';
    if (isLiveRoadExpired()) {
      if (solved) {
        stopSolveTimer();
        localProgress.reload();
        const alreadySolved = localProgress.isRoadModeSolved(game.value.gameNo, game.value.puzzleType);
        if (!alreadySolved) {
          localProgress.recordArchiveCompletion(game.value.gameNo, game.value.puzzleType);
        }
        guidePath.value = [];
        hintedTiles.value = new Set();
        lastSolved.value = true;
        solvedAfterRollover.value = true;
        solveAcknowledgement.value = alreadySolved
          ? UI_COPY.runtime.solvedAgain
          : UI_COPY.runtime.savedToPastRoads;
        solveCelebrationSignal.value += 1;
      }
      return;
    }

    const isUntrackedReplay = trackingDisabled.value;
    // Only an exact solve is submitted. Failed routes remain local gameplay
    // states and never enter an analytics-submission state.
    submitting.value = false;
    const expeditionWasUnlocked = isExpeditionUnlocked.value;
    const dayKey = getProgressDayKey(game.value);
    const elapsedSolveTimeMs = solved || endReason === 'retry'
      ? stopSolveTimer()
      : persistSolveTimerState(solveTimerStartedAtMs.value !== null);
    const solveTimeMs = solved ? elapsedSolveTimeMs : null;
    const { medal, wouldHaveMedal } = resolveRunMedals(
      options.entryType,
      isUntrackedReplay,
      attemptNumber.value,
      solved,
    );
    const tier: OutcomeTier =
      medal ?? (endReason === 'wrong-exit' ? 'finished' : 'unfinished');

    lastSolved.value = solved;
    lastMedal.value = medal;
    lastTier.value = tier;
    expeditionJustUnlocked.value =
      options.entryType === 'live' &&
      !isUntrackedReplay &&
      selectedMode.value === 'classic' &&
      solved &&
      !expeditionWasUnlocked &&
      Boolean(availableGames.value.expedition);

    if (!isUntrackedReplay && dayKey) {
      localProgress.recordRun(
        game.value.gameNo,
        game.value.puzzleType,
        dayKey,
        attemptNumber.value,
        solved,
        solveTimeMs,
        progressScope,
        solved ? 0 : elapsedSolveTimeMs,
        solveTimerStartedAtMs.value === null ? null : undefined,
      );
      savedRoute = null;
    }
    // An archive solve writes exactly one durable fact: this road+mode is
    // complete. It feeds only the calendar and solved/unlock presentation.
    if (shouldRecordArchiveCompletion(options.entryType, solved)) {
      localProgress.recordArchiveCompletion(
        game.value.gameNo,
        game.value.puzzleType,
      );
    }
    if (solved) {
      guidePath.value = [];
      hintedTiles.value = new Set();
      solveCelebrationSignal.value += 1;
      solveAcknowledgement.value = isUntrackedReplay
        ? UI_COPY.runtime.solvedAgain
        : null;
      triggerCelebration({
        medal,
        wouldHaveMedal,
        solveTimeMs,
        isUntrackedReplay,
        dayKey,
      });
    }

    // Archived play never creates analytics rows (RP0-5).
    if (
      !shouldSubmitSessionEnd(
        options.entryType,
        isUntrackedReplay,
        endReason,
      )
    ) {
      return;
    }

    submitting.value = true;
    const payload: SessionEndRequest = {
      playerUUID: playerUUID.value,
      gameNo: game.value.gameNo,
      puzzleType: game.value.puzzleType,
      sessionId: sessionId.value,
      score: score.value,
      moves: moves.value,
      attemptNumber: attemptNumber.value,
      hintsUsed: hintsUsed.value,
      solveTimeMs,
    };

    try {
      await sessionApi.endSession(payload, { keepalive: true });
    } catch (error) {
      if (game.value.nextGameAt && isRetryableDeliveryError(error)) {
        failedSolveDelivery.queueFailedSolve(payload, game.value.nextGameAt);
      }
      console.warn('[analytics] solve submission failed', {
        gameNo: payload.gameNo,
        puzzleType: payload.puzzleType,
        error,
      });
    } finally {
      submitting.value = false;
    }
  }

  function undoLastStep() {
    if (!game.value || !canUndo.value || !syncSavedProgress()) return;

    const result = applyUndoLastStep(game.value.board, {
      pathHistory: pathHistory.value,
      score: score.value,
      moves: moves.value,
    });
    if (!result) return;

    pathHistory.value = result.pathHistory;
    visited.value = result.visited;
    currentTileIndex.value = result.currentTileIndex;
    tileFocusSignal.value += 1;
    score.value = result.score;
    moves.value = result.moves;
    activeSet.value = new Set(result.activeNeighbors);
    undoAvailable.value = nextUndoAvailable('undo', false);
    hintKind.value = null;
    syncGuideHighlight();

    if (
      shouldRestoreSolvedRest({
        trackingDisabled: trackingDisabled.value,
        pathLengthAfterUndo: result.pathHistory.length,
      })
    ) {
      lastSolved.value = true;
      lastMedal.value = solvedRestMedal.value;
      lastTier.value = null;
      solveAcknowledgement.value = null;
    }

    // Only a take-back that reaches the start changes the message. Mid-road
    // the footer is quiet by design, and a move does not touch status either.
    if (result.pathHistory.length <= 1) {
      status.value = UI_COPY.runtime.preRun;
    }

    saveCurrentRoute();
    undoSignal.value += 1;
    updateTileStates();
  }

  async function retryCurrentGame() {
    if (!game.value || loading.value) return;
    if (submitting.value && !ended.value) return;
    // No fresh attempts on an expired road — the active one may finish.
    if (isLiveRoadExpired()) return;
    // No moves made yet: the board is already at its starting state, so a
    // retry would only churn messages. Pure no-op.
    if (!ended.value && moves.value <= 1) return;
    if (!syncSavedProgress()) return;

    const nextAttemptNumber = trackingDisabled.value
      ? attemptNumber.value
      : attemptNumber.value + 1;

    if (!ended.value && !lastSolved.value && !trackingDisabled.value) {
      await finalizeRun('retry');
    } else if (solveTimerStartedAtMs.value !== null) {
      persistSolveTimerState(false);
    }

    setupGame(game.value);
    tileFocusSignal.value += 1;
    nudgeHintIfStuck(nextAttemptNumber);
  }

  /**
   * Light the hint control for a player who looks stuck. Only ever at the
   * top of a fresh run, where the board is quiet and nothing else is asking
   * for attention, and never for someone who has already used a hint on this
   * road — they know it is there.
   *
   * First nudge: starting a third run, so two have already ended badly.
   * Second: starting a sixth, or starting any run once five minutes of
   * active play have accumulated. Two in a road is the whole budget.
   *
   * Both conditions are read here, at the start of a run, and nowhere else.
   * The five-minute rule therefore means "the next run you begin after five
   * minutes", not "five minutes after you sit down" — deliberately. A nudge
   * that interrupted a player mid-route would be doing the one thing the
   * quiet mid-run footer exists to prevent.
   */
  function nudgeHintIfStuck(attempt: number) {
    if (trackingDisabled.value) return;
    if (hintsUsed.value > 0) return;
    if (HINTS_PER_ROAD_MODE - hintsUsed.value <= 0) return;

    if (hintNudgeLevel.value === 0 && attempt >= 3) {
      hintNudgeLevel.value = 1;
      hintNudgeSignal.value += 1;
      return;
    }

    const stuckLong = readCurrentSolveTimeMs() >= 5 * 60 * 1000;
    if (hintNudgeLevel.value === 1 && (attempt >= 6 || stuckLong)) {
      hintNudgeLevel.value = 2;
      hintNudgeSignal.value += 1;
    }
  }

  async function moveTo(tileIndex: number) {
    if (!game.value || ended.value || currentTileIndex.value === null) return;
    if (!syncSavedProgress()) return;
    if (tileIndex === currentTileIndex.value) return;
    if (!activeSet.value.has(tileIndex)) {
      // The tile you came from is the Undo button by another route. Once the
      // take-back is spent the tap still buzzes rather than going quiet, so
      // the one-step rule stays legible from the board itself.
      if (isUndoTapTarget(pathHistory.value, tileIndex) && canUndo.value) {
        undoLastStep();
        return;
      }
      deniedTileIndex.value = tileIndex;
      deniedMoveSignal.value += 1;
      return;
    }

    if (moves.value === 1 && lastSolved.value) {
      lastSolved.value = false;
      lastMedal.value = null;
      lastTier.value = null;
      solveAcknowledgement.value = null;
    }

    startAnalyticsOnce();
    startSolveTimer();

    const board = game.value.board;
    const edgeMap = buildEdgeMap(board);
    const edgeType = getEdgeType(currentTileIndex.value, tileIndex, edgeMap);
    let edgeCost = 0;
    if (edgeType === 'toll') {
      edgeCost = -board.tollValue;
    } else if (edgeType === 'bonus') {
      edgeCost = board.bonusValue;
    }

    visited.value.add(tileIndex);
    pathHistory.value = [...pathHistory.value, tileIndex];
    currentTileIndex.value = tileIndex;
    tileFocusSignal.value += 1;
    const nextScore = score.value + (board.tiles[tileIndex] ?? 0) + edgeCost;
    score.value = nextScore;
    moves.value += 1;
    successfulMoveSignal.value += 1;
    if (!pathHistory.value.every((tile, index) => tile === guidePath.value[index])) {
      hintKind.value = null;
    }
    syncGuideHighlight();

    if (tileIndex === board.end) {
      ended.value = true;
      undoAvailable.value = nextUndoAvailable('move', true);
      const delta = game.value.maxScore - nextScore;
      status.value =
        delta === 0
          ? UI_COPY.runtime.destinationSolved
          : delta > 0
            ? UI_COPY.runtime.destinationShort(delta)
            : UI_COPY.runtime.destinationOver(Math.abs(delta));
      activeSet.value.clear();
      updateTileStates();
      if (delta !== 0) {
        deadEndSignal.value += 1;
      }
      await finalizeRun(delta === 0 ? 'solved' : 'wrong-exit');
      return;
    }

    const next = getActiveNeighbors(
      tileIndex,
      board.rows,
      board.cols,
      edgeMap,
      visited.value,
    );
    activeSet.value = new Set(next);

    if (!next.length) {
      ended.value = true;
      undoAvailable.value = nextUndoAvailable('move', true);
      status.value = isLiveRoadExpired()
        ? UI_COPY.runtime.expiredDeadEnd
        : UI_COPY.runtime.deadEnd;
      updateTileStates();
      deadEndSignal.value += 1;
      await finalizeRun('dead-end');
      return;
    }

    undoAvailable.value = nextUndoAvailable('move', false);

    saveCurrentRoute();
    updateTileStates();
  }

  async function requestHint() {
    if (
      trackingDisabled.value ||
      !game.value ||
      ended.value ||
      !playerUUID.value ||
      !sessionId.value
    ) {
      return;
    }
    // One request at a time, and never more than the day's allowance for
    // this mode.
    if (hintPending.value) return;
    // The live hint endpoint no longer accepts this road once it rotates
    // out; already-visible guide tiles stay, new hints quietly retire.
    if (isLiveRoadExpired() || !syncSavedProgress()) return;
    if (hintsUsed.value >= HINTS_PER_ROAD_MODE) return;

    const requestedBoard = game.value;
    const requestedPath = pathHistory.value;
    const requestedSession = sessionId.value;
    const requestedGuide = guidePath.value;
    if (solveTimerStartedAtMs.value !== null) {
      persistSolveTimerState(true);
    }

    // Archived boards ship their solution paths, so hints compute locally
    // with zero analytics calls (RP0-5). Only the live road asks the server.
    let hint: ReturnType<typeof computeHint>;
    if (options.entryType !== 'live') {
      const optimalPaths = game.value.optimalPaths;
      if (!optimalPaths?.length) return;
      hint = computeHint(
        optimalPaths,
        [...pathHistory.value],
        [...guidePath.value],
      );
    } else {
      hintPending.value = true;
      try {
        const res = await sessionApi.requestHint({
          playerUUID: playerUUID.value,
          gameNo: game.value.gameNo,
          puzzleType: game.value.puzzleType,
          sessionId: sessionId.value,
          attemptNumber: attemptNumber.value,
          pathHistory: [...pathHistory.value],
          guidePath: [...guidePath.value],
        });
        hint = res.hint;
      } catch {
        // A hint fired right at rotation can be rejected server-side once
        // the road is no longer current; retire quietly like the expiry gate.
        return;
      } finally {
        hintPending.value = false;
      }
    }

    if (
      isLiveRoadExpired() ||
      !syncSavedProgress() ||
      game.value !== requestedBoard ||
      sessionId.value !== requestedSession ||
      pathHistory.value !== requestedPath ||
      guidePath.value !== requestedGuide ||
      ended.value
    ) {
      return;
    }

    if (hintRevealsNewTile(guidePath.value, hint.guidePath)) {
      const progress = localProgress.recordHint(
        requestedBoard.gameNo,
        requestedBoard.puzzleType,
        getRoadDayKeyFromPlayableAt(requestedBoard.playableAt),
        hint.guidePath,
        progressScope,
      );

      hintsUsed.value = progress.hintsUsed;
      guidePath.value = progress.guidePath;
      syncGuideHighlight();
    }
    hintKind.value = hint.kind;
  }

  function handlePageExit() {
    pauseSolveTimerForVisibility();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (
      !game.value ||
      loading.value ||
      isBoardOverlayOpen.value ||
      currentTileIndex.value === null
    ) {
      return;
    }

    if (
      shouldHandleUndoKey({
        key: event.key,
        canUndo: canUndo.value,
        hasModifier: event.metaKey || event.ctrlKey || event.altKey,
        isTextEntry: isTextEntryEventTarget(event.target),
      })
    ) {
      event.preventDefault();
      undoLastStep();
      return;
    }

    if (ended.value) return;

    const directionMap: Record<string, Direction> = {
      ArrowUp: 'top',
      ArrowRight: 'right',
      ArrowDown: 'bottom',
      ArrowLeft: 'left',
      w: 'top',
      d: 'right',
      s: 'bottom',
      a: 'left',
    };

    const direction = directionMap[event.key];
    if (!direction) return;

    const [row, col] = parseTileIndex(
      currentTileIndex.value,
      game.value.board.cols,
    );
    const neighbor = getNeighborId(
      row,
      col,
      direction,
      game.value.board.rows,
      game.value.board.cols,
    );
    if (neighbor === null || !activeSet.value.has(neighbor)) return;

    event.preventDefault();
    void moveTo(neighbor);
  }

  onMounted(() => {
    localProgress.load();
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('beforeunload', handlePageExit);
    window.addEventListener('pagehide', handlePageExit);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleBoardFocus);
  });

  onUnmounted(() => {
    handlePageExit();
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('beforeunload', handlePageExit);
    window.removeEventListener('pagehide', handlePageExit);
    window.removeEventListener('storage', handleStorageChange);
    window.removeEventListener('focus', handleBoardFocus);
    if (typeof window !== 'undefined') {
      document.body.classList.remove('mode-classic', 'mode-expedition');
    }
  });

  return {
    availableGames,
    selectedMode,
    game,
    tiles,
    currentTileIndex,
    tileFocusSignal,
    progressSyncSignal,
    visited,
    activeSet,
    pathHistory,
    score,
    moves,
    hintMessage,
    hintedTiles,
    guidePath,
    hintPending,
    hintsRemaining: computed(() =>
      Math.max(0, HINTS_PER_ROAD_MODE - hintsUsed.value),
    ),
    ended,
    loading,
    submitting,
    status,
    lastTier,
    lastMedal,
    lastSolved,
    solvedAfterRollover,
    attemptNumber,
    expeditionJustUnlocked,
    hintsUsed,
    trackingDisabled,
    playerUUID,
    maxScore,
    totalCoins,
    roadHeading,
    isExpeditionUnlocked,
    classicSolvedToday,
    classicMedalToday,
    expeditionSolvedToday,
    expeditionMedalToday,
    celebration,
    successfulMoveSignal,
    deniedMoveSignal,
    deniedTileIndex,
    deadEndSignal,
    undoSignal,
    hintNudgeSignal,
    solveCelebrationSignal,
    solveAcknowledgement,
    clearRoadDay,
    applyRoadDay,
    selectMode,
    switchToExpedition,
    canUndo,
    overTarget,
    retryCurrentGame,
    undoLastStep,
    moveTo,
    requestHint,
    dismissCelebration,
    continueToExpedition,
    shareCelebrationResult,
    shareCurrentResult,
  };
}
