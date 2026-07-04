import { computed } from 'vue';
import type { PuzzleType } from '../../shared/types/game';
import {
  useGoldroadLocalState,
  type LocalProgressScope,
  type LocalPuzzleProgress,
} from './useGoldroadLocalState';

export type LocalGameProgressRecord = LocalPuzzleProgress;

export function useLocalGameProgress() {
  const localState = useGoldroadLocalState();

  function load() {
    localState.load();
  }

  function getGameProgress(
    gameNo: number,
    puzzleType: PuzzleType,
    scope: LocalProgressScope = 'live',
  ): LocalGameProgressRecord {
    return localState.getPuzzleProgress(gameNo, puzzleType, scope);
  }

  function recordHint(
    gameNo: number,
    puzzleType: PuzzleType,
    day: string,
    guidePath: number[],
    scope: LocalProgressScope = 'live',
  ) {
    return localState.recordHint({
      gameNo,
      puzzleType,
      day,
      guidePath,
      scope,
    });
  }

  function setSolveTimerState(
    gameNo: number,
    puzzleType: PuzzleType,
    day: string,
    activeTimeMs: number,
    timerStartedAt: string | null,
    scope: LocalProgressScope = 'live',
  ) {
    return localState.setSolveTimerState({
      gameNo,
      puzzleType,
      day,
      activeTimeMs,
      timerStartedAt,
      scope,
    });
  }

  function recordRun(
    gameNo: number,
    puzzleType: PuzzleType,
    day: string,
    attemptNumber: number,
    solved: boolean,
    solveTimeMs: number | null = null,
    scope: LocalProgressScope = 'live',
    activeTimeMs?: number,
    timerStartedAt?: string | null,
  ) {
    return localState.recordRun({
      gameNo,
      puzzleType,
      day,
      attemptNumber,
      solved,
      solveTimeMs,
      scope,
      activeTimeMs,
      timerStartedAt,
    });
  }

  return {
    state: computed(() => localState.state.value),
    playerUUID: localState.playerUUID,
    currentRoadContext: localState.currentRoadContext,
    load,
    getGameProgress,
    recordHint,
    setSolveTimerState,
    recordRun,
    setCurrentRoadContext: localState.setCurrentRoadContext,
    hasCelebratedSolve: localState.hasCelebratedSolve,
    markSolveCelebrated: localState.markSolveCelebrated,
  };
}
