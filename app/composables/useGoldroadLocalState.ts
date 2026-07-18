import { computed } from 'vue';
import { StorageSerializers, useStorage } from '@vueuse/core';
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

export type LocalProgressScope = 'live' | 'replay';

export type LocalPuzzleProgress = {
  attempts: number;
  solved: boolean;
  hintsUsed: number;
  solveTimeMs: number | null;
  activeTimeMs: number;
  timerStartedAt: string | null;
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

export type HistoryDayRecord = {
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

type GoldroadSettings = {
  muted: boolean;
};

/**
 * Archive completion is deliberately minimal: just "this mode of this road
 * was solved at some point". No attempts, no times, no medals — it feeds
 * only the Past Roads calendar and archive solved/unlock presentation,
 * never medals, streaks, or stats (RP0-5).
 */
export type ArchiveCompletionRecord = Partial<Record<PuzzleType, true>>;

type GoldroadLocalState = {
  version: typeof STORAGE_VERSION;
  playerUUID: string;
  settings: GoldroadSettings;
  currentRoadContext: CurrentRoadContext;
  puzzleProgressByKey: Record<string, PuzzleProgressRecord>;
  replayProgressByKey: Record<string, PuzzleProgressRecord>;
  historyByDay: Record<string, HistoryDayRecord>;
  archiveCompletionByGame: Record<string, ArchiveCompletionRecord>;
  tutorialState: TutorialState;
  celebratedSolveKeys: string[];
  v1NoticeDismissed: boolean;
  lastAcknowledgedUpdateId: string | null;
};

function isPuzzleType(value: unknown): value is PuzzleType {
  return value === 'classic' || value === 'expedition';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'number')
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  );
}

function isValidLocalPuzzleProgress(
  value: unknown,
): value is LocalPuzzleProgress {
  if (!isPlainObject(value)) return false;

  return (
    typeof value.attempts === 'number' &&
    typeof value.solved === 'boolean' &&
    typeof value.hintsUsed === 'number' &&
    isNullableNumber(value.solveTimeMs) &&
    typeof value.activeTimeMs === 'number' &&
    isNullableString(value.timerStartedAt) &&
    isNumberArray(value.guidePath)
  );
}

function isValidPuzzleProgressRecord(
  value: unknown,
): value is PuzzleProgressRecord {
  if (!isPlainObject(value) || !isValidLocalPuzzleProgress(value)) return false;

  const candidate = value as Partial<PuzzleProgressRecord>;
  return (
    typeof candidate.day === 'string' &&
    typeof candidate.gameNo === 'number' &&
    isPuzzleType(candidate.puzzleType) &&
    typeof candidate.updatedAt === 'string'
  );
}

function isValidPuzzleProgressMap(
  value: unknown,
): value is Record<string, PuzzleProgressRecord> {
  return (
    isPlainObject(value) &&
    Object.values(value).every(isValidPuzzleProgressRecord)
  );
}

function normalizeStoredPuzzleProgressRecord(
  value: unknown,
): PuzzleProgressRecord | null {
  if (!isPlainObject(value)) return null;

  const attempts = value.attempts;
  const solved = value.solved;
  const hintsUsed = value.hintsUsed;
  const solveTimeMs = value.solveTimeMs;
  const activeTimeMs = value.activeTimeMs;
  const timerStartedAt = value.timerStartedAt;
  const guidePath = value.guidePath;
  const day = value.day;
  const gameNo = value.gameNo;
  const puzzleType = value.puzzleType;
  const updatedAt = value.updatedAt;

  if (
    typeof attempts !== 'number' ||
    typeof solved !== 'boolean' ||
    typeof hintsUsed !== 'number' ||
    !isNullableNumber(solveTimeMs) ||
    !isNumberArray(guidePath) ||
    typeof day !== 'string' ||
    typeof gameNo !== 'number' ||
    !isPuzzleType(puzzleType) ||
    typeof updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    attempts,
    solved,
    hintsUsed,
    solveTimeMs,
    activeTimeMs: typeof activeTimeMs === 'number' ? activeTimeMs : 0,
    timerStartedAt: isNullableString(timerStartedAt) ? timerStartedAt : null,
    guidePath: [...guidePath],
    day,
    gameNo,
    puzzleType,
    updatedAt,
  };
}

