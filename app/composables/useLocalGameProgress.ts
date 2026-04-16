import { ref } from 'vue'
import type { Medal, PuzzleType } from '../../shared/types/game'

const STORAGE_KEY = 'goldroad-progress-v1'

type HintUsage = {
  level1: number
  level2: number
  level3: number
}

export type LocalGameProgressRecord = {
  attempts: number
  solved: boolean
  firstSolvedAttempt: number | null
  medal: Medal | null
  bestScore: number
  hints: HintUsage
}

type LocalProgressState = {
  playerUUID: string
  day: string
  games: Record<string, LocalGameProgressRecord>
}

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]!
}

function createEmptyGameProgress(): LocalGameProgressRecord {
  return {
    attempts: 0,
    solved: false,
    firstSolvedAttempt: null,
    medal: null,
    bestScore: 0,
    hints: {
      level1: 0,
      level2: 0,
      level3: 0,
    },
  }
}

function createEmptyState(playerUUID: string): LocalProgressState {
  return {
    playerUUID,
    day: getTodayKey(),
    games: {},
  }
}

function buildGameKey(gameNo: number, puzzleType: PuzzleType): string {
  return `${puzzleType}:${gameNo}`
}

function isValidState(value: unknown): value is LocalProgressState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as LocalProgressState
  return typeof candidate.playerUUID === 'string'
    && typeof candidate.day === 'string'
    && !!candidate.games
    && typeof candidate.games === 'object'
}

export function useLocalGameProgress() {
  const state = ref<LocalProgressState | null>(null)

  function persistCurrentState() {
    if (typeof window === 'undefined' || !state.value) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value))
  }

  function load(playerUUID: string) {
    if (typeof window === 'undefined') {
      state.value = createEmptyState(playerUUID)
      return
    }

    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      state.value = createEmptyState(playerUUID)
      persistCurrentState()
      return
    }

    try {
      const parsed = JSON.parse(raw) as unknown
      if (!isValidState(parsed) || parsed.playerUUID !== playerUUID || parsed.day !== getTodayKey()) {
        state.value = createEmptyState(playerUUID)
        persistCurrentState()
        return
      }

      state.value = parsed
    } catch {
      state.value = createEmptyState(playerUUID)
      persistCurrentState()
    }
  }

  function ensureLoaded(playerUUID: string): LocalProgressState {
    if (!state.value || state.value.playerUUID !== playerUUID || state.value.day !== getTodayKey()) {
      load(playerUUID)
    }

    return state.value ?? createEmptyState(playerUUID)
  }

  function getGameProgress(gameNo: number, puzzleType: PuzzleType): LocalGameProgressRecord {
    if (!state.value) return createEmptyGameProgress()
    const key = buildGameKey(gameNo, puzzleType)
    return state.value.games[key] ?? createEmptyGameProgress()
  }

  function updateGameProgress(
    playerUUID: string,
    gameNo: number,
    puzzleType: PuzzleType,
    updater: (progress: LocalGameProgressRecord) => LocalGameProgressRecord,
  ): LocalGameProgressRecord {
    const nextState = ensureLoaded(playerUUID)
    const key = buildGameKey(gameNo, puzzleType)
    const current = nextState.games[key] ?? createEmptyGameProgress()
    const updated = updater({
      ...current,
      hints: { ...current.hints },
    })

    nextState.games[key] = updated
    state.value = {
      ...nextState,
      games: {
        ...nextState.games,
      },
    }
    persistCurrentState()
    return updated
  }

  function incrementHintUsage(
    playerUUID: string,
    gameNo: number,
    puzzleType: PuzzleType,
    level: 1 | 2 | 3,
  ) {
    return updateGameProgress(playerUUID, gameNo, puzzleType, (progress) => ({
      ...progress,
      hints: {
        ...progress.hints,
        [`level${level}`]: progress.hints[`level${level}` as keyof HintUsage] + 1,
      },
    }))
  }

  function recordRun(
    playerUUID: string,
    gameNo: number,
    puzzleType: PuzzleType,
    attemptNumber: number,
    solved: boolean,
    medal: Medal | null,
    score: number,
    hints: HintUsage,
  ) {
    return updateGameProgress(playerUUID, gameNo, puzzleType, (progress) => ({
      attempts: Math.max(progress.attempts, attemptNumber),
      solved: progress.solved || solved,
      firstSolvedAttempt: progress.firstSolvedAttempt ?? (solved ? attemptNumber : null),
      medal: progress.medal ?? medal,
      bestScore: Math.max(progress.bestScore, score),
      hints: { ...hints },
    }))
  }

  return {
    state,
    load,
    getGameProgress,
    incrementHintUsage,
    recordRun,
  }
}