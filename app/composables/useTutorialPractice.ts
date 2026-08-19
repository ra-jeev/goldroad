import { computed, ref } from 'vue';
import {
  buildEdgeMap,
  getActiveNeighbors,
  getEdgeType,
} from '#shared/utils/puzzleEngine';
import type { Direction, HintResult } from '#shared/types/game';
import { guideHighlightTiles } from '#shared/utils/hints';
import { getNeighborId, parseTileIndex } from '#shared/utils/puzzleEngine';
import { UI_COPY } from '../content/uiCopy';
import { TUTORIAL_PRACTICE_GAME } from '../content/tutorialContent';
import { buildInitialTileStates } from '../utils/boardUtils';
import {
  applyUndoLastStep,
  canUndoLastStep,
  isTextEntryEventTarget,
  isUndoTapTarget,
  nextUndoAvailable,
  shouldHandleUndoKey,
} from '../utils/undoLastStep';

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
  // The practice road is the first board most players ever touch, so it
  // should sound like the real thing rather than being silently different.
  const soundEffects = useSoundEffects();
  const board = TUTORIAL_PRACTICE_GAME.board;
  const initialStatus = UI_COPY.runtime.preRun;
  const tiles = ref(buildInitialTileStates(board));
  const currentTileIndex = ref<number | null>(null);
  const visited = ref<Set<number>>(new Set());
  const activeSet = ref<Set<number>>(new Set());
  const hintedTiles = ref<Set<number>>(new Set());
  // Ordered, so the board can draw the guide as a road with arrows rather
  // than a scatter of lit tiles — same contract as the live board.
  const guidePath = ref<number[]>([]);
  const pathHistory = ref<number[]>([]);
  const score = ref(0);
  const moves = ref(1);
  const ended = ref(false);
  const solved = ref(false);
  const hintsUsed = ref(0);
  const retryCount = ref(0);
  const status = ref<string>(initialStatus);
  // Same contract as the live board: increments whenever a run ends badly,
  // so the board can call out the tile the player stopped on.
  const failSignal = ref(0);
  const hintMessage = ref<string | null>(null);
  const undoAvailable = ref(false);

  const maxScore = computed(() => TUTORIAL_PRACTICE_GAME.maxScore);
  const totalCoins = computed(() => TUTORIAL_PRACTICE_GAME.totalCoins);
  const canRetry = computed(() => ended.value || moves.value > 1);
  const canUndo = computed(() =>
    canUndoLastStep({
      ended: ended.value,
      undoAvailable: undoAvailable.value,
    }),
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

  function syncGuideHighlight(nextGuidePath?: number[]) {
    if (nextGuidePath) guidePath.value = [...nextGuidePath];
    hintedTiles.value = new Set(
      guideHighlightTiles(guidePath.value, pathHistory.value, board.start),
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
        ? 'Fresh road, same rules. Hint is there if you want a nudge.'
        : initialStatus;
    hintMessage.value = null;
    guidePath.value = [];
    undoAvailable.value = nextUndoAvailable('reset', false);
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
    // Mid-run stays quiet, matching the real board's contextual footer.
    // The one practice-only exception: a gentle teaching nudge toward Hint,
    // routed through the hint-message slot so it actually renders mid-run.
    if (hintsUsed.value === 0 && moves.value >= 4) {
      hintMessage.value =
        'If you are unsure which way to go, Hint can show the next useful move.';
    }
  }

  function moveTo(tileIndex: number) {
    if (ended.value || currentTileIndex.value === null) return;
    if (!activeSet.value.has(tileIndex)) {
      // Same take-back as the live board: tap the tile you came from. A spent
      // take-back still buzzes, so the practice board teaches the real rule.
      if (isUndoTapTarget(pathHistory.value, tileIndex) && canUndo.value) {
        undoLastStep();
        return;
      }
      soundEffects.playDeniedMove();
      return;
    }

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
    // The guide survives the move and simply shrinks as the player walks it,
    // matching the live board.
    syncGuideHighlight();
    soundEffects.playMove();

    if (tileIndex === board.end) {
      ended.value = true;
      undoAvailable.value = nextUndoAvailable('move', true);
      solved.value = score.value === maxScore.value;
      activeSet.value = new Set();
      // The solved line doubles as the footer's solve acknowledgement, which
      // is the only thing that fills the reserved message slot once a
      // practice run ends well.
      status.value = solved.value
        ? 'Practice road complete.'
        : `You reached the finish with ${score.value}, but the target is ${maxScore.value}. Try another route.`;
      if (solved.value) {
        soundEffects.playSolve();
      } else {
        failSignal.value += 1;
        soundEffects.playDeadEnd();
      }
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
      undoAvailable.value = nextUndoAvailable('move', true);
      status.value =
        'Dead end. Walk it again to find the way through.';
      failSignal.value += 1;
      soundEffects.playDeadEnd();
      syncTileStates();
      return;
    }

    undoAvailable.value = nextUndoAvailable('move', false);
    updateInRunStatus();
    syncTileStates();
  }

  function undoLastStep() {
    if (!canUndo.value) return;

    const result = applyUndoLastStep(board, {
      pathHistory: pathHistory.value,
      score: score.value,
      moves: moves.value,
    });
    if (!result) return;

    pathHistory.value = result.pathHistory;
    visited.value = result.visited;
    currentTileIndex.value = result.currentTileIndex;
    score.value = result.score;
    moves.value = result.moves;
    activeSet.value = new Set(result.activeNeighbors);
    undoAvailable.value = nextUndoAvailable('undo', false);
    hintMessage.value = null;
    syncGuideHighlight();
    status.value =
      result.pathHistory.length <= 1
        ? retryCount.value > 0
          ? 'Fresh road, same rules. Hint is there if you want a nudge.'
          : initialStatus
        : initialStatus;
    if (result.pathHistory.length > 1) {
      updateInRunStatus();
    }
    soundEffects.playUndo();
    syncTileStates();
  }

  /**
   * Arrow/WASD movement. The live board owns an equivalent handler, but it is
   * gated off while an overlay is open, so the practice board needs its own
   * or the tutorial teaches a control that appears not to work.
   */
  function handleDirectionKey(event: KeyboardEvent): boolean {
    if (currentTileIndex.value === null) return false;

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
      return true;
    }

    if (ended.value) return false;

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
    if (!direction) return false;

    const [row, col] = parseTileIndex(currentTileIndex.value, board.cols);
    const neighbor = getNeighborId(row, col, direction, board.rows, board.cols);
    if (neighbor === null) return false;

    event.preventDefault();
    moveTo(neighbor);
    return true;
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
    guidePath,
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
    canUndo,
    failSignal,
    restartPractice,
    retryPractice,
    undoLastStep,
    moveTo,
    handleDirectionKey,
    requestHint,
  };
}