function normalizeStoredPuzzleProgressMap(
  value: unknown,
): Record<string, PuzzleProgressRecord> | null {
  if (!isPlainObject(value)) return null;

  const normalizedEntries = Object.entries(value).map(([key, progress]) => {
    const normalized = normalizeStoredPuzzleProgressRecord(progress);
    return normalized ? ([key, normalized] as const) : null;
  });

  if (normalizedEntries.some((entry) => entry === null)) {
    return null;
  }

  return Object.fromEntries(
    normalizedEntries as Array<readonly [string, PuzzleProgressRecord]>,
  );
}

function isValidHistoryModeRecord(value: unknown): value is HistoryModeRecord {
  if (!isPlainObject(value)) return false;

  return (
    typeof value.attempts === 'number' &&
    typeof value.solved === 'boolean' &&
    typeof value.hintsUsed === 'number' &&
    isNullableNumber(value.solveTimeMs) &&
    typeof value.updatedAt === 'string'
  );
}

function isValidHistoryDayRecord(value: unknown): value is HistoryDayRecord {
  if (!isPlainObject(value) || !isPlainObject(value.modes)) return false;

  return (
    typeof value.day === 'string' &&
    typeof value.gameNo === 'number' &&
    Object.entries(value.modes).every(([puzzleType, modeRecord]) => {
      if (!isPuzzleType(puzzleType)) return false;
      return modeRecord === undefined || isValidHistoryModeRecord(modeRecord);
    })
  );
}

function isValidHistoryByDayMap(
  value: unknown,
): value is Record<string, HistoryDayRecord> {
  return (
    isPlainObject(value) && Object.values(value).every(isValidHistoryDayRecord)
  );
}

function isValidCurrentRoadContext(
  value: unknown,
): value is CurrentRoadContext {
  if (!isPlainObject(value)) return false;

  return (
    isNullableNumber(value.currentGameNo) &&
    isNullableString(value.currentDay) &&
    (value.selectedMode === null || isPuzzleType(value.selectedMode))
  );
}

function isValidTutorialState(value: unknown): value is TutorialState {
  if (!isPlainObject(value)) return false;

  return (
    typeof value.completed === 'boolean' && isNullableString(value.lastSeenAt)
  );
}

