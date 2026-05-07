import { computed } from 'vue';
import type { PuzzleType } from '../../shared/types/game';

const STORAGE_KEY = 'goldroad-state-v2';
const STORAGE_VERSION = 2 as const;
const FALLBACK_UUID = '00000000-0000-4000-8000-000000000000';
const LEGACY_STORAGE_KEYS = [
  'goldroad-progress-v1',
  'goldroad-player-stats-v1',
  'goldroad-player-uuid',
] as const;
const LEGACY_STORAGE_PREFIXES = [
  'goldroad-classic-solved-',
  'goldroad-classic-exact-',
  'goldroad-classic-gold-',
  'goldroad-classic-completed-',
] as const;

export type LocalPuzzleProgress = {
  attempts: number;
  solved: boolean;
  hintsUsed: number;
  solveTimeMs: number | null;
  guidePath: number[];
};

type PuzzleProgressRecord = LocalPuzzleProgress & {
  day: string;
  gameNo: number;
  puzzleType: PuzzleType;
  updatedAt: string;
};

type HistoryModeRecord = {
  attempts: number;
  solved: boolean;
  hintsUsed: number;
  solveTimeMs: number | null;
  updatedAt: string;
};

type HistoryDayRecord = {
  day: string;
  gameNo: number;
  modes: Partial<Record<PuzzleType, HistoryModeRecord>>;
};

type CurrentRoadContext = {
  currentGameNo: number | null;
  currentDay: string | null;
  selectedMode: PuzzleType | null;
};

type TutorialState = {
  completed: boolean;
  lastSeenAt: string | null;
};

type GoldroadLocalState = {
  version: typeof STORAGE_VERSION;
  playerUUID: string;
  settings: Record<string, never>;
  currentRoadContext: CurrentRoadContext;
  puzzleProgressByKey: Record<string, PuzzleProgressRecord>;
  historyByDay: Record<string, HistoryDayRecord>;
  tutorialState: TutorialState;
};

function isPuzzleType(value: unknown): value is PuzzleType {
  return value === 'classic' || value === 'expedition';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'number');
}

function isValidLocalPuzzleProgress(value: unknown): value is LocalPuzzleProgress {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as LocalPuzzleProgress;
  return (
    typeof candidate.attempts === 'number' &&
    typeof candidate.solved === 'boolean' &&
    typeof candidate.hintsUsed === 'number' &&
    isNullableNumber(candidate.solveTimeMs) &&
    isNumberArray(candidate.guidePath)
  );
}

function isValidPuzzleProgressRecord(value: unknown): value is PuzzleProgressRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as PuzzleProgressRecord;
  return (
    isValidLocalPuzzleProgress(candidate) &&
    typeof candidate.day === 'string' &&
    typeof candidate.gameNo === 'number' &&
    isPuzzleType(candidate.puzzleType) &&
    typeof candidate.updatedAt === 'string'
  );
}

function isValidHistoryModeRecord(value: unknown): value is HistoryModeRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as HistoryModeRecord;
  return (
    typeof candidate.attempts === 'number' &&
    typeof candidate.solved === 'boolean' &&
    typeof candidate.hintsUsed === 'number' &&
    isNullableNumber(candidate.solveTimeMs) &&
    typeof candidate.updatedAt === 'string'
  );
}

function isValidHistoryDayRecord(value: unknown): value is HistoryDayRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as HistoryDayRecord;
  return (
    typeof candidate.day === 'string' &&
    typeof candidate.gameNo === 'number' &&
    !!candidate.modes &&
    typeof candidate.modes === 'object' &&
    Object.entries(candidate.modes).every(([puzzleType, modeRecord]) => {
      if (!isPuzzleType(puzzleType)) return false;
      return modeRecord === undefined || isValidHistoryModeRecord(modeRecord);
    })
  );
}

function isValidCurrentRoadContext(value: unknown): value is CurrentRoadContext {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as CurrentRoadContext;
  return (
    isNullableNumber(candidate.currentGameNo) &&
    isNullableString(candidate.currentDay) &&
    (candidate.selectedMode === null || isPuzzleType(candidate.selectedMode))
  );
}

