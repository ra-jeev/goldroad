import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
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

type EntryType = 'live' | 'archive';

type SetupGameOptions = {
  attemptNumber?: number;
  preserveSession?: boolean;
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

  const playerUUID = localProgress.playerUUID;
  const progressScope: LocalProgressScope =
    options.entryType === 'live' ? 'live' : 'replay';
  const maxScore = computed(() => game.value?.maxScore ?? 0);
  const totalCoins = computed(() => game.value?.totalCoins ?? 0);
  const completionPercent = computed(() => {
    if (!maxScore.value) return 0;
    return Math.min(100, Math.round((score.value / maxScore.value) * 100));
  });
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

  function setupGame(next: PublicGame, options: SetupGameOptions = {}) {
    const progress = localProgress.getGameProgress(
      next.gameNo,
      next.puzzleType,
      progressScope,
    );
    const progressAttemptNumber = progress.solved
      ? Math.max(progress.attempts, 1)
      : progress.attempts + 1;
    const preservedHintsUsed = options.preserveSession
      ? hintsUsed.value
      : progress.hintsUsed;
    const preservedGuidePath = options.preserveSession
      ? [...guidePath.value]
      : [...progress.guidePath];
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
    status.value = progress.solved
      ? solvedMedal
        ? UI_COPY.runtime.alreadySolvedWithMedal(
            UI_COPY.boardHeader.medals[solvedMedal],
          )
        : UI_COPY.runtime.alreadySolved
      : UI_COPY.runtime.preRun(next.maxScore);
    lastTier.value = null;
    lastMedal.value = solvedMedal;
    lastSolved.value = progress.solved;
    attemptNumber.value = options.attemptNumber ?? progressAttemptNumber;
    hintsUsed.value = preservedHintsUsed;
    guidePath.value = preservedGuidePath;
    sessionId.value =
      options.preserveSession && sessionId.value
        ? sessionId.value
        : createSessionId();

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

    setupGame(next);
  }

  function switchToExpedition() {
    if (!availableGames.value.expedition || !isExpeditionUnlocked.value) return;
    selectMode('expedition');
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

    submitting.value = true;
    const expeditionWasUnlocked = isExpeditionUnlocked.value;
    const solved = endReason === 'solved';
    const medal = calcMedalForAttempt(attemptNumber.value, solved);
    const tier: OutcomeTier =
      medal ?? (endReason === 'wrong-exit' ? 'finished' : 'unfinished');

    lastSolved.value = solved;
    lastMedal.value = medal;
    lastTier.value = tier;
    expeditionJustUnlocked.value =
      options.entryType === 'live' &&
      selectedMode.value === 'classic' &&
      solved &&
      !expeditionWasUnlocked &&
      Boolean(availableGames.value.expedition);

    localProgress.recordRun(
      game.value.gameNo,
      game.value.puzzleType,
      getRoadDayKeyFromPlayableAt(game.value.playableAt),
      attemptNumber.value,
      solved,
      null,
      progressScope,
    );
    if (solved) {
      guidePath.value = [];
      hintedTiles.value = new Set();
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
      });
    } finally {
      submitting.value = false;
    }
  }

  async function retryCurrentGame() {
    if (!game.value || loading.value || submitting.value) return;
    if (!ended.value && moves.value <= 1) return;

    const nextAttemptNumber = attemptNumber.value + 1;

    if (!ended.value) {
      await finalizeRun('retry');
    }

    setupGame(game.value, {
      attemptNumber: nextAttemptNumber,
      preserveSession: true,
    });
  }

  async function moveTo(tileIndex: number) {
    if (!game.value || ended.value || currentTileIndex.value === null) return;
    if (!activeSet.value.has(tileIndex)) return;

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

    updateTileStates();
  }

  async function requestHint() {
    if (!game.value || ended.value || !playerUUID.value || !sessionId.value) {
      return;
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
        : UI_COPY.runtime.hintDiverged;
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
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
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
    playerUUID,
    maxScore,
    totalCoins,
    completionPercent,
    roadHeading,
    isExpeditionUnlocked,
    classicSolvedToday,
    clearRoadDay,
    applyRoadDay,
    selectMode,
    switchToExpedition,
    retryCurrentGame,
    moveTo,
    requestHint,
  };
}
