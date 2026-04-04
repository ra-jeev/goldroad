import { computed, onMounted, onUnmounted, ref } from 'vue'
import { buildInitialTileStates } from '../utils/boardUtils'
import { buildEdgeMap, getActiveNeighbors, getNeighborId, parseTileIndex } from '../../shared/utils/puzzleEngine'
import { calcOutcomeTier } from '../../lib/gameTiers'
import type { Direction } from '../../shared/types/game'
import { UI_COPY } from '../content/uiCopy'

type GamePayload = Awaited<ReturnType<ReturnType<typeof useGamesApi>['getCurrentGame']>>

export function useGoldroadGame() {
  const gamesApi = useGamesApi()
  const sessionApi = useSessionApi()

  const game = ref<GamePayload | null>(null)
  const tiles = ref<ReturnType<typeof buildInitialTileStates>>([])
  const currentTileIndex = ref<number | null>(null)
  const visited = ref<Set<number>>(new Set())
  const activeSet = ref<Set<number>>(new Set())
  const pathHistory = ref<number[]>([])
  const score = ref(0)
  const moves = ref(0)
  const hintMessage = ref<string | null>(null)
  const hintedTiles = ref<Set<number>>(new Set())
  const ended = ref(false)
  const loading = ref(false)
  const submitting = ref(false)
  const playerUUID = ref('')
  const sessionId = ref('')
  const status = ref<string>(UI_COPY.runtime.loadingGame)
  const lastTier = ref<'gold' | 'silver' | 'bronze' | 'finished' | 'unfinished' | null>(null)

  const hintUsage = ref({
    level1: 0,
    level2: 0,
    level3: 0,
  })

  const maxScore = computed(() => game.value?.maxScore ?? 0)
  const totalCoins = computed(() => game.value?.totalCoins ?? 0)
  const completionPercent = computed(() => {
    if (!maxScore.value) return 0
    return Math.min(100, Math.round((score.value / maxScore.value) * 100))
  })

  // UI-ready labels (derived display text and formatted fields)
  const uiLabels = computed(() => ({
    roadHeading: game.value ? `Road ${game.value.gameNo}` : 'Road ...',
    runStateHeading: ended.value ? UI_COPY.sidebar.routeComplete : UI_COPY.sidebar.routeActive,
    difficultyLabel: game.value?.difficultyBand ?? '—',
    hintDisplayMessage: hintMessage.value ?? UI_COPY.sidebar.defaultHintInline,
    hasHintMessage: Boolean(hintMessage.value),
    progressText: `${completionPercent.value}%`,
    completionHeading: lastTier.value
      ? UI_COPY.completion.tiers[lastTier.value]
      : UI_COPY.completion.headingFallback,
    completionOutcome: lastTier.value ?? '—',
  }))

  function ensurePlayerUUID(): string {
    if (typeof window === 'undefined') return '00000000-0000-4000-8000-000000000000'

    const key = 'goldroad-player-uuid'
    const existing = window.localStorage.getItem(key)
    if (existing) return existing

    const created = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : '00000000-0000-4000-8000-000000000000'

    window.localStorage.setItem(key, created)
    return created
  }

  function newSessionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
    return '00000000-0000-4000-8000-000000000000'
  }

  function updateTileStates() {
    if (!game.value || currentTileIndex.value === null) return

    const current = currentTileIndex.value
    for (const row of tiles.value) {
      for (const tile of row) {
        tile.done = visited.value.has(tile.id)
        tile.active = activeSet.value.has(tile.id)
        tile.focus = tile.id === current
        tile.tabIndex = tile.id === current || activeSet.value.has(tile.id) ? 0 : -1
      }
    }
  }

  function setupGame(next: GamePayload) {
    game.value = next
    tiles.value = buildInitialTileStates(next.board)
    visited.value = new Set([next.board.start])
    pathHistory.value = [next.board.start]
    currentTileIndex.value = next.board.start
    score.value = next.board.tiles[next.board.start] ?? 0
    moves.value = 1
    ended.value = false
    submitting.value = false
    hintMessage.value = null
    hintedTiles.value = new Set()
    status.value = UI_COPY.runtime.introStatus
    lastTier.value = null
    hintUsage.value = { level1: 0, level2: 0, level3: 0 }
    sessionId.value = newSessionId()

    const edgeMap = buildEdgeMap(next.board)
    const active = getActiveNeighbors(next.board.start, next.board.rows, next.board.cols, edgeMap, visited.value)
    activeSet.value = new Set(active)
    updateTileStates()
  }

  async function loadCurrentGame() {
    loading.value = true
    status.value = UI_COPY.runtime.loadingTodaysRoad
    try {
      const payload = await gamesApi.getCurrentGame()
      setupGame(payload)
    } finally {
      loading.value = false
    }
  }

  async function playAnother() {
    if (!playerUUID.value) return
    loading.value = true
    status.value = UI_COPY.runtime.findingAnotherRoad
    try {
      const payload = await gamesApi.getAnotherGame(playerUUID.value)
      setupGame(payload)
    } finally {
      loading.value = false
    }
  }

  function highestHintLevelUsed(): number {
    if (hintUsage.value.level3 > 0) return 3
    if (hintUsage.value.level2 > 0) return 2
    if (hintUsage.value.level1 > 0) return 1
    return 0
  }

  async function finalizeRun(reachedEnd: boolean) {
    if (!game.value || submitting.value || !playerUUID.value || !sessionId.value) return
    submitting.value = true

    const tier = calcOutcomeTier(score.value, game.value.maxScore, reachedEnd, highestHintLevelUsed())
    lastTier.value = tier

    try {
      await sessionApi.endSession({
        playerUUID: playerUUID.value,
        gameNo: game.value.gameNo,
        sessionId: sessionId.value,
        score: score.value,
        moves: moves.value,
        attempts: 1,
        tier,
        hintsLevel1: hintUsage.value.level1,
        hintsLevel2: hintUsage.value.level2,
        hintsLevel3: hintUsage.value.level3,
      })
    } finally {
      submitting.value = false
    }
  }

  async function moveTo(tileIndex: number) {
    if (!game.value || ended.value || currentTileIndex.value === null) return
    if (!activeSet.value.has(tileIndex)) return

    visited.value.add(tileIndex)
    pathHistory.value = [...pathHistory.value, tileIndex]
    currentTileIndex.value = tileIndex
    score.value += game.value.board.tiles[tileIndex] ?? 0
    moves.value += 1
    hintedTiles.value.clear()
    hintMessage.value = null

    if (tileIndex === game.value.board.end) {
      ended.value = true
      status.value = UI_COPY.runtime.destinationReached
      activeSet.value.clear()
      updateTileStates()
      await finalizeRun(true)
      return
    }

    const board = game.value.board
    const edgeMap = buildEdgeMap(board)
    const next = getActiveNeighbors(tileIndex, board.rows, board.cols, edgeMap, visited.value)
    activeSet.value = new Set(next)

    if (!next.length) {
      ended.value = true
      status.value = UI_COPY.runtime.deadEnd
      updateTileStates()
      await finalizeRun(false)
      return
    }

    updateTileStates()
  }

  async function requestHint(level: 1 | 2 | 3) {
    if (!game.value || ended.value || currentTileIndex.value === null || !playerUUID.value) return

    const res = await sessionApi.requestHint({
      playerUUID: playerUUID.value,
      gameNo: game.value.gameNo,
      sessionId: sessionId.value,
      level,
      currentTileIndex: currentTileIndex.value,
    })

    hintedTiles.value.clear()
    if (res.hint.level === 1) {
      hintUsage.value.level1 += 1
      if (typeof res.hint.nextTileIndex === 'number') {
        hintedTiles.value.add(res.hint.nextTileIndex)
        hintMessage.value = UI_COPY.runtime.hint1Highlighted
      } else {
        hintMessage.value = UI_COPY.runtime.hint1Direction(res.hint.direction)
      }
    } else if (res.hint.level === 2) {
      hintUsage.value.level2 += 1
      for (const idx of res.hint.tileIndexes) hintedTiles.value.add(idx)
      hintMessage.value = UI_COPY.runtime.hint2Suggested(res.hint.tileIndexes)
    } else {
      hintUsage.value.level3 += 1
      hintedTiles.value.add(res.hint.nextTileIndex)
      hintMessage.value = UI_COPY.runtime.hint3Next(res.hint.nextTileIndex)
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!game.value || ended.value || loading.value || currentTileIndex.value === null) return

    const directionMap: Record<string, Direction> = {
      ArrowUp: 'top',
      ArrowRight: 'right',
      ArrowDown: 'bottom',
      ArrowLeft: 'left',
      w: 'top',
      d: 'right',
      s: 'bottom',
      a: 'left',
    }

    const direction = directionMap[event.key]
    if (!direction) return

    const [row, col] = parseTileIndex(currentTileIndex.value, game.value.board.cols)
    const neighbor = getNeighborId(row, col, direction, game.value.board.rows, game.value.board.cols)
    if (neighbor === null || !activeSet.value.has(neighbor)) return

    event.preventDefault()
    void moveTo(neighbor)
  }

  onMounted(async () => {
    playerUUID.value = ensurePlayerUUID()
    window.addEventListener('keydown', handleKeydown)
    await loadCurrentGame()
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })

  return {
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
    ended,
    loading,
    submitting,
    status,
    lastTier,
    hintUsage,
    maxScore,
    totalCoins,
    completionPercent,
    uiLabels,
    loadCurrentGame,
    playAnother,
    moveTo,
    requestHint,
  }
}