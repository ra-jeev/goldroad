import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useDocumentVisibility } from '@vueuse/core';
import { buildInitialTileStates } from '../utils/boardUtils';
import {
  buildEdgeMap,
  getActiveNeighbors,
  getEdgeType,
  getNeighborId,
  parseTileIndex,
} from '../../shared/utils/puzzleEngine';
import { calcMedalForAttempt } from '../../lib/gameTiers';
import { computeHint } from '../../shared/utils/hints';
import type {
  CurrentGamesResponse,
  Direction,
  Medal,
  OutcomeTier,
  PublicGame,
  PuzzleType,
} from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';
import {
  getRoadDayKeyFromPlayableAt,
  type LocalProgressScope,
} from './useGoldroadLocalState';
import {
  useRoadResultShare,
  type ShareRoadResultResponse,
} from './useRoadResultShare';

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

/**
 * The midnight contract (RP1-16): once the loaded road's own nextGameAt has
 * passed, the board stays exactly as it is, but retry, hints, mode switching,
 * and server analytics all stop — the in-flight (or one first) attempt may
 * still finish with full local credit, streak included.
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
  attemptNumber?: number;
};

type ApplyRoadDayOptions = {
  preferredMode?: PuzzleType | null;
};

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return '00000000-0000-4000-8000-000000000000';
}

export function useRoadDayGameplay(options: { entryType: EntryType }) {
  const sessionApi = useSessionApi();
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
  const visited = ref<Set<number>>(new Set());
  const activeSet = ref<Set<number>>(new Set());
  const pathHistory = ref<number[]>([]);
  const score = ref(0);
  const moves = ref(0);
  const hintMessage = ref<string | null>(null);
  const hintedTiles = ref<Set<number>>(new Set());
  const guidePath = ref<number[]>([]);
  const ended = ref(false);
  const loading = ref(false);
  const submitting = ref(false);
  const status = ref<string>(UI_COPY.runtime.loadingGame);
  const lastTier = ref<OutcomeTier | null>(null);
  const lastMedal = ref<Medal | null>(null);
  const lastSolved = ref(false);
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
  const deadEndSignal = ref(0);
  const solveCelebrationSignal = ref(0);

  const documentVisibility = useDocumentVisibility();
  const { isBoardOverlayOpen } = useBoardOverlayGate();
  const playerUUID = localProgress.playerUUID;
  const progressScope: LocalProgressScope =
    options.entryType === 'live' ? 'live' : 'replay';
  const maxScore = computed(() => game.value?.maxScore ?? 0);
  const totalCoins = computed(() => game.value?.totalCoins ?? 0);
  const roadHeading = computed(() =>
    game.value ? `Road ${game.value.gameNo}` : 'Road ...',
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

    if (visibility === 'visible') {
      resumeSolveTimer();
    }
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
    hintMessage.value = null;
    hintedTiles.value = new Set();
    guidePath.value = [];
    ended.value = false;
    submitting.value = false;
    status.value = UI_COPY.runtime.loadingGame;
    lastTier.value = null;
    lastMedal.value = null;
    lastSolved.value = false;
    attemptNumber.value = 1;
    expeditionJustUnlocked.value = false;
    sessionId.value = '';
    hintsUsed.value = 0;
    trackingDisabled.value = false;
    activeSolveTimeMs.value = 0;
    solveTimerStartedAtMs.value = null;
    solveTimerCanResume.value = false;
    celebration.value = null;
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

    const traversed = new Set(pathHistory.value);
    hintedTiles.value = new Set(
      guidePath.value.filter(
        (tileIndex) =>
          tileIndex !== game.value?.board.start && !traversed.has(tileIndex),
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

  function persistSolveTimerState(continueRunning: boolean): number {
    if (trackingDisabled.value) return activeSolveTimeMs.value;
    if (!game.value) return activeSolveTimeMs.value;

    const dayKey = getProgressDayKey(game.value);
    if (!dayKey) return activeSolveTimeMs.value;

    const nowMs = Date.now();
    const nextActiveTimeMs = readCurrentSolveTimeMs(nowMs);
    activeSolveTimeMs.value = nextActiveTimeMs;
    solveTimerStartedAtMs.value = continueRunning ? nowMs : null;

    localProgress.setSolveTimerState(
      game.value.gameNo,
      game.value.puzzleType,
      dayKey,
      nextActiveTimeMs,
      solveTimerStartedAtMs.value
        ? new Date(solveTimerStartedAtMs.value).toISOString()
        : null,
      progressScope,
    );

    return nextActiveTimeMs;
  }

  function startSolveTimer() {
    if (
      trackingDisabled.value ||
      !game.value ||
      lastSolved.value ||
      solveTimerStartedAtMs.value !== null
    ) {
      return;
    }

    const dayKey = getProgressDayKey(game.value);
    if (!dayKey) return;

    const nowMs = Date.now();
    solveTimerCanResume.value = true;
    solveTimerStartedAtMs.value = nowMs;
    localProgress.setSolveTimerState(
      game.value.gameNo,
      game.value.puzzleType,
      dayKey,
      activeSolveTimeMs.value,
      new Date(nowMs).toISOString(),
      progressScope,
    );
  }

  function resumeSolveTimer() {
    if (
      trackingDisabled.value ||
      !game.value ||
      ended.value ||
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
    persistSolveTimerState(false);
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
    const progress = localProgress.getGameProgress(
      next.gameNo,
      next.puzzleType,
      progressScope,
    );
    const progressAttemptNumber = Math.max(progress.attempts, 0) + 1;
    // Archive progress is transient (cleared on solve); the durable solved
    // signal for archived roads is the completion map merged with live
    // history. Live pages keep reading their own progress records.
    const hasSolvedHistory =
      progress.solved ||
      (progressScope === 'replay' &&
        localProgress.isRoadModeSolved(next.gameNo, next.puzzleType));
    const solvedMedal = progress.solved
      ? calcMedalForAttempt(Math.max(progress.attempts, 1), true)
      : null;

    selectedMode.value = next.puzzleType;
    game.value = next;
    tiles.value = buildInitialTileStates(next.board);
    visited.value = new Set([next.board.start]);
    pathHistory.value = [next.board.start];
    currentTileIndex.value = next.board.start;
    score.value = next.board.tiles[next.board.start] ?? 0;
    moves.value = 1;
    ended.value = false;
    submitting.value = false;
    hintMessage.value = null;
    hintedTiles.value = new Set();
    expeditionJustUnlocked.value = false;
    status.value = UI_COPY.runtime.preRun;
    lastTier.value = null;
    // A solved puzzle always presents as solved at rest — even after a
    // mid-replay retry. Moving off the start tile is what begins an
    // untracked replay run.
    lastMedal.value = hasSolvedHistory ? solvedMedal : null;
    lastSolved.value = hasSolvedHistory;
    attemptNumber.value = hasSolvedHistory
      ? 1
      : (options.attemptNumber ?? progressAttemptNumber);
    hintsUsed.value = progress.hintsUsed;
    guidePath.value = [...progress.guidePath];
    sessionId.value = createSessionId();
    trackingDisabled.value = hasSolvedHistory;
    activeSolveTimeMs.value = hasSolvedHistory
      ? (progress.solveTimeMs ?? 0)
      : progress.activeTimeMs;
    solveTimerStartedAtMs.value = null;
    solveTimerCanResume.value = !hasSolvedHistory;

    const edgeMap = buildEdgeMap(next.board);
    const active = getActiveNeighbors(
      next.board.start,
      next.board.rows,
      next.board.cols,
      edgeMap,
      visited.value,
    );
    activeSet.value = new Set(active);
    syncGuideHighlight();
    updateTileStates();
    syncCurrentRoadContext(next);

    if (solveTimerCanResume.value && documentVisibility.value === 'visible') {
      resumeSolveTimer();
    }
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

    selectMode(nextMode);
  }

  // True only for the live road once its own schedule has moved on. Archive
  // and random play never expire.
  function isLiveRoadExpired(): boolean {
    return (
      options.entryType === 'live' &&
      isRoadExpired(game.value?.nextGameAt, Date.now())
    );
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

    if (game.value && game.value.puzzleType !== mode && !lastSolved.value) {
      stopSolveTimer();
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
      solveCelebrationSignal.value += 1;
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
    solveCelebrationSignal.value += 1;

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
      Boolean(availableGames.value.expedition) &&
      isExpeditionUnlocked.value;
    dismissCelebration();
    if (shouldSwitch) {
      switchToExpedition();
    }
  }

  async function shareCurrentResult(): Promise<ShareRoadResultResponse | null> {
    if (!game.value) return null;

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

    const isUntrackedReplay = trackingDisabled.value;
    const isLive = options.entryType === 'live';
    // Only live, tracked runs ever talk to the server; archive play is
    // fully local (RP0-5), so it never enters a submitting state either.
    submitting.value = !isUntrackedReplay && isLive;
    const expeditionWasUnlocked = isExpeditionUnlocked.value;
    const solved = endReason === 'solved';
    const dayKey = getProgressDayKey(game.value);
    const elapsedSolveTimeMs = isUntrackedReplay ? 0 : stopSolveTimer();
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
      !isLiveRoadExpired() &&
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
        null,
      );
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
      triggerCelebration({
        medal,
        wouldHaveMedal,
        solveTimeMs,
        isUntrackedReplay,
        dayKey,
      });
    }

    // Archived play never creates analytics rows (RP0-5), and an expired
    // road's grandfathered finish keeps its full local result but skips the
    // server, which only accepts the current road (RP1-16).
    if (
      !shouldCallSessionApi(
        options.entryType,
        isUntrackedReplay,
        isLiveRoadExpired(),
      )
    ) {
      submitting.value = false;
      return;
    }

    try {
      await sessionApi.endSession({
        playerUUID: playerUUID.value,
        gameNo: game.value.gameNo,
        puzzleType: game.value.puzzleType,
        sessionId: sessionId.value,
        score: score.value,
        moves: moves.value,
        attemptNumber: attemptNumber.value,
        solved,
        endReason,
        hintsUsed: hintsUsed.value,
        solveTimeMs,
      });
    } catch {
      // Analytics only: a request that started just before rotation can be
      // rejected once the server no longer accepts this road. Local credit
      // was already recorded above.
    } finally {
      submitting.value = false;
    }
  }

  async function retryCurrentGame() {
    if (!game.value || loading.value) return;
    if (submitting.value && !ended.value) return;
    // No fresh attempts on an expired road — the active one may finish.
    if (isLiveRoadExpired()) return;
    // No moves made yet: the board is already at its starting state, so a
    // retry would only churn messages. Pure no-op.
    if (!ended.value && moves.value <= 1) return;

    const nextAttemptNumber = trackingDisabled.value
      ? attemptNumber.value
      : attemptNumber.value + 1;

    if (!ended.value && !lastSolved.value && !trackingDisabled.value) {
      await finalizeRun('retry');
    }

    setupGame(game.value, {
      attemptNumber: nextAttemptNumber,
    });
  }

  async function moveTo(tileIndex: number) {
    if (!game.value || ended.value || currentTileIndex.value === null) return;
    if (tileIndex === currentTileIndex.value) return;
    if (!activeSet.value.has(tileIndex)) {
      deniedMoveSignal.value += 1;
      return;
    }

    if (moves.value === 1 && lastSolved.value) {
      lastSolved.value = false;
      lastMedal.value = null;
      lastTier.value = null;
    }

    if (moves.value === 1) {
      startSolveTimer();
    }

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
    const nextScore = score.value + (board.tiles[tileIndex] ?? 0) + edgeCost;
    score.value = nextScore;
    moves.value += 1;
    successfulMoveSignal.value += 1;
    hintMessage.value = null;
    syncGuideHighlight();

    if (tileIndex === board.end) {
      ended.value = true;
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
      status.value = UI_COPY.runtime.deadEnd;
      updateTileStates();
      deadEndSignal.value += 1;
      await finalizeRun('dead-end');
      return;
    }

    if (solveTimerStartedAtMs.value !== null) {
      persistSolveTimerState(true);
    }

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
    // The live hint endpoint no longer accepts this road once it rotates
    // out; already-visible guide tiles stay, new hints quietly retire.
    if (isLiveRoadExpired()) return;

    if (solveTimerStartedAtMs.value !== null) {
      persistSolveTimerState(true);
    }

    // Archived boards ship their solution paths, so hints compute locally
    // with zero analytics calls (RP0-5). Only the live road asks the server.
    let hint: ReturnType<typeof computeHint>;
    if (options.entryType !== 'live') {
      const optimalPaths = game.value.optimalPaths;
      if (!optimalPaths?.length) return;
      hint = computeHint(optimalPaths, [...pathHistory.value]);
    } else {
      try {
        const res = await sessionApi.requestHint({
          playerUUID: playerUUID.value,
          gameNo: game.value.gameNo,
          puzzleType: game.value.puzzleType,
          sessionId: sessionId.value,
          attemptNumber: attemptNumber.value,
          pathHistory: [...pathHistory.value],
        });
        hint = res.hint;
      } catch {
        // A hint fired right at rotation can be rejected server-side once
        // the road is no longer current; retire quietly like the expiry gate.
        return;
      }
    }

    const existingProgress = localProgress.getGameProgress(
      game.value.gameNo,
      game.value.puzzleType,
      progressScope,
    );

    const hintCopy =
      hint.kind === 'next-step'
        ? UI_COPY.runtime.hintNextStep
        : hint.kind === 'already-solved'
          ? UI_COPY.runtime.hintAlreadySolved
          : UI_COPY.runtime.hintDiverged;

    if (existingProgress.solved) {
      hintsUsed.value += 1;
      guidePath.value =
        hint.guidePath.length >= guidePath.value.length
          ? [...hint.guidePath]
          : [...guidePath.value];
      syncGuideHighlight();
      hintMessage.value = hintCopy;
      return;
    }

    const progress = localProgress.recordHint(
      game.value.gameNo,
      game.value.puzzleType,
      getRoadDayKeyFromPlayableAt(game.value.playableAt),
      hint.guidePath,
      progressScope,
    );

    hintsUsed.value = progress.hintsUsed;
    guidePath.value = [...progress.guidePath];
    syncGuideHighlight();
    hintMessage.value = hintCopy;
  }

  function handlePageExit() {
    pauseSolveTimerForVisibility();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (
      !game.value ||
      ended.value ||
      loading.value ||
      isBoardOverlayOpen.value ||
      currentTileIndex.value === null
    ) {
      return;
    }

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
  });

  onUnmounted(() => {
    handlePageExit();
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('beforeunload', handlePageExit);
    window.removeEventListener('pagehide', handlePageExit);
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
    visited,
    activeSet,
    pathHistory,
    score,
    moves,
    hintMessage,
    hintedTiles,
    guidePath,
    ended,
    loading,
    submitting,
    status,
    lastTier,
    lastMedal,
    lastSolved,
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
    deadEndSignal,
    solveCelebrationSignal,
    clearRoadDay,
    applyRoadDay,
    selectMode,
    switchToExpedition,
    retryCurrentGame,
    moveTo,
    requestHint,
    dismissCelebration,
    continueToExpedition,
    shareCelebrationResult,
    shareCurrentResult,
  };
}
