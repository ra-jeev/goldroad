import { ref } from 'vue';
import type { PuzzleType } from '../../shared/types/game';

const STORAGE_KEY = 'goldroad-progress-v1';

export type LocalGameProgressRecord = {
  attempts: number;
  solved: boolean;
  hintsUsed: number;
  guidePath: number[];
};

type LocalProgressState = {
  playerUUID: string;
  day: string;
  games: Record<string, LocalGameProgressRecord>;
};

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]!;
}

function createEmptyGameProgress(): LocalGameProgressRecord {
  return {
    attempts: 0,
    solved: false,
    hintsUsed: 0,
    guidePath: [],
  };
}

function createEmptyState(playerUUID: string): LocalProgressState {
  return {
    playerUUID,
    day: getTodayKey(),
    games: {},
  };
}

function buildGameKey(gameNo: number, puzzleType: PuzzleType): string {
  return `${puzzleType}:${gameNo}`;
}

function isValidGameProgressRecord(
  value: unknown,
): value is LocalGameProgressRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as LocalGameProgressRecord;
  return (
    typeof candidate.attempts === 'number' &&
    typeof candidate.solved === 'boolean' &&
    typeof candidate.hintsUsed === 'number' &&
    Array.isArray(candidate.guidePath) &&
    candidate.guidePath.every((tileIndex) => typeof tileIndex === 'number')
  );
}

function isValidState(value: unknown): value is LocalProgressState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as LocalProgressState;
  return (
    typeof candidate.playerUUID === 'string' &&
    typeof candidate.day === 'string' &&
    !!candidate.games &&
    typeof candidate.games === 'object' &&
    Object.values(candidate.games).every(isValidGameProgressRecord)
  );
}

export function useLocalGameProgress() {
  const state = ref<LocalProgressState | null>(null);

  function persistCurrentState() {
    if (typeof window === 'undefined' || !state.value) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value));
  }

  function load(playerUUID: string) {
    if (typeof window === 'undefined') {
      state.value = createEmptyState(playerUUID);
      return;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.value = createEmptyState(playerUUID);
      persistCurrentState();
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        !isValidState(parsed) ||
        parsed.playerUUID !== playerUUID ||
        parsed.day !== getTodayKey()
      ) {
        state.value = createEmptyState(playerUUID);
        persistCurrentState();
        return;
      }

      state.value = parsed;
    } catch {
      state.value = createEmptyState(playerUUID);
      persistCurrentState();
    }
  }

  function ensureLoaded(playerUUID: string): LocalProgressState {
    if (
      !state.value ||
      state.value.playerUUID !== playerUUID ||
      state.value.day !== getTodayKey()
    ) {
      load(playerUUID);
    }

    return state.value ?? createEmptyState(playerUUID);
  }

  function getGameProgress(
    gameNo: number,
    puzzleType: PuzzleType,
  ): LocalGameProgressRecord {
    if (!state.value) return createEmptyGameProgress();
    const key = buildGameKey(gameNo, puzzleType);
    return state.value.games[key] ?? createEmptyGameProgress();
  }

  function updateGameProgress(
    playerUUID: string,
    gameNo: number,
    puzzleType: PuzzleType,
    updater: (progress: LocalGameProgressRecord) => LocalGameProgressRecord,
  ): LocalGameProgressRecord {
    const nextState = ensureLoaded(playerUUID);
    const key = buildGameKey(gameNo, puzzleType);
    const current = nextState.games[key] ?? createEmptyGameProgress();
    const updated = updater({
      ...current,
      guidePath: [...current.guidePath],
    });

    nextState.games[key] = updated;
    state.value = {
      ...nextState,
      games: {
        ...nextState.games,
      },
    };
    persistCurrentState();
    return updated;
  }

  function recordHint(
    playerUUID: string,
    gameNo: number,
    puzzleType: PuzzleType,
    guidePath: number[],
  ) {
    return updateGameProgress(playerUUID, gameNo, puzzleType, (progress) => {
      if (progress.solved) {
        return progress;
      }

      return {
        ...progress,
        hintsUsed: progress.hintsUsed + 1,
        guidePath:
          guidePath.length >= progress.guidePath.length
            ? [...guidePath]
            : [...progress.guidePath],
      };
    });
  }

  function recordRun(
    playerUUID: string,
    gameNo: number,
    puzzleType: PuzzleType,
    attemptNumber: number,
    solved: boolean,
  ) {
    return updateGameProgress(playerUUID, gameNo, puzzleType, (progress) => ({
      attempts: progress.solved
        ? progress.attempts
        : Math.max(progress.attempts, attemptNumber),
      solved: progress.solved || solved,
      hintsUsed: progress.hintsUsed,
      guidePath: solved ? [] : [...progress.guidePath],
    }));
  }

  return {
    state,
    load,
    getGameProgress,
    recordHint,
    recordRun,
  };
}