function isValidTutorialState(value: unknown): value is TutorialState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as TutorialState;
  return (
    typeof candidate.completed === 'boolean' &&
    isNullableString(candidate.lastSeenAt)
  );
}

function isValidGoldroadLocalState(value: unknown): value is GoldroadLocalState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as GoldroadLocalState;
  return (
    candidate.version === STORAGE_VERSION &&
    typeof candidate.playerUUID === 'string' &&
    !!candidate.settings &&
    typeof candidate.settings === 'object' &&
    isValidCurrentRoadContext(candidate.currentRoadContext) &&
    !!candidate.puzzleProgressByKey &&
    typeof candidate.puzzleProgressByKey === 'object' &&
    Object.values(candidate.puzzleProgressByKey).every(isValidPuzzleProgressRecord) &&
    !!candidate.historyByDay &&
    typeof candidate.historyByDay === 'object' &&
    Object.values(candidate.historyByDay).every(isValidHistoryDayRecord) &&
    isValidTutorialState(candidate.tutorialState)
  );
}

function createPlayerUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return FALLBACK_UUID;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildPuzzleKey(gameNo: number, puzzleType: PuzzleType): string {
  return `${puzzleType}:${gameNo}`;
}

function createEmptyLocalPuzzleProgress(): LocalPuzzleProgress {
  return {
    attempts: 0,
    solved: false,
    hintsUsed: 0,
    solveTimeMs: null,
    guidePath: [],
  };
}

function createPuzzleProgressRecord(
  gameNo: number,
  puzzleType: PuzzleType,
  day: string,
): PuzzleProgressRecord {
  return {
    ...createEmptyLocalPuzzleProgress(),
    day,
    gameNo,
    puzzleType,
    updatedAt: nowIso(),
  };
}

function createEmptyState(playerUUID = createPlayerUUID()): GoldroadLocalState {
  return {
    version: STORAGE_VERSION,
    playerUUID,
    settings: {},
    currentRoadContext: {
      currentGameNo: null,
      currentDay: null,
      selectedMode: null,
    },
    puzzleProgressByKey: {},
    historyByDay: {},
    tutorialState: {
      completed: false,
      lastSeenAt: null,
    },
  };
}

function toLocalPuzzleProgress(
  progress: PuzzleProgressRecord | LocalPuzzleProgress,
): LocalPuzzleProgress {
  return {
    attempts: progress.attempts,
    solved: progress.solved,
    hintsUsed: progress.hintsUsed,
    solveTimeMs: progress.solveTimeMs,
    guidePath: [...progress.guidePath],
  };
}

function upsertHistoryEntry(
  nextState: GoldroadLocalState,
  progress: PuzzleProgressRecord,
) {
  const currentDay = nextState.historyByDay[progress.day] ?? {
    day: progress.day,
    gameNo: progress.gameNo,
    modes: {},
  };

  nextState.historyByDay[progress.day] = {
    ...currentDay,
    gameNo: progress.gameNo,
    modes: {
      ...currentDay.modes,
      [progress.puzzleType]: {
        attempts: progress.attempts,
        solved: progress.solved,
        hintsUsed: progress.hintsUsed,
        solveTimeMs: progress.solveTimeMs,
        updatedAt: progress.updatedAt,
      },
    },
  };
}

function removeLegacyKeys() {
  if (typeof window === 'undefined') return;

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (!key || key === STORAGE_KEY) continue;

    if (
      LEGACY_STORAGE_KEYS.includes(key as (typeof LEGACY_STORAGE_KEYS)[number]) ||
      LEGACY_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
    ) {
      window.localStorage.removeItem(key);
    }
  }
}

export function getRoadDayKeyFromPlayableAt(playableAt: string): string {
  return playableAt.split('T')[0] ?? playableAt;
}

