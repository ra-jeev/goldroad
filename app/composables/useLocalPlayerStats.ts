import { computed, ref } from 'vue'
import type { PuzzleType } from '../../shared/types/game'
import type { LocalGameProgressRecord } from './useLocalGameProgress'

const STORAGE_KEY = 'goldroad-player-stats-v1'

type StatsModeRecord = LocalGameProgressRecord & {
  updatedAt: string
}

type StatsDayRecord = {
  day: string
  gameNo: number
  modes: Partial<Record<PuzzleType, StatsModeRecord>>
}

type PlayerStatsState = {
  playerUUID: string
  days: Record<string, StatsDayRecord>
}

function createEmptyState(playerUUID: string): PlayerStatsState {
  return {
    playerUUID,
    days: {},
  }
}

function isValidState(value: unknown): value is PlayerStatsState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as PlayerStatsState
  return typeof candidate.playerUUID === 'string'
    && !!candidate.days
    && typeof candidate.days === 'object'
}

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]!
}

function copyProgress(progress: LocalGameProgressRecord): LocalGameProgressRecord {
  return {
    ...progress,
    hints: { ...progress.hints },
  }
}

function getHintTotal(progress: Pick<LocalGameProgressRecord, 'hints'>): number {
  return progress.hints.level1 + progress.hints.level2 + progress.hints.level3
}

function parseGameKey(key: string): { puzzleType: PuzzleType; gameNo: number } | null {
  const [puzzleType, rawGameNo] = key.split(':')
  if ((puzzleType !== 'classic' && puzzleType !== 'expedition') || !rawGameNo) return null

  const gameNo = Number(rawGameNo)
  if (!Number.isFinite(gameNo)) return null

  return {
    puzzleType,
    gameNo,
  }
}

function getUtcDayStamp(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`)
}

export function useLocalPlayerStats() {
  const state = ref<PlayerStatsState | null>(null)

  function persist() {
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
      persist()
      return
    }

    try {
      const parsed = JSON.parse(raw) as unknown
      if (!isValidState(parsed) || parsed.playerUUID !== playerUUID) {
        state.value = createEmptyState(playerUUID)
        persist()
        return
      }

      state.value = parsed
    } catch {
      state.value = createEmptyState(playerUUID)
      persist()
    }
  }

  function ensureLoaded(playerUUID: string): PlayerStatsState {
    if (!state.value || state.value.playerUUID !== playerUUID) {
      load(playerUUID)
    }

    return state.value ?? createEmptyState(playerUUID)
  }

  function recordProgress(
    playerUUID: string,
    day: string,
    gameNo: number,
    puzzleType: PuzzleType,
    progress: LocalGameProgressRecord,
  ) {
    const nextState = ensureLoaded(playerUUID)
    const currentDay = nextState.days[day] ?? {
      day,
      gameNo,
      modes: {},
    }

    nextState.days[day] = {
      ...currentDay,
      gameNo,
      modes: {
        ...currentDay.modes,
        [puzzleType]: {
          ...copyProgress(progress),
          updatedAt: new Date().toISOString(),
        },
      },
    }

    state.value = {
      ...nextState,
      days: {
        ...nextState.days,
      },
    }
    persist()
  }

  function syncCurrentDay(
    playerUUID: string,
    day: string,
    games: Record<string, LocalGameProgressRecord>,
  ) {
    for (const [gameKey, progress] of Object.entries(games)) {
      const parsed = parseGameKey(gameKey)
      if (!parsed) continue
      recordProgress(playerUUID, day, parsed.gameNo, parsed.puzzleType, progress)
    }
  }

  const recentDays = computed(() => {
    if (!state.value) return [] as StatsDayRecord[]

    return Object.values(state.value.days)
      .sort((left, right) => right.day.localeCompare(left.day))
  })

  const summary = computed(() => {
    const days = recentDays.value
    const modeEntries = days.flatMap((entry) => {
      const records: Array<StatsModeRecord & { day: string; gameNo: number; puzzleType: PuzzleType }> = []
      if (entry.modes.classic) {
        records.push({ ...entry.modes.classic, day: entry.day, gameNo: entry.gameNo, puzzleType: 'classic' })
      }
      if (entry.modes.expedition) {
        records.push({ ...entry.modes.expedition, day: entry.day, gameNo: entry.gameNo, puzzleType: 'expedition' })
      }
      return records
    })

    const activeModes = modeEntries.filter((entry) => entry.attempts > 0 || getHintTotal(entry) > 0)
    const solvedModes = activeModes.filter((entry) => entry.solved)
    const medalCounts = {
      gold: solvedModes.filter((entry) => entry.medal === 'gold').length,
      silver: solvedModes.filter((entry) => entry.medal === 'silver').length,
      bronze: solvedModes.filter((entry) => entry.medal === 'bronze').length,
    }

    const classicSolvedDays = new Set(
      days
        .filter((entry) => entry.modes.classic?.solved)
        .map((entry) => entry.day),
    )

    const dayKeysAsc = [...classicSolvedDays].sort()
    let bestClassicStreak = 0
    let runningClassicStreak = 0
    let previousSolvedDay: string | null = null

    for (const day of dayKeysAsc) {
      if (!previousSolvedDay) {
        runningClassicStreak = 1
      } else {
        const previousStamp = getUtcDayStamp(previousSolvedDay)
        const currentStamp = getUtcDayStamp(day)
        runningClassicStreak = currentStamp - previousStamp === 86400000
          ? runningClassicStreak + 1
          : 1
      }

      bestClassicStreak = Math.max(bestClassicStreak, runningClassicStreak)
      previousSolvedDay = day
    }

    let currentClassicStreak = 0
    let cursor = getUtcDayStamp(getTodayKey())
    while (classicSolvedDays.has(new Date(cursor).toISOString().split('T')[0]!)) {
      currentClassicStreak += 1
      cursor -= 86400000
    }

    const totalHints = activeModes.reduce((sum, entry) => sum + getHintTotal(entry), 0)
    const averageSolvedAttempts = solvedModes.length
      ? (solvedModes.reduce((sum, entry) => sum + (entry.firstSolvedAttempt ?? entry.attempts), 0) / solvedModes.length).toFixed(1)
      : '—'

    return {
      roadDaysPlayed: days.filter((entry) => Object.values(entry.modes).some((mode) => mode && (mode.attempts > 0 || getHintTotal(mode) > 0))).length,
      modeSessionsPlayed: activeModes.length,
      exactSolves: solvedModes.length,
      solveRate: activeModes.length ? Math.round((solvedModes.length / activeModes.length) * 100) : 0,
      currentClassicStreak,
      bestClassicStreak,
      totalHints,
      averageSolvedAttempts,
      medalCounts,
    }
  })

  return {
    state,
    load,
    recordProgress,
    syncCurrentDay,
    recentDays,
    summary,
  }
}