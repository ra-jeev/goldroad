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

type EntryType = 'live' | 'archive';

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
  attemptNumber: number;
  solveTimeMs: number | null;
  hintsUsed: number;
  hasExpedition: boolean;
  classicResult: CelebrationModeResult | null;
  expeditionResult: CelebrationModeResult | null;
};

function celebrationTierForMedal(medal: Medal | null): CelebrationTier {
  if (medal === 'gold') return 'gold';
  if (medal) return 'medal';
  return 'relief';
}

type SetupGameOptions = {
  attemptNumber?: number;
  replaySolved?: boolean;
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
  const playerUUID = localProgress.playerUUID;
  const progressScope: LocalProgressScope =
    options.entryType === 'live' ? 'live' : 'replay';
  const maxScore = computed(() => game.value?.maxScore ?? 0);
  const totalCoins = computed(() => game.value?.totalCoins ?? 0);
  const roadHeading = computed(() =>
    game.value ? `Road ${game.value.gameNo}` : 'Road ...',
  );
  const isExpeditionUnlocked = computed(() => {
    if (options.entryType === 'archive') return true;
    if (!availableGames.value.classic) return false;

    const classicProgress = localProgress.getGameProgress(
      availableGames.value.classic.gameNo,
      'classic',
    );
    return classicProgress.solved;
  });
  const classicSolvedToday = computed(() => {
    if (!availableGames.value.classic) return false;

    const classicProgress = localProgress.getGameProgress(
      availableGames.value.classic.gameNo,
      'classic',
    );
    return classicProgress.solved;
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
        tile.tabIndex =
          tile.id === current || activeSet.value.has(tile.id) ? 0 : -1;
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
      solveTimerStartedAtMs.value !== null
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
    const replaySolved = progress.solved && options.replaySolved;
    const hasSolvedHistory = progress.solved;
    const preservedHintsUsed = replaySolved ? 0 : progress.hintsUsed;
    const preservedGuidePath = replaySolved ? [] : [...progress.guidePath];
    const preservedActiveSolveTimeMs = replaySolved
      ? 0
      : progress.activeTimeMs;
    const preservedTimerCanResume = !progress.solved;
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
    status.value = progress.solved && !replaySolved
      ? solvedMedal
        ? UI_COPY.runtime.alreadySolvedWithMedal(
            UI_COPY.boardHeader.medals[solvedMedal],
          )
        : UI_COPY.runtime.alreadySolved
      : UI_COPY.runtime.preRun(next.maxScore);
    lastTier.value = null;
    lastMedal.value = progress.solved && !replaySolved ? solvedMedal : null;
    lastSolved.value = progress.solved && !replaySolved;
    attemptNumber.value = hasSolvedHistory
      ? 1
      : (options.attemptNumber ?? progressAttemptNumber);
    hintsUsed.value = preservedHintsUsed;
    guidePath.value = preservedGuidePath;
    sessionId.value = createSessionId();
    trackingDisabled.value = hasSolvedHistory;
    activeSolveTimeMs.value = progress.solved && !replaySolved
      ? (progress.solveTimeMs ?? 0)
      : preservedActiveSolveTimeMs;
    solveTimerStartedAtMs.value = null;
    solveTimerCanResume.value =
      !progress.solved && preservedTimerCanResume;

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
      (options.entryType === 'archive' || isExpeditionUnlocked.value)
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

  function selectMode(mode: PuzzleType) {
    if (mode === 'expedition' && !isExpeditionUnlocked.value) return;

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
    solveTimeMs: number | null;
    isUntrackedReplay: boolean;
    dayKey: string | null;
  }) {
    if (!game.value) return;

    const current = game.value;
    const mode = current.puzzleType;
    const tier = celebrationTierForMedal(params.medal);
    const attempts = attemptNumber.value;

    // Archive / random replays get a lightweight, non-persisted acknowledgment
    // with no daily-streak or countdown implication.
    if (options.entryType !== 'live') {
      solveCelebrationSignal.value += 1;
      celebration.value = {
        variant: 'replay-solve',
        tier,
        gameNo: current.gameNo,
        puzzleType: mode,
        medal: params.medal,
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
        attemptNumber: attempts,
        solveTimeMs: params.solveTimeMs,
        hintsUsed: hintsUsed.value,
        hasExpedition: Boolean(availableGames.value.expedition),
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

    // Archive replays clear their stored progress on solve, so fall back to the
    // in-session solve state to keep the footer Share affordance working.
    if (!lastSolved.value) return null;

    return resultShare.shareRoadResult({
      gameNo: game.value.gameNo,
      puzzleType: game.value.puzzleType,
      attempts: Math.max(attemptNumber.value, 1),
      solved: true,
      solveTimeMs: null,
      hintsUsed: hintsUsed.value,
    });
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
    submitting.value = !isUntrackedReplay;
    const expeditionWasUnlocked = isExpeditionUnlocked.value;
    const solved = endReason === 'solved';
    const dayKey = getProgressDayKey(game.value);
    const elapsedSolveTimeMs = isUntrackedReplay ? 0 : stopSolveTimer();
    const solveTimeMs = solved ? elapsedSolveTimeMs : null;
    const medal = isUntrackedReplay
      ? null
      : calcMedalForAttempt(attemptNumber.value, solved);
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
        null,
      );
    }
    if (solved) {
      guidePath.value = [];
      hintedTiles.value = new Set();
      triggerCelebration({
        medal,
        solveTimeMs,
        isUntrackedReplay,
        dayKey,
      });
    }

    if (isUntrackedReplay) {
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
    } finally {
      submitting.value = false;
    }
  }

  async function retryCurrentGame() {
    if (!game.value || loading.value) return;
    if (submitting.value && !ended.value) return;
    if (!ended.value && moves.value <= 1 && !lastSolved.value) return;

    const nextAttemptNumber = trackingDisabled.value
      ? attemptNumber.value
      : attemptNumber.value + 1;

    if (!ended.value && !lastSolved.value && !trackingDisabled.value) {
      await finalizeRun('retry');
    }

    setupGame(game.value, {
      attemptNumber: nextAttemptNumber,
      replaySolved: true,
    });
  }

  async function moveTo(tileIndex: number) {
    if (!game.value || ended.value || currentTileIndex.value === null) return;
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

    const delta = game.value.maxScore - nextScore;
    status.value =
      delta === 0
        ? UI_COPY.runtime.exactNowFinish
        : delta > 0
          ? UI_COPY.runtime.needMore(delta)
          : UI_COPY.runtime.overBy(Math.abs(delta));

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

    if (solveTimerStartedAtMs.value !== null) {
      persistSolveTimerState(true);
    }

    const res = await sessionApi.requestHint({
      playerUUID: playerUUID.value,
      gameNo: game.value.gameNo,
      puzzleType: game.value.puzzleType,
      sessionId: sessionId.value,
      attemptNumber: attemptNumber.value,
      pathHistory: [...pathHistory.value],
    });

    const existingProgress = localProgress.getGameProgress(
      game.value.gameNo,
      game.value.puzzleType,
      progressScope,
    );

    if (existingProgress.solved) {
      hintsUsed.value += 1;
      guidePath.value =
        res.hint.guidePath.length >= guidePath.value.length
          ? [...res.hint.guidePath]
          : [...guidePath.value];
      syncGuideHighlight();
      hintMessage.value =
        res.hint.kind === 'next-step'
          ? UI_COPY.runtime.hintNextStep
          : res.hint.kind === 'already-solved'
            ? UI_COPY.runtime.hintAlreadySolved
            : UI_COPY.runtime.hintDiverged;
      return;
    }

    const progress = localProgress.recordHint(
      game.value.gameNo,
      game.value.puzzleType,
      getRoadDayKeyFromPlayableAt(game.value.playableAt),
      res.hint.guidePath,
      progressScope,
    );

    hintsUsed.value = progress.hintsUsed;
    guidePath.value = [...progress.guidePath];
    syncGuideHighlight();
    hintMessage.value =
      res.hint.kind === 'next-step'
        ? UI_COPY.runtime.hintNextStep
        : res.hint.kind === 'already-solved'
          ? UI_COPY.runtime.hintAlreadySolved
          : UI_COPY.runtime.hintDiverged;
  }

  function handlePageExit() {
    pauseSolveTimerForVisibility();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (
      !game.value ||
      ended.value ||
      loading.value ||
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