export function useGoldroadLocalState() {
  const state = useState<GoldroadLocalState | null>(
    'goldroad-local-state',
    () => null,
  );

  function persist() {
    if (typeof window === 'undefined' || !state.value) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value));
  }

  function load() {
    if (typeof window === 'undefined') {
      state.value = createEmptyState(FALLBACK_UUID);
      return state.value;
    }

    removeLegacyKeys();

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.value = createEmptyState();
      persist();
      return state.value;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      state.value = isValidGoldroadLocalState(parsed)
        ? parsed
        : createEmptyState();
    } catch {
      state.value = createEmptyState();
    }

    persist();
    return state.value;
  }

  function ensureLoaded(): GoldroadLocalState {
    if (!state.value) {
      const loaded = load();
      if (loaded) {
        return loaded;
      }
    }

    return state.value ?? createEmptyState(FALLBACK_UUID);
  }

  function updatePuzzleProgress(
    gameNo: number,
    puzzleType: PuzzleType,
    day: string,
    updater: (progress: PuzzleProgressRecord) => PuzzleProgressRecord,
  ): LocalPuzzleProgress {
    const nextState = ensureLoaded();
    const key = buildPuzzleKey(gameNo, puzzleType);
    const existing = nextState.puzzleProgressByKey[key];
    const current =
      existing && existing.day === day
        ? existing
        : createPuzzleProgressRecord(gameNo, puzzleType, day);
    const updated = updater({
      ...current,
      guidePath: [...current.guidePath],
    });

    nextState.puzzleProgressByKey[key] = updated;
    upsertHistoryEntry(nextState, updated);

    state.value = {
      ...nextState,
      currentRoadContext: {
        ...nextState.currentRoadContext,
      },
      puzzleProgressByKey: {
        ...nextState.puzzleProgressByKey,
      },
      historyByDay: {
        ...nextState.historyByDay,
      },
      tutorialState: {
        ...nextState.tutorialState,
      },
    };
    persist();

    return toLocalPuzzleProgress(updated);
  }

  function getPuzzleProgress(
    gameNo: number,
    puzzleType: PuzzleType,
  ): LocalPuzzleProgress {
    const nextState = ensureLoaded();
    const key = buildPuzzleKey(gameNo, puzzleType);
    const progress = nextState.puzzleProgressByKey[key];
    return progress ? toLocalPuzzleProgress(progress) : createEmptyLocalPuzzleProgress();
  }

  function recordHint(options: {
    gameNo: number;
    puzzleType: PuzzleType;
    day: string;
    guidePath: number[];
  }): LocalPuzzleProgress {
    return updatePuzzleProgress(
      options.gameNo,
      options.puzzleType,
      options.day,
      (progress) => {
        if (progress.solved) {
          return progress;
        }

        return {
          ...progress,
          hintsUsed: progress.hintsUsed + 1,
          guidePath:
            options.guidePath.length >= progress.guidePath.length
              ? [...options.guidePath]
              : [...progress.guidePath],
          updatedAt: nowIso(),
        };
      },
    );
  }

  function recordRun(options: {
    gameNo: number;
    puzzleType: PuzzleType;
    day: string;
    attemptNumber: number;
    solved: boolean;
    solveTimeMs?: number | null;
  }): LocalPuzzleProgress {
    return updatePuzzleProgress(
      options.gameNo,
      options.puzzleType,
      options.day,
      (progress) => ({
        ...progress,
        attempts: progress.solved
          ? progress.attempts
          : Math.max(progress.attempts, options.attemptNumber),
        solved: progress.solved || options.solved,
        solveTimeMs:
          progress.solveTimeMs ?? (options.solved ? options.solveTimeMs ?? null : null),
        guidePath: options.solved ? [] : [...progress.guidePath],
        updatedAt: nowIso(),
      }),
    );
  }

  function setCurrentRoadContext(update: Partial<CurrentRoadContext>) {
    const nextState = ensureLoaded();
    nextState.currentRoadContext = {
      ...nextState.currentRoadContext,
      ...update,
    };

    state.value = {
      ...nextState,
      currentRoadContext: {
        ...nextState.currentRoadContext,
      },
      puzzleProgressByKey: {
        ...nextState.puzzleProgressByKey,
      },
      historyByDay: {
        ...nextState.historyByDay,
      },
      tutorialState: {
        ...nextState.tutorialState,
      },
    };
    persist();
  }

  return {
    state,
    load,
    playerUUID: computed(() => ensureLoaded().playerUUID),
    currentRoadContext: computed(() => ensureLoaded().currentRoadContext),
    getPuzzleProgress,
    recordHint,
    recordRun,
    setCurrentRoadContext,
  };
}
