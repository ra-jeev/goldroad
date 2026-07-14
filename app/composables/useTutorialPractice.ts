import { computed, ref } from 'vue';
import {
  buildEdgeMap,
  getActiveNeighbors,
  getEdgeType,
} from '../../shared/utils/puzzleEngine';
import type { HintResult } from '../../shared/types/game';
import { UI_COPY } from '../content/uiCopy';
import { TUTORIAL_PRACTICE_GAME } from '../content/tutorialContent';
import { buildInitialTileStates } from '../utils/boardUtils';

function computeTutorialHint(
  optimalPaths: number[][],
  pathHistory: number[],
): HintResult {
  const bestPath = optimalPaths[0] ?? [];
  let matchedPrefixLength = 0;
  const max = Math.min(bestPath.length, pathHistory.length);

  while (
    matchedPrefixLength < max &&
    bestPath[matchedPrefixLength] === pathHistory[matchedPrefixLength]
  ) {
    matchedPrefixLength += 1;
  }

  if (
    matchedPrefixLength === pathHistory.length &&
    matchedPrefixLength < bestPath.length
  ) {
    return {
      kind: 'next-step',
      nextTileIndex: bestPath[matchedPrefixLength]!,
      guidePath: bestPath.slice(0, matchedPrefixLength + 1),
    };
  }

  if (
    matchedPrefixLength === pathHistory.length &&
    matchedPrefixLength === bestPath.length
  ) {
    return {
      kind: 'already-solved',
      guidePath: bestPath.slice(),
    };
  }

  return {
    kind: 'diverged',
    divergenceTileIndex: bestPath[Math.max(0, matchedPrefixLength - 1)] ?? 0,
    correctTileIndex:
      bestPath[matchedPrefixLength] ?? bestPath[bestPath.length - 1] ?? 0,
    guidePath: bestPath.slice(
      0,
      Math.min(bestPath.length, matchedPrefixLength + 1),
    ),
  };
}