function normalizeStoredSettings(value: unknown): GoldroadSettings | null {
  if (!isPlainObject(value)) return null;

  return {
    muted: typeof value.muted === 'boolean' ? value.muted : false,
  };
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

export function buildCelebrationKey(
  gameNo: number,
  puzzleType: PuzzleType,
  day: string,
): string {
  return `${puzzleType}:${gameNo}:${day}`;
}

function createEmptyLocalPuzzleProgress(): LocalPuzzleProgress {
  return {
    attempts: 0,
    solved: false,
    hintsUsed: 0,
    solveTimeMs: null,
    activeTimeMs: 0,
    timerStartedAt: null,
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
    settings: {
      muted: false,
    },
    currentRoadContext: {
      currentGameNo: null,
      currentDay: null,
      selectedMode: null,
    },
    puzzleProgressByKey: {},
    replayProgressByKey: {},
    historyByDay: {},
    archiveCompletionByGame: {},
    tutorialState: {
      completed: false,
      lastSeenAt: null,
    },
    celebratedSolveKeys: [],
    v1NoticeDismissed: false,
    lastAcknowledgedUpdateId: null,
  };
}

function cloneLocalPuzzleProgress(
  progress: LocalPuzzleProgress,
): LocalPuzzleProgress {
  return {
    attempts: progress.attempts,
    solved: progress.solved,
    hintsUsed: progress.hintsUsed,
    solveTimeMs: progress.solveTimeMs,
    activeTimeMs: progress.activeTimeMs,
    timerStartedAt: progress.timerStartedAt,
    guidePath: [...progress.guidePath],
  };
}

function clonePuzzleProgressRecord(
  progress: PuzzleProgressRecord,
): PuzzleProgressRecord {
  return {
    ...cloneLocalPuzzleProgress(progress),
    day: progress.day,
    gameNo: progress.gameNo,
    puzzleType: progress.puzzleType,
    updatedAt: progress.updatedAt,
  };
}

function clonePuzzleProgressMap(
  value: Record<string, PuzzleProgressRecord>,
): Record<string, PuzzleProgressRecord> {
  return Object.fromEntries(
    Object.entries(value).map(([key, progress]) => [
      key,
      clonePuzzleProgressRecord(progress),
    ]),
  );
}

function cloneHistoryModeRecord(value: HistoryModeRecord): HistoryModeRecord {
  return {
    attempts: value.attempts,
    solved: value.solved,
    hintsUsed: value.hintsUsed,
    solveTimeMs: value.solveTimeMs,
    updatedAt: value.updatedAt,
  };
}

function cloneHistoryDayRecord(value: HistoryDayRecord): HistoryDayRecord {
  return {
    day: value.day,
    gameNo: value.gameNo,
    modes: Object.fromEntries(
      Object.entries(value.modes).map(([puzzleType, modeRecord]) => [
        puzzleType,
        modeRecord ? cloneHistoryModeRecord(modeRecord) : undefined,
      ]),
    ) as HistoryDayRecord['modes'],
  };
}

function cloneHistoryByDayMap(
  value: Record<string, HistoryDayRecord>,
): Record<string, HistoryDayRecord> {
  return Object.fromEntries(
    Object.entries(value).map(([day, record]) => [
      day,
      cloneHistoryDayRecord(record),
    ]),
  );
}

function cloneArchiveCompletionMap(
  value: Record<string, ArchiveCompletionRecord>,
): Record<string, ArchiveCompletionRecord> {
  return Object.fromEntries(
    Object.entries(value).map(([gameNo, record]) => [gameNo, { ...record }]),
  );
}

/**
 * Tolerant sanitizer: keep only well-formed entries so corrupted or
 * hand-edited storage degrades to "not completed" rather than wedging load.
 */
export function normalizeStoredArchiveCompletionMap(
  value: unknown,
): Record<string, ArchiveCompletionRecord> {
  if (!isPlainObject(value)) return {};

  const normalized: Record<string, ArchiveCompletionRecord> = {};
  for (const [gameNo, record] of Object.entries(value)) {
    if (!/^\d+$/.test(gameNo) || !isPlainObject(record)) continue;

    const entry: ArchiveCompletionRecord = {};
    if (record.classic === true) entry.classic = true;
    if (record.expedition === true) entry.expedition = true;
    if (entry.classic || entry.expedition) {
      normalized[gameNo] = entry;
    }
  }

  return normalized;
}

function cloneState(value: GoldroadLocalState): GoldroadLocalState {
  return {
    version: STORAGE_VERSION,
    playerUUID: value.playerUUID,
    settings: {
      muted: value.settings.muted,
    },
    currentRoadContext: {
      ...value.currentRoadContext,
    },
    puzzleProgressByKey: clonePuzzleProgressMap(value.puzzleProgressByKey),
    replayProgressByKey: clonePuzzleProgressMap(value.replayProgressByKey),
    historyByDay: cloneHistoryByDayMap(value.historyByDay),
    archiveCompletionByGame: cloneArchiveCompletionMap(
      value.archiveCompletionByGame,
    ),
    tutorialState: {
      ...value.tutorialState,
    },
    celebratedSolveKeys: [...value.celebratedSolveKeys],
    v1NoticeDismissed: value.v1NoticeDismissed,
    lastAcknowledgedUpdateId: value.lastAcknowledgedUpdateId,
  };
}

function toLocalPuzzleProgress(
  progress: PuzzleProgressRecord,
): LocalPuzzleProgress {
  return cloneLocalPuzzleProgress(progress);
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

function normalizeStoredState(value: unknown): GoldroadLocalState | null {
  if (!isPlainObject(value)) return null;
  if (value.version !== STORAGE_VERSION) return null;
  if (typeof value.playerUUID !== 'string') return null;
  const settings = normalizeStoredSettings(value.settings);
  if (!settings) return null;
  if (!isValidCurrentRoadContext(value.currentRoadContext)) return null;
  if (!isValidHistoryByDayMap(value.historyByDay)) return null;
  if (!isValidTutorialState(value.tutorialState)) return null;

  const puzzleProgressByKey = normalizeStoredPuzzleProgressMap(
    value.puzzleProgressByKey,
  );
  if (!puzzleProgressByKey) return null;

  const replayProgressByKey = normalizeStoredPuzzleProgressMap(
    value.replayProgressByKey,
  );

  const celebratedSolveKeys = isStringArray(value.celebratedSolveKeys)
    ? value.celebratedSolveKeys
    : [];

  return {
    version: STORAGE_VERSION,
    playerUUID: value.playerUUID,
    settings,
    currentRoadContext: value.currentRoadContext,
    puzzleProgressByKey,
    replayProgressByKey: replayProgressByKey ?? {},
    historyByDay: value.historyByDay,
    archiveCompletionByGame: normalizeStoredArchiveCompletionMap(
      value.archiveCompletionByGame,
    ),
    tutorialState: value.tutorialState,
    celebratedSolveKeys,
    v1NoticeDismissed:
      typeof value.v1NoticeDismissed === 'boolean'
        ? value.v1NoticeDismissed
        : false,
    lastAcknowledgedUpdateId:
      typeof value.lastAcknowledgedUpdateId === 'string'
        ? value.lastAcknowledgedUpdateId
        : null,
  };
}

function removeLegacyKeys() {
  if (typeof window === 'undefined') return;

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (!key || key === STORAGE_KEY) continue;

    if (
      LEGACY_STORAGE_KEYS.includes(
        key as (typeof LEGACY_STORAGE_KEYS)[number],
      ) ||
      LEGACY_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
    ) {
      window.localStorage.removeItem(key);
    }
  }
}

function getProgressMap(
  nextState: GoldroadLocalState,
  scope: LocalProgressScope,
): Record<string, PuzzleProgressRecord> {
  return scope === 'live'
    ? nextState.puzzleProgressByKey
    : nextState.replayProgressByKey;
}

function setProgressMap(
  nextState: GoldroadLocalState,
  scope: LocalProgressScope,
  progressMap: Record<string, PuzzleProgressRecord>,
) {
  if (scope === 'live') {
    nextState.puzzleProgressByKey = progressMap;
    return;
  }

  nextState.replayProgressByKey = progressMap;
}

export function getRoadDayKeyFromPlayableAt(playableAt: string): string {
  return playableAt.split('T')[0] ?? playableAt;
}

/**
 * Pure merge used by `isRoadModeSolved`: a road+mode presents as solved if
 * either the archive-completion map or any live history day says so. Kept
 * as a standalone export so the merge rule is unit-testable without a
 * storage/browser environment (RP1-9).
 */
export function computeIsRoadModeSolved(
  historyByDay: Record<string, HistoryDayRecord>,
  archiveCompletionByGame: Record<string, ArchiveCompletionRecord>,
  gameNo: number,
  puzzleType: PuzzleType,
): boolean {
  if (archiveCompletionByGame[String(gameNo)]?.[puzzleType]) {
    return true;
  }

  return Object.values(historyByDay).some(
    (day) => day.gameNo === gameNo && day.modes[puzzleType]?.solved === true,
  );
}

export function useGoldroadLocalState() {
  const storedState = useStorage<GoldroadLocalState | null>(
    STORAGE_KEY,
    null,
    undefined,
    {
      serializer: StorageSerializers.object,
      writeDefaults: false,
    },
  );
  const state = useState<GoldroadLocalState | null>(
    'goldroad-local-state',
    () => null,
  );

  function commit(nextState: GoldroadLocalState) {
    const snapshot = cloneState(nextState);
    state.value = snapshot;
    storedState.value = snapshot;
    return snapshot;
  }

  function load() {
    if (typeof window === 'undefined') {
      if (!state.value) {
        state.value = createEmptyState(FALLBACK_UUID);
      }
      return state.value;
    }

    removeLegacyKeys();

    const normalized =
      normalizeStoredState(storedState.value) ?? createEmptyState();
    return commit(normalized);
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

  /**
   * Like ensureLoaded, but safe to build a WRITE on. The server renders
   * with a FALLBACK_UUID placeholder that Nuxt hydrates into the shared
   * state; committing a mutation derived from that placeholder would
   * clobber the player's real stored data. Mutators run from event
   * handlers and lifecycle hooks (never during render), so loading here
   * is side-effect-safe.
   */
  function ensureLoadedForWrite(): GoldroadLocalState {
    if (
      typeof window !== 'undefined' &&
      state.value?.playerUUID === FALLBACK_UUID
    ) {
      const loaded = load();
      if (loaded) {
        return loaded;
      }
    }

    return ensureLoaded();
  }

  function updatePuzzleProgress(options: {
    gameNo: number;
    puzzleType: PuzzleType;
    day: string;
    scope: LocalProgressScope;
    syncHistory?: boolean;
    updater: (progress: PuzzleProgressRecord) => PuzzleProgressRecord;
  }): LocalPuzzleProgress {
    const nextState = cloneState(ensureLoadedForWrite());
    const key = buildPuzzleKey(options.gameNo, options.puzzleType);
    const progressMap = getProgressMap(nextState, options.scope);
    const existing = progressMap[key];
    const current =
      existing && existing.day === options.day
        ? clonePuzzleProgressRecord(existing)
        : createPuzzleProgressRecord(
            options.gameNo,
            options.puzzleType,
            options.day,
          );
    const updated = options.updater(current);

    setProgressMap(nextState, options.scope, {
      ...progressMap,
      [key]: clonePuzzleProgressRecord(updated),
    });

    if (options.scope === 'live' && options.syncHistory !== false) {
      upsertHistoryEntry(nextState, updated);
    }

    commit(nextState);
    return toLocalPuzzleProgress(updated);
  }

  function clearPuzzleProgress(
    gameNo: number,
    puzzleType: PuzzleType,
    scope: LocalProgressScope,
  ) {
    const nextState = cloneState(ensureLoadedForWrite());
    const key = buildPuzzleKey(gameNo, puzzleType);
    const progressMap = getProgressMap(nextState, scope);
    if (!(key in progressMap)) {
      return createEmptyLocalPuzzleProgress();
    }

    const { [key]: _removed, ...rest } = progressMap;
    setProgressMap(nextState, scope, rest);
    commit(nextState);
    return createEmptyLocalPuzzleProgress();
  }

  function getPuzzleProgress(
    gameNo: number,
    puzzleType: PuzzleType,
    scope: LocalProgressScope = 'live',
  ): LocalPuzzleProgress {
    const nextState = ensureLoaded();
    const key = buildPuzzleKey(gameNo, puzzleType);
    const progress = getProgressMap(nextState, scope)[key];
    return progress
      ? toLocalPuzzleProgress(progress)
      : createEmptyLocalPuzzleProgress();
  }

  function recordHint(options: {
    gameNo: number;
    puzzleType: PuzzleType;
    day: string;
    guidePath: number[];
    scope?: LocalProgressScope;
  }): LocalPuzzleProgress {
    return updatePuzzleProgress({
      gameNo: options.gameNo,
      puzzleType: options.puzzleType,
      day: options.day,
      scope: options.scope ?? 'live',
      updater: (progress) => {
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
    });
  }

  function setSolveTimerState(options: {
    gameNo: number;
    puzzleType: PuzzleType;
    day: string;
    activeTimeMs: number;
    timerStartedAt: string | null;
    scope?: LocalProgressScope;
  }): LocalPuzzleProgress {
    return updatePuzzleProgress({
      gameNo: options.gameNo,
      puzzleType: options.puzzleType,
      day: options.day,
      scope: options.scope ?? 'live',
      syncHistory: false,
      updater: (progress) => ({
        ...progress,
        activeTimeMs: Math.max(0, options.activeTimeMs),
        timerStartedAt: options.timerStartedAt,
        updatedAt: nowIso(),
      }),
    });
  }

  function recordRun(options: {
    gameNo: number;
    puzzleType: PuzzleType;
    day: string;
    attemptNumber: number;
    solved: boolean;
    solveTimeMs?: number | null;
    activeTimeMs?: number;
    timerStartedAt?: string | null;
    scope?: LocalProgressScope;
  }): LocalPuzzleProgress {
    const scope = options.scope ?? 'live';
    if (scope === 'replay' && options.solved) {
      return clearPuzzleProgress(options.gameNo, options.puzzleType, scope);
    }

    return updatePuzzleProgress({
      gameNo: options.gameNo,
      puzzleType: options.puzzleType,
      day: options.day,
      scope,
      updater: (progress) => ({
        ...progress,
        attempts: progress.solved
          ? progress.attempts
          : Math.max(progress.attempts, options.attemptNumber),
        solved: progress.solved || options.solved,
        solveTimeMs:
          progress.solveTimeMs ??
          (options.solved ? (options.solveTimeMs ?? null) : null),
        activeTimeMs: options.solved
          ? 0
          : typeof options.activeTimeMs === 'number'
            ? Math.max(0, options.activeTimeMs)
            : progress.activeTimeMs,
        timerStartedAt: options.solved
          ? null
          : options.timerStartedAt !== undefined
            ? options.timerStartedAt
            : progress.timerStartedAt,
        guidePath: options.solved ? [] : [...progress.guidePath],
        updatedAt: nowIso(),
      }),
    });
  }

  function recordArchiveCompletion(gameNo: number, puzzleType: PuzzleType) {
    const nextState = cloneState(ensureLoadedForWrite());
    const key = String(gameNo);
    const existing = nextState.archiveCompletionByGame[key];
    if (existing?.[puzzleType]) return;

    nextState.archiveCompletionByGame = {
      ...nextState.archiveCompletionByGame,
      [key]: { ...existing, [puzzleType]: true },
    };
    commit(nextState);
  }

  /**
   * Has this road+mode ever been solved, live or in the archive?
   * Live history and the archive-completion map merge ONLY here (and for
   * the calendar) — never into medals, streaks, or stats.
   */
  function isRoadModeSolved(gameNo: number, puzzleType: PuzzleType): boolean {
    const nextState = ensureLoaded();
    return computeIsRoadModeSolved(
      nextState.historyByDay,
      nextState.archiveCompletionByGame,
      gameNo,
      puzzleType,
    );
  }

  function setCurrentRoadContext(update: Partial<CurrentRoadContext>) {
    const nextState = cloneState(ensureLoadedForWrite());
    nextState.currentRoadContext = {
      ...nextState.currentRoadContext,
      ...update,
    };

    commit(nextState);
  }

  function markTutorialSeen() {
    const nextState = cloneState(ensureLoadedForWrite());
    nextState.tutorialState = {
      ...nextState.tutorialState,
      lastSeenAt: nowIso(),
    };

    commit(nextState);
  }

  function markTutorialCompleted() {
    const nextState = cloneState(ensureLoadedForWrite());
    nextState.tutorialState = {
      completed: true,
      lastSeenAt: nowIso(),
    };

    commit(nextState);
  }

  function hasCelebratedSolve(
    gameNo: number,
    puzzleType: PuzzleType,
    day: string,
  ): boolean {
    const key = buildCelebrationKey(gameNo, puzzleType, day);
    return ensureLoaded().celebratedSolveKeys.includes(key);
  }

  function markSolveCelebrated(
    gameNo: number,
    puzzleType: PuzzleType,
    day: string,
  ) {
    const key = buildCelebrationKey(gameNo, puzzleType, day);
    const nextState = cloneState(ensureLoadedForWrite());
    if (nextState.celebratedSolveKeys.includes(key)) {
      return;
    }

    nextState.celebratedSolveKeys = [...nextState.celebratedSolveKeys, key];
    commit(nextState);
  }

  function dismissV1Notice() {
    const nextState = cloneState(ensureLoadedForWrite());
    if (nextState.v1NoticeDismissed) {
      return;
    }

    nextState.v1NoticeDismissed = true;
    commit(nextState);
  }

  function acknowledgeUpdate(updateId: string) {
    const nextState = cloneState(ensureLoadedForWrite());
    if (nextState.lastAcknowledgedUpdateId === updateId) {
      return;
    }

    nextState.lastAcknowledgedUpdateId = updateId;
    commit(nextState);
  }

  function setMuted(muted: boolean) {
    const nextState = cloneState(ensureLoadedForWrite());
    nextState.settings = {
      ...nextState.settings,
      muted,
    };

    commit(nextState);
  }

  function toggleMuted() {
    const nextState = ensureLoaded();
    setMuted(!nextState.settings.muted);
  }

  return {
    state,
    load,
    playerUUID: computed(() => ensureLoaded().playerUUID),
    muted: computed(() => ensureLoaded().settings.muted),
    currentRoadContext: computed(() => ensureLoaded().currentRoadContext),
    tutorialState: computed(() => ensureLoaded().tutorialState),
    hasAnyLiveProgress: computed(() => {
      const nextState = ensureLoaded();
      return (
        Object.keys(nextState.historyByDay).length > 0 ||
        Object.values(nextState.puzzleProgressByKey).some(
          (progress) =>
            progress.attempts > 0 ||
            progress.solved ||
            progress.hintsUsed > 0 ||
            progress.activeTimeMs > 0,
        )
      );
    }),
    getPuzzleProgress,
    recordHint,
    setSolveTimerState,
    recordRun,
    recordArchiveCompletion,
    isRoadModeSolved,
    archiveCompletionByGame: computed(
      () => ensureLoaded().archiveCompletionByGame,
    ),
    setCurrentRoadContext,
    markTutorialSeen,
    markTutorialCompleted,
    hasCelebratedSolve,
    markSolveCelebrated,
    hasDismissedV1Notice: computed(() => ensureLoaded().v1NoticeDismissed),
    dismissV1Notice,
    lastAcknowledgedUpdateId: computed(
      () => ensureLoaded().lastAcknowledgedUpdateId,
    ),
    acknowledgeUpdate,
    setMuted,
    toggleMuted,
  };
}
