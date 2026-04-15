import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { buildInitialTileStates } from '../utils/boardUtils'
import { buildEdgeMap, getActiveNeighbors, getNeighborId, parseTileIndex, getEdgeType } from '../../shared/utils/puzzleEngine'
import { calcOutcomeTier } from '../../lib/gameTiers'
import type { Direction, PuzzleType } from '../../shared/types/game'
import { UI_COPY } from '../content/uiCopy'

type GamePayload = {
  gameNo: number
  puzzleType: PuzzleType
  board: any
  maxScore: number
  totalCoins: number
  difficultyBand: string
  playableAt: string
  nextGameAt: string | null
}

export function useGoldroadGame() {
  const gamesApi = useGamesApi()
  const sessionApi = useSessionApi()

  const availableGames = ref<{ classic: GamePayload | null; expedition: GamePayload | null }>({
    classic: null,
    expedition: null,
  })
  const selectedMode = ref<PuzzleType | null>(null)
  const showModeSelector = ref(false)
  
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

  // Check if expedition is unlocked (classic completed with gold today)
  const isExpeditionUnlocked = computed(() => {
    if (!availableGames.value.classic) return false
    const today = new Date().toISOString().split('T')[0]
    const key = `goldroad-classic-gold-${today}`
    return typeof window !== 'undefined' && window.localStorage.getItem(key) === 'true'
  })

  // Check if classic was completed today (any tier)
  const classicCompletedToday = computed(() => {
    if (!availableGames.value.classic) return false
    const today = new Date().toISOString().split('T')[0]
    const key = `goldroad-classic-completed-${today}`
    return typeof window !== 'undefined' && window.localStorage.getItem(key) === 'true'
  })

  // UI-ready labels (derived display text and formatted fields)
  const uiLabels = computed(() => ({
    roadHeading: game.value ? `Road ${game.value.gameNo}` : 'Road ...',
    modeLabel: selectedMode.value === 'expedition' 
      ? UI_COPY.modeSelector.expeditionBadge 
      : UI_COPY.modeSelector.classicBadge,
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

  // Update body class based on selected mode
  watch(selectedMode, (mode) => {
    if (typeof window === 'undefined') return
    document.body.classList.remove('mode-classic', 'mode-expedition')
    if (mode) {
      document.body.classList.add(`mode-${mode}`)
    }
  })

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

  function markClassicCompleted(tier: 'gold' | 'silver' | 'bronze' | 'finished' | 'unfinished') {
    if (typeof window === 'undefined' || selectedMode.value !== 'classic') return
    
    const today = new Date().toISOString().split('T')[0]
    
    // Mark as completed (any tier)
    window.localStorage.setItem(`goldroad-classic-completed-${today}`, 'true')
    
    // Mark gold completion for expedition unlock
    if (tier === 'gold') {
      window.localStorage.setItem(`goldroad-classic-gold-${today}`, 'true')
    }

    // Clean up old entries (keep last 7 days)
    cleanupOldCompletionFlags()
  }

  function cleanupOldCompletionFlags() {
    if (typeof window === 'undefined') return
    
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && (key.startsWith('goldroad-classic-gold-') || key.startsWith('goldroad-classic-completed-'))) {
        const dateStr = key.split('-').slice(-3).join('-')
        const keyDate = new Date(dateStr)
        if (keyDate < sevenDaysAgo) {
          keysToRemove.push(key)
        }
      }
    }
    
    keysToRemove.forEach(key => window.localStorage.removeItem(key))
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

  async function loadAvailableGames() {
    loading.value = true
    status.value = UI_COPY.runtime.loadingTodaysRoad
    try {
      const response = await gamesApi.getCurrentGames()
      availableGames.value = response
      showModeSelector.value = true
    } finally {
      loading.value = false
    }
  }

  function selectMode(mode: PuzzleType) {
    const gameToLoad = mode === 'classic' ? availableGames.value.classic : availableGames.value.expedition
    if (!gameToLoad) return
    
    selectedMode.value = mode
    showModeSelector.value = false
    setupGame(gameToLoad)
  }

  async function loadCurrentGame() {
    await loadAvailableGames()
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

    // Mark classic completion if applicable
    if (selectedMode.value === 'classic') {
      markClassicCompleted(tier)
    }

    try {
      await sessionApi.endSession({
        playerUUID: playerUUID.value,
        gameNo: game.value.gameNo,
        puzzleType: game.value.puzzleType,
        sessionId: sessionId.value,
        score: score.value,
        moves: moves.value,
        attempts: 1,
        tier,
        hintsLevel1: hintUsage.value.level1,
        hintsLevel2: hintUsage.value.level2,
        hintsLevel3: hintUsage.value.level3,
      })

      // Auto-show mode selector if classic completed with gold and expedition available
      if (selectedMode.value === 'classic' && tier === 'gold' && availableGames.value.expedition) {
        // Small delay to let the completion panel show first
        setTimeout(() => {
          showModeSelector.value = true
        }, 1500)
      }
    } finally {
      submitting.value = false
    }
  }

  async function handlePlayAnother() {
    // If classic was completed with gold and expedition is available, show mode selector
    if (selectedMode.value === 'classic' && lastTier.value === 'gold' && availableGames.value.expedition) {
      showModeSelector.value = true
      return
    }
    
    // Otherwise, load a random past game
    await playAnother()
  }

  async function moveTo(tileIndex: number) {
    if (!game.value || ended.value || currentTileIndex.value === null) return
    if (!activeSet.value.has(tileIndex)) return

    const board = game.value.board
    const edgeMap = buildEdgeMap(board)
    
    // Calculate edge cost (toll/bonus) for the move
    const fromIndex = currentTileIndex.value
    const toIndex = tileIndex
    const edgeType = getEdgeType(fromIndex, toIndex, edgeMap)
    let edgeCost = 0
    if (edgeType === 'toll') {
      edgeCost = -board.tollValue
    } else if (edgeType === 'bonus') {
      edgeCost = board.bonusValue
    }

    visited.value.add(tileIndex)
    pathHistory.value = [...pathHistory.value, tileIndex]
    currentTileIndex.value = tileIndex
    score.value += (game.value.board.tiles[tileIndex] ?? 0) + edgeCost
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
      puzzleType: game.value.puzzleType,
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
    availableGames,
    selectedMode,
    showModeSelector,
    isExpeditionUnlocked,
    classicCompletedToday,
    loadCurrentGame,
    selectMode,
    playAnother: handlePlayAnother,
    moveTo,
    requestHint,
  }
}