export function useTutorialPractice() {
  const board = TUTORIAL_PRACTICE_GAME.board;
  const initialStatus = UI_COPY.runtime.preRun(
    TUTORIAL_PRACTICE_GAME.maxScore,
  );
  const tiles = ref(buildInitialTileStates(board));
  const currentTileIndex = ref<number | null>(null);
  const visited = ref<Set<number>>(new Set());
  const activeSet = ref<Set<number>>(new Set());
  const hintedTiles = ref<Set<number>>(new Set());
  const pathHistory = ref<number[]>([]);
  const score = ref(0);
  const moves = ref(1);
  const ended = ref(false);
  const solved = ref(false);
  const hintsUsed = ref(0);
  const retryCount = ref(0);
  const status = ref(initialStatus);
  const hintMessage = ref<string | null>(null);

  const maxScore = computed(() => TUTORIAL_PRACTICE_GAME.maxScore);
  const totalCoins = computed(() => TUTORIAL_PRACTICE_GAME.totalCoins);
  const canRetry = computed(
    () => ended.value || moves.value > 1 || solved.value,
  );

  function syncTileStates() {
    if (currentTileIndex.value === null) return;

    for (const row of tiles.value) {
      for (const tile of row) {
        tile.done = visited.value.has(tile.id);
        tile.active = activeSet.value.has(tile.id);
        tile.focus = tile.id === currentTileIndex.value;
        tile.tabIndex = tile.id === currentTileIndex.value ? 0 : -1;
      }
    }
  }

  function syncGuideHighlight(guidePath: number[] = []) {
    const traversed = new Set(pathHistory.value);
    hintedTiles.value = new Set(
      guidePath.filter(
        (tileIndex) => tileIndex !== board.start && !traversed.has(tileIndex),
      ),
    );
  }

  function resetPractice() {
    tiles.value = buildInitialTileStates(board);
    currentTileIndex.value = board.start;
    visited.value = new Set([board.start]);
    pathHistory.value = [board.start];
    score.value = board.tiles[board.start] ?? 0;
    moves.value = 1;
    ended.value = false;
    solved.value = false;
    status.value =
      retryCount.value > 0
        ? 'Fresh try. Watch the score, and use Hint if you want a nudge.'
        : initialStatus;
    hintMessage.value = null;
    syncGuideHighlight();

    const edgeMap = buildEdgeMap(board);
    activeSet.value = new Set(
      getActiveNeighbors(
        board.start,
        board.rows,
        board.cols,
        edgeMap,
        visited.value,
      ),
    );
    syncTileStates();
  }

  function retryPractice() {
    retryCount.value += 1;
    resetPractice();
  }

  function restartPractice() {
    retryCount.value = 0;
    hintsUsed.value = 0;
    resetPractice();
  }

  function updateInRunStatus() {
    const remaining = maxScore.value - score.value;

    if (hintsUsed.value === 0 && moves.value >= 4) {
      status.value =
        'If you are unsure which way to go, Hint can show the next useful move.';
      return;
    }

    status.value =
      remaining === 0
        ? 'Target reached. Now find the exit without changing the score.'
        : remaining > 0
          ? `Need ${remaining} more before the exit.`
          : `Over by ${Math.abs(remaining)}. You may need to retry.`;
  }

  function moveTo(tileIndex: number) {
    if (ended.value || currentTileIndex.value === null) return;
    if (!activeSet.value.has(tileIndex)) return;

    const edgeMap = buildEdgeMap(board);
    const edgeType = getEdgeType(currentTileIndex.value, tileIndex, edgeMap);
    let modifier = 0;
    if (edgeType === 'toll') modifier = -board.tollValue;
    if (edgeType === 'bonus') modifier = board.bonusValue;

    visited.value.add(tileIndex);
    pathHistory.value = [...pathHistory.value, tileIndex];
    currentTileIndex.value = tileIndex;
    score.value += (board.tiles[tileIndex] ?? 0) + modifier;
    moves.value += 1;
    hintMessage.value = null;
    syncGuideHighlight();

    if (tileIndex === board.end) {
      ended.value = true;
      solved.value = score.value === maxScore.value;
      activeSet.value = new Set();
      status.value = solved.value
        ? 'Solved. You are ready for today\'s road.'
        : `You reached the exit with ${score.value}, but the target is ${maxScore.value}. Tap Retry and try another route.`;
      syncTileStates();
      return;
    }

    activeSet.value = new Set(
      getActiveNeighbors(
        tileIndex,
        board.rows,
        board.cols,
        edgeMap,
        visited.value,
      ),
    );

    if (activeSet.value.size === 0) {
      ended.value = true;
      status.value =
        'Dead end. Tap Retry to replay this road and try a different path.';
      syncTileStates();
      return;
    }

    updateInRunStatus();
    syncTileStates();
  }

  function requestHint() {
    if (ended.value || solved.value) return;

    const hint = computeTutorialHint(
      TUTORIAL_PRACTICE_GAME.optimalPaths,
      pathHistory.value,
    );

    hintsUsed.value += 1;
    syncGuideHighlight(hint.guidePath);
    hintMessage.value =
      hint.kind === 'next-step'
        ? UI_COPY.runtime.hintNextStep
        : hint.kind === 'already-solved'
          ? UI_COPY.runtime.hintAlreadySolved
        : UI_COPY.runtime.hintDiverged;
  }

  resetPractice();

  return {
    game: TUTORIAL_PRACTICE_GAME,
    board,
    tiles,
    currentTileIndex,
    visited,
    activeSet,
    hintedTiles,
    pathHistory,
    score,
    moves,
    ended,
    solved,
    hintsUsed,
    status,
    hintMessage,
    maxScore,
    totalCoins,
    canRetry,
    restartPractice,
    retryPractice,
    moveTo,
    requestHint,
  };
}